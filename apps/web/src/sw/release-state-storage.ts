import {
  normalizeSWReleaseState,
  SW_RELEASE_STATE_SCHEMA_VERSION,
  type SWReleaseState,
} from './release-contract';

export type SWReleaseStatePatch = Partial<
  Omit<SWReleaseState, 'schemaVersion' | 'revision' | 'updatedAt'>
>;

export interface SWReleaseStateStorageOptions {
  openDatabase: () => Promise<IDBDatabase>;
  storeName: string;
  stateKey: string;
  legacyStateKey: string;
  currentReleaseId: string;
  now?: () => number;
}

interface PersistedReleaseStateRecord {
  key: string;
  state?: unknown;
}

const readRecordState = (value: unknown): unknown =>
  value && typeof value === 'object'
    ? (value as PersistedReleaseStateRecord).state
    : undefined;

/**
 * Reads the revisioned state first and consults the legacy key only when the
 * new record does not exist. An already-running legacy worker can therefore
 * keep writing its old key without overwriting the new protocol authority.
 */
export async function readSWReleaseState({
  openDatabase,
  storeName,
  stateKey,
  legacyStateKey,
  currentReleaseId,
  now = Date.now,
}: SWReleaseStateStorageOptions): Promise<SWReleaseState> {
  const db = await openDatabase();
  try {
    return await new Promise<SWReleaseState>((resolve, reject) => {
      const transaction = db.transaction([storeName], 'readonly');
      const store = transaction.objectStore(storeName);
      let state: SWReleaseState | null = null;

      const resolveState = (value: unknown) => {
        state = normalizeSWReleaseState(value, currentReleaseId, now());
      };
      const readLegacy = () => {
        const legacyRequest = store.get(legacyStateKey);
        legacyRequest.onerror = () => reject(legacyRequest.error);
        legacyRequest.onsuccess = () => {
          resolveState(readRecordState(legacyRequest.result));
        };
      };

      const request = store.get(stateKey);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        if (request.result) {
          resolveState(readRecordState(request.result));
          return;
        }
        readLegacy();
      };
      transaction.oncomplete = () => {
        resolve(
          state || normalizeSWReleaseState(undefined, currentReleaseId, now())
        );
      };
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error);
    });
  } finally {
    db.close();
  }
}

/**
 * Performs get, legacy migration, revision increment and put in one readwrite
 * transaction. IndexedDB serializes these transactions across active and
 * waiting worker connections, preventing lost read-modify-write updates.
 */
export async function updateSWReleaseState(
  {
    openDatabase,
    storeName,
    stateKey,
    legacyStateKey,
    currentReleaseId,
    now = Date.now,
  }: SWReleaseStateStorageOptions,
  patch:
    | SWReleaseStatePatch
    | ((current: SWReleaseState) => SWReleaseStatePatch)
): Promise<SWReleaseState> {
  const db = await openDatabase();
  try {
    return await new Promise<SWReleaseState>((resolve, reject) => {
      const transaction = db.transaction([storeName], 'readwrite');
      const store = transaction.objectStore(storeName);
      let nextState: SWReleaseState | null = null;
      let patchError: unknown = null;

      const writeNextState = (value: unknown) => {
        try {
          const current = normalizeSWReleaseState(
            value,
            currentReleaseId,
            now()
          );
          const nextPatch =
            typeof patch === 'function' ? patch(current) : patch;
          nextState = normalizeSWReleaseState(
            {
              ...current,
              ...nextPatch,
              schemaVersion: SW_RELEASE_STATE_SCHEMA_VERSION,
              revision: current.revision + 1,
              updatedAt: now(),
            },
            currentReleaseId,
            now()
          );
          store.put({
            key: stateKey,
            state: nextState,
          });
        } catch (error) {
          patchError = error;
          transaction.abort();
        }
      };
      const readLegacy = () => {
        const legacyRequest = store.get(legacyStateKey);
        legacyRequest.onerror = () => reject(legacyRequest.error);
        legacyRequest.onsuccess = () => {
          writeNextState(readRecordState(legacyRequest.result));
        };
      };

      const request = store.get(stateKey);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        if (request.result) {
          writeNextState(readRecordState(request.result));
          return;
        }
        readLegacy();
      };
      transaction.oncomplete = () => {
        if (!nextState) {
          reject(new Error('Service Worker release state was not written'));
          return;
        }
        resolve(nextState);
      };
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(patchError || transaction.error);
    });
  } finally {
    db.close();
  }
}
