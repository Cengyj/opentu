export type SWUpgradeState = 'idle' | 'prewarming' | 'ready' | 'committing';

export const SW_RELEASE_STATE_SCHEMA_VERSION = 2 as const;

export interface SWReleaseState {
  schemaVersion: typeof SW_RELEASE_STATE_SCHEMA_VERSION;
  /** Durable ordering authority. Incremented in the same transaction as state. */
  revision: number;
  committedReleaseId: string;
  pendingReleaseId: string | null;
  pendingReadyAt: number | null;
  upgradeState: SWUpgradeState;
  updatedAt: number;
}

interface LegacySWVersionState {
  committedVersion?: unknown;
  pendingVersion?: unknown;
}

type PersistedSWReleaseState = Partial<SWReleaseState> & LegacySWVersionState;

export interface ReleaseManifestIdentity {
  version?: unknown;
  releaseId?: unknown;
}

export interface UpgradeCommitMessage {
  type?: unknown;
  releaseId?: unknown;
  clientReleaseId?: unknown;
  requestId?: unknown;
}

export interface UpgradeCommitRequest {
  type: 'COMMIT_UPGRADE';
  releaseId: string;
  clientReleaseId: string;
  requestId: string;
}

export type UpgradeCommitRejectionReason =
  | 'invalid-source'
  | 'invalid-message'
  | 'release-mismatch'
  | 'client-release-mismatch'
  | 'pending-release-mismatch'
  | 'not-ready'
  | 'already-committed'
  | 'persistence-failed'
  | 'activation-failed';

export interface UpgradeCommitAcknowledgement {
  type: 'SW_UPGRADE_COMMIT_RESULT';
  releaseId: string;
  requestId: string;
  accepted: boolean;
  revision?: number;
  reason?: UpgradeCommitRejectionReason;
}

export const DYNAMIC_IMPORT_RECOVERY_REQUEST_TYPE =
  'SW_RELEASE_STATIC_RECOVERY_REQUEST' as const;
export const DYNAMIC_IMPORT_RECOVERY_RESULT_TYPE =
  'SW_RELEASE_STATIC_RECOVERY_RESULT' as const;

export type DynamicImportRecoveryTarget =
  | {
      kind: 'module';
      moduleKey: string;
    }
  | {
      /**
       * Some browsers report a failed module import without exposing its URL.
       * This target authorizes only a correlated one-time reload; it never
       * authorizes cache invalidation.
       */
      kind: 'reload-only';
    };

export interface DynamicImportRecoveryMessage {
  type?: unknown;
  releaseId?: unknown;
  requestId?: unknown;
  target?: unknown;
}

export interface DynamicImportRecoveryRequest {
  type: typeof DYNAMIC_IMPORT_RECOVERY_REQUEST_TYPE;
  releaseId: string;
  requestId: string;
  target: DynamicImportRecoveryTarget;
}

export type DynamicImportRecoveryRejectionReason =
  | 'invalid-source'
  | 'invalid-request'
  | 'release-mismatch'
  | 'module-not-found'
  | 'invalidation-failed';

export interface DynamicImportRecoveryAcknowledgement {
  type: typeof DYNAMIC_IMPORT_RECOVERY_RESULT_TYPE;
  releaseId: string;
  requestId: string;
  accepted: boolean;
  invalidatedEntries: number;
  reason?: DynamicImportRecoveryRejectionReason;
}

const STATIC_CACHE_PREFIX = 'drawnix-static-v';

const readNonEmptyString = (value: unknown): string | null =>
  typeof value === 'string' && value.trim() ? value.trim() : null;

export function createDefaultSWReleaseState(
  currentReleaseId: string,
  now = Date.now()
): SWReleaseState {
  return {
    schemaVersion: SW_RELEASE_STATE_SCHEMA_VERSION,
    revision: 0,
    committedReleaseId: currentReleaseId,
    pendingReleaseId: null,
    pendingReadyAt: null,
    upgradeState: 'idle',
    updatedAt: now,
  };
}

/**
 * Converts the former display-version state exactly once at the IndexedDB
 * boundary. New writes contain only release identities; legacy field names do
 * not propagate into the runtime upgrade protocol.
 */
export function normalizeSWReleaseState(
  value: unknown,
  currentReleaseId: string,
  now = Date.now()
): SWReleaseState {
  const raw =
    value && typeof value === 'object'
      ? (value as PersistedSWReleaseState)
      : {};
  const committedReleaseId =
    readNonEmptyString(raw.committedReleaseId) ||
    readNonEmptyString(raw.committedVersion) ||
    currentReleaseId;
  const pendingReleaseId =
    readNonEmptyString(raw.pendingReleaseId) ||
    readNonEmptyString(raw.pendingVersion);
  const pendingReadyAt =
    typeof raw.pendingReadyAt === 'number' &&
    Number.isFinite(raw.pendingReadyAt)
      ? raw.pendingReadyAt
      : null;
  const upgradeState: SWUpgradeState =
    raw.upgradeState === 'prewarming' ||
    raw.upgradeState === 'ready' ||
    raw.upgradeState === 'committing'
      ? raw.upgradeState
      : 'idle';
  const revision =
    typeof raw.revision === 'number' &&
    Number.isSafeInteger(raw.revision) &&
    raw.revision >= 0
      ? raw.revision
      : 0;

  return {
    schemaVersion: SW_RELEASE_STATE_SCHEMA_VERSION,
    revision,
    committedReleaseId,
    pendingReleaseId,
    pendingReadyAt,
    upgradeState,
    updatedAt:
      typeof raw.updatedAt === 'number' && Number.isFinite(raw.updatedAt)
        ? raw.updatedAt
        : now,
  };
}

export function manifestMatchesRelease(
  manifest: ReleaseManifestIdentity,
  displayVersion: string,
  releaseId: string
): boolean {
  return (
    manifest.version === displayVersion && manifest.releaseId === releaseId
  );
}

export function getReleaseStaticCacheName(releaseId: string): string {
  return `${STATIC_CACHE_PREFIX}${releaseId}`;
}

export function resolveDynamicImportRecoveryModuleUrl(
  moduleKey: string,
  clientUrl: string,
  serviceWorkerScope: string
): URL | null {
  let moduleUrl: URL;
  try {
    moduleUrl = new URL(moduleKey, clientUrl);
  } catch {
    return null;
  }
  if (
    !isClientURLWithinServiceWorkerScope(
      moduleUrl.toString(),
      serviceWorkerScope
    ) ||
    !/\.(?:js|css)$/i.test(moduleUrl.pathname)
  ) {
    return null;
  }
  return moduleUrl;
}

export function selectDynamicImportRecoveryCacheKeys(
  cacheRequestUrls: readonly string[],
  moduleKey: string,
  clientUrl: string,
  serviceWorkerScope: string
): string[] {
  const moduleUrl = resolveDynamicImportRecoveryModuleUrl(
    moduleKey,
    clientUrl,
    serviceWorkerScope
  );
  if (!moduleUrl) {
    return [];
  }

  return cacheRequestUrls.filter((requestUrl) => {
    try {
      const candidate = new URL(requestUrl);
      return (
        candidate.origin === moduleUrl.origin &&
        candidate.pathname === moduleUrl.pathname
      );
    } catch {
      return false;
    }
  });
}

export function selectRetirableReleaseStaticCaches(
  cacheNames: readonly string[],
  protectedReleaseIds: ReadonlySet<string>
): string[] {
  return cacheNames.filter((cacheName) => {
    if (!cacheName.startsWith(STATIC_CACHE_PREFIX)) {
      return false;
    }
    const releaseId = cacheName.slice(STATIC_CACHE_PREFIX.length);
    return Boolean(releaseId) && !protectedReleaseIds.has(releaseId);
  });
}

interface ReleaseStaticCacheRetirementContext {
  cacheNames: readonly string[];
  committedReleaseId: string;
  pendingReleaseId: string | null;
  liveClientIds: readonly string[];
  clientReleaseOwnership: ReadonlyMap<string, string>;
}

export function selectRetirableReleaseStaticCachesForClients({
  cacheNames,
  committedReleaseId,
  pendingReleaseId,
  liveClientIds,
  clientReleaseOwnership,
}: ReleaseStaticCacheRetirementContext): string[] {
  if (liveClientIds.some((clientId) => !clientReleaseOwnership.has(clientId))) {
    return [];
  }

  const protectedReleaseIds = new Set<string>([
    committedReleaseId,
    ...liveClientIds
      .map((clientId) => clientReleaseOwnership.get(clientId))
      .filter((releaseId): releaseId is string => Boolean(releaseId)),
  ]);
  if (pendingReleaseId) {
    protectedReleaseIds.add(pendingReleaseId);
  }
  return selectRetirableReleaseStaticCaches(cacheNames, protectedReleaseIds);
}

export function resolveStaticRequestReleaseId(
  requestMode: string,
  clientId: string,
  clientReleaseOwnership: ReadonlyMap<string, string>,
  committedReleaseId: string,
  controllingWorkerReleaseId = committedReleaseId
): string {
  if (requestMode === 'navigate') {
    return committedReleaseId;
  }
  return clientReleaseOwnership.get(clientId) || controllingWorkerReleaseId;
}

export function shouldClaimClientsOnReleaseActivate(
  installingReleaseIsUpdate: boolean
): boolean {
  return !installingReleaseIsUpdate;
}

/**
 * A page may ask only for recovery of the release it is actually executing.
 * This prevents an older tab, already controlled by a newer worker, from
 * deleting the newer committed release cache.
 */
export function shouldAcceptDynamicImportRecovery(
  request: DynamicImportRecoveryRequest | null,
  clientReleaseId: string | null
): boolean {
  return (
    request !== null &&
    clientReleaseId !== null &&
    request.releaseId === clientReleaseId
  );
}

export function resolveDynamicImportRecoveryRequest(
  value: unknown
): DynamicImportRecoveryRequest | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }
  const message = value as DynamicImportRecoveryMessage;
  const releaseId = readNonEmptyString(message.releaseId);
  const requestId = readNonEmptyString(message.requestId);
  if (
    message.type !== DYNAMIC_IMPORT_RECOVERY_REQUEST_TYPE ||
    !releaseId ||
    !requestId ||
    !message.target ||
    typeof message.target !== 'object' ||
    Array.isArray(message.target)
  ) {
    return null;
  }

  const rawTarget = message.target as {
    kind?: unknown;
    moduleKey?: unknown;
  };
  let target: DynamicImportRecoveryTarget;
  if (rawTarget.kind === 'module') {
    const moduleKey = readNonEmptyString(rawTarget.moduleKey);
    if (!moduleKey) {
      return null;
    }
    target = { kind: 'module', moduleKey };
  } else if (rawTarget.kind === 'reload-only') {
    target = { kind: 'reload-only' };
  } else {
    return null;
  }

  return {
    type: DYNAMIC_IMPORT_RECOVERY_REQUEST_TYPE,
    releaseId,
    requestId,
    target,
  };
}

export function resolveDynamicImportRecoveryAcknowledgement(
  value: unknown,
  request: DynamicImportRecoveryRequest
): DynamicImportRecoveryAcknowledgement | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }
  const message = value as Partial<DynamicImportRecoveryAcknowledgement>;
  if (
    message.type !== DYNAMIC_IMPORT_RECOVERY_RESULT_TYPE ||
    message.releaseId !== request.releaseId ||
    message.requestId !== request.requestId ||
    typeof message.accepted !== 'boolean' ||
    typeof message.invalidatedEntries !== 'number' ||
    !Number.isSafeInteger(message.invalidatedEntries) ||
    message.invalidatedEntries < 0
  ) {
    return null;
  }

  const allowedReasons: readonly DynamicImportRecoveryRejectionReason[] = [
    'invalid-source',
    'invalid-request',
    'release-mismatch',
    'module-not-found',
    'invalidation-failed',
  ];
  if (
    !message.accepted &&
    (!message.reason || !allowedReasons.includes(message.reason))
  ) {
    return null;
  }
  return {
    type: DYNAMIC_IMPORT_RECOVERY_RESULT_TYPE,
    releaseId: request.releaseId,
    requestId: request.requestId,
    accepted: message.accepted,
    invalidatedEntries: message.invalidatedEntries,
    ...(!message.accepted && message.reason ? { reason: message.reason } : {}),
  };
}

/** CDN package coordinates remain semver-based; a releaseId is never a valid
 * npm package version and must not leak into fallback URLs. */
export function resolveCDNPackageVersion(
  embeddedVersion: string | null,
  displayVersion: string
): string {
  return embeddedVersion || displayVersion;
}

/**
 * The release-aware message is authoritative. The no-releaseId branch is a
 * centralized bridge for already-open pages whose old bootstrap can only send
 * a user-confirmed COMMIT_UPGRADE. It is accepted solely for the currently
 * ready release and can never select another release.
 */
export function shouldAcceptUpgradeCommit(
  message: UpgradeCommitMessage,
  state: SWReleaseState,
  currentReleaseId: string
): boolean {
  return (
    getUpgradeCommitRejectionReason(message, state, currentReleaseId) === null
  );
}

function isExactLegacyUpgradeCommitMessage(
  message: UpgradeCommitMessage
): boolean {
  return (
    message.type === 'COMMIT_UPGRADE' &&
    Object.keys(message as Record<string, unknown>).length === 1
  );
}

export function getUpgradeCommitRejectionReason(
  message: UpgradeCommitMessage,
  state: SWReleaseState,
  currentReleaseId: string
): UpgradeCommitRejectionReason | null {
  if (message.type !== 'COMMIT_UPGRADE') {
    return 'invalid-message';
  }

  const request = resolveUpgradeCommitRequest(message);
  const isLegacyCommit = isExactLegacyUpgradeCommitMessage(message);
  if (!request && !isLegacyCommit) {
    return 'invalid-message';
  }

  if (request && request.releaseId !== currentReleaseId) {
    return 'release-mismatch';
  }

  if (request && request.clientReleaseId !== state.committedReleaseId) {
    return 'client-release-mismatch';
  }

  if (state.committedReleaseId === currentReleaseId) {
    return 'already-committed';
  }
  if (state.pendingReleaseId !== currentReleaseId) {
    return 'pending-release-mismatch';
  }
  if (state.upgradeState === 'ready') {
    return null;
  }
  if (request && state.upgradeState === 'committing') {
    return null;
  }
  return 'not-ready';
}

/**
 * A modern commit may proceed only when the durable first-wins ownership for
 * its source client agrees with the release identity reported in the request.
 * A missing resolution represents a persistence failure. Exact legacy commit
 * messages have no modern request and remain outside this ownership contract.
 */
export function getUpgradeCommitOwnershipRejectionReason(
  request: UpgradeCommitRequest | null,
  resolvedClientReleaseId: string | null
): UpgradeCommitRejectionReason | null {
  if (!request) {
    return null;
  }
  if (!resolvedClientReleaseId) {
    return 'persistence-failed';
  }
  return resolvedClientReleaseId === request.clientReleaseId
    ? null
    : 'client-release-mismatch';
}

export function resolveUpgradeCommitRequest(
  value: unknown
): UpgradeCommitRequest | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }
  const message = value as UpgradeCommitMessage;
  const releaseId = readNonEmptyString(message.releaseId);
  const clientReleaseId = readNonEmptyString(message.clientReleaseId);
  const requestId = readNonEmptyString(message.requestId);
  if (
    message.type !== 'COMMIT_UPGRADE' ||
    !releaseId ||
    !clientReleaseId ||
    !requestId
  ) {
    return null;
  }
  return {
    type: 'COMMIT_UPGRADE',
    releaseId,
    clientReleaseId,
    requestId,
  };
}

export function resolveUpgradeCommitAcknowledgement(
  value: unknown,
  request: UpgradeCommitRequest
): UpgradeCommitAcknowledgement | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }
  const message = value as Partial<UpgradeCommitAcknowledgement>;
  if (
    message.type !== 'SW_UPGRADE_COMMIT_RESULT' ||
    message.releaseId !== request.releaseId ||
    message.requestId !== request.requestId ||
    typeof message.accepted !== 'boolean'
  ) {
    return null;
  }

  if (message.accepted) {
    const revision =
      typeof message.revision === 'number' &&
      Number.isSafeInteger(message.revision) &&
      message.revision >= 0
        ? message.revision
        : null;
    if (revision === null) {
      return null;
    }
    return {
      type: 'SW_UPGRADE_COMMIT_RESULT',
      releaseId: request.releaseId,
      requestId: request.requestId,
      accepted: true,
      revision,
    };
  }

  const allowedReasons: readonly UpgradeCommitRejectionReason[] = [
    'invalid-source',
    'invalid-message',
    'release-mismatch',
    'client-release-mismatch',
    'pending-release-mismatch',
    'not-ready',
    'already-committed',
    'persistence-failed',
    'activation-failed',
  ];
  if (!message.reason || !allowedReasons.includes(message.reason)) {
    return null;
  }
  return {
    type: 'SW_UPGRADE_COMMIT_RESULT',
    releaseId: request.releaseId,
    requestId: request.requestId,
    accepted: false,
    ...(typeof message.revision === 'number' &&
    Number.isSafeInteger(message.revision) &&
    message.revision >= 0
      ? { revision: message.revision }
      : {}),
    reason: message.reason,
  };
}

export function isClientURLWithinServiceWorkerScope(
  clientURL: string,
  serviceWorkerScope: string
): boolean {
  try {
    const client = new URL(clientURL);
    const scope = new URL(serviceWorkerScope);
    if (client.origin !== scope.origin) {
      return false;
    }

    const scopePath = scope.pathname.endsWith('/')
      ? scope.pathname
      : `${scope.pathname}/`;
    const scopeRoot = scopePath === '/' ? '/' : scopePath.slice(0, -1);
    return (
      client.pathname === scopeRoot || client.pathname.startsWith(scopePath)
    );
  } catch {
    return false;
  }
}

interface ReleaseWindowClientDescriptor {
  id: string;
  type: string;
  url: string;
}

export function findTrustedReleaseWindowClient<
  TClient extends ReleaseWindowClientDescriptor
>(
  source: unknown,
  windowClients: readonly TClient[],
  serviceWorkerScope: string
): TClient | null {
  const sourceId =
    source &&
    typeof source === 'object' &&
    'id' in source &&
    typeof source.id === 'string' &&
    source.id.trim()
      ? source.id
      : null;
  if (!sourceId) {
    return null;
  }

  const client = windowClients.find((candidate) => candidate.id === sourceId);
  if (
    !client ||
    client.type !== 'window' ||
    !isClientURLWithinServiceWorkerScope(client.url, serviceWorkerScope)
  ) {
    return null;
  }
  return client;
}
