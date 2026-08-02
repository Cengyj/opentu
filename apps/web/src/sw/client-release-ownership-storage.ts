export interface SWClientReleaseOwnershipStorageOptions {
  openDatabase: () => Promise<IDBDatabase>;
  storeName: string;
  now?: () => number;
}

interface PersistedClientReleaseOwnership {
  key: string;
  clientId: string;
  releaseId: string;
  updatedAt: number;
}

const CLIENT_RELEASE_OWNERSHIP_KEY_PREFIX = 'app-client-release-v2:';

const normalizeIdentity = (value: string, label: string): string => {
  const normalized = value.trim();
  if (!normalized) {
    throw new Error(`${label} must be a non-empty string`);
  }
  return normalized;
};

const getOwnershipKey = (clientId: string): string =>
  `${CLIENT_RELEASE_OWNERSHIP_KEY_PREFIX}${clientId}`;

const readOwnershipRecord = (
  value: unknown,
  expectedClientId?: string
): PersistedClientReleaseOwnership | null => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }
  const record = value as Partial<PersistedClientReleaseOwnership>;
  if (
    typeof record.key !== 'string' ||
    !record.key.startsWith(CLIENT_RELEASE_OWNERSHIP_KEY_PREFIX) ||
    typeof record.clientId !== 'string' ||
    !record.clientId.trim() ||
    (expectedClientId !== undefined && record.clientId !== expectedClientId) ||
    typeof record.releaseId !== 'string' ||
    !record.releaseId.trim() ||
    typeof record.updatedAt !== 'number' ||
    !Number.isFinite(record.updatedAt)
  ) {
    return null;
  }
  return {
    key: record.key,
    clientId: record.clientId,
    releaseId: record.releaseId.trim(),
    updatedAt: record.updatedAt,
  };
};

/**
 * Atomically resolves the durable release ownership for a client. The first
 * claim wins; later conflicting claims observe that committed value and never
 * overwrite it. Resolution waits for the readwrite transaction to commit.
 */
export async function resolveOrEstablishSWClientReleaseOwnership(
  {
    openDatabase,
    storeName,
    now = Date.now,
  }: SWClientReleaseOwnershipStorageOptions,
  clientId: string,
  claimedReleaseId: string
): Promise<string> {
  const normalizedClientId = normalizeIdentity(clientId, 'clientId');
  const normalizedClaim = normalizeIdentity(claimedReleaseId, 'releaseId');
  const ownershipKey = getOwnershipKey(normalizedClientId);
  const db = await openDatabase();
  try {
    return await new Promise<string>((resolve, reject) => {
      const transaction = db.transaction(storeName, 'readwrite');
      const store = transaction.objectStore(storeName);
      const request = store.get(ownershipKey);
      let resolvedReleaseId: string | null = null;

      request.onsuccess = () => {
        const existingOwnership = readOwnershipRecord(
          request.result,
          normalizedClientId
        );
        if (existingOwnership) {
          resolvedReleaseId = existingOwnership.releaseId;
          return;
        }

        resolvedReleaseId = normalizedClaim;
        store.put({
          key: ownershipKey,
          clientId: normalizedClientId,
          releaseId: normalizedClaim,
          updatedAt: now(),
        } satisfies PersistedClientReleaseOwnership);
      };
      transaction.oncomplete = () => {
        if (resolvedReleaseId === null) {
          reject(
            new Error('client release ownership transaction completed empty')
          );
          return;
        }
        resolve(resolvedReleaseId);
      };
      transaction.onerror = () =>
        reject(
          transaction.error ||
            new Error('client release ownership transaction failed')
        );
      transaction.onabort = () =>
        reject(
          transaction.error ||
            new Error('client release ownership transaction aborted')
        );
    });
  } finally {
    db.close();
  }
}

export async function readSWClientReleaseOwnership(
  { openDatabase, storeName }: SWClientReleaseOwnershipStorageOptions,
  clientId: string
): Promise<string | null> {
  const normalizedClientId = normalizeIdentity(clientId, 'clientId');
  const db = await openDatabase();
  try {
    return await new Promise<string | null>((resolve, reject) => {
      const transaction = db.transaction(storeName, 'readonly');
      const request = transaction
        .objectStore(storeName)
        .get(getOwnershipKey(normalizedClientId));
      let releaseId: string | null = null;
      request.onsuccess = () => {
        releaseId =
          readOwnershipRecord(request.result, normalizedClientId)?.releaseId ||
          null;
      };
      request.onerror = () => reject(request.error);
      transaction.oncomplete = () => resolve(releaseId);
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error);
    });
  } finally {
    db.close();
  }
}

/**
 * Rebuilds the in-memory ownership map after a worker restart and prunes only
 * records whose client IDs are absent from the authoritative live-client set.
 */
export async function reconcileSWClientReleaseOwnership(
  { openDatabase, storeName }: SWClientReleaseOwnershipStorageOptions,
  liveClientIds: readonly string[]
): Promise<Map<string, string>> {
  const liveClients = new Set(liveClientIds);
  const ownership = new Map<string, string>();
  const db = await openDatabase();
  try {
    return await new Promise<Map<string, string>>((resolve, reject) => {
      const transaction = db.transaction(storeName, 'readwrite');
      const request = transaction.objectStore(storeName).openCursor();
      request.onsuccess = () => {
        const cursor = request.result;
        if (!cursor) {
          return;
        }
        if (
          typeof cursor.key === 'string' &&
          cursor.key.startsWith(CLIENT_RELEASE_OWNERSHIP_KEY_PREFIX)
        ) {
          const record = readOwnershipRecord(cursor.value);
          if (record && liveClients.has(record.clientId)) {
            ownership.set(record.clientId, record.releaseId);
          } else {
            cursor.delete();
          }
        }
        cursor.continue();
      };
      request.onerror = () => reject(request.error);
      transaction.oncomplete = () => resolve(ownership);
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error);
    });
  } finally {
    db.close();
  }
}
