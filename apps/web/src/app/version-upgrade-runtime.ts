import {
  resolveUpgradeCommitAcknowledgement,
  type UpgradeCommitAcknowledgement,
  type UpgradeCommitRequest,
  type UpgradeCommitRejectionReason,
} from '../sw/release-contract';

export type VersionUpgradePhase =
  | 'idle'
  | 'ready'
  | 'confirming'
  | 'commit-sent'
  | 'activating';

export type VersionUpgradeConfirmationIssue =
  | 'waiting-worker-unavailable'
  | 'commit-delivery-failed'
  | 'commit-acknowledgement-pending'
  | 'commit-rejected';

export interface VersionMetadata {
  version: string;
  releaseId: string;
  changelog?: readonly string[];
}

export interface VersionUpgradeSnapshot {
  revision: number;
  committedReleaseId: string;
  pendingReleaseId: string | null;
  displayVersion: string | null;
  phase: VersionUpgradePhase;
  metadata: VersionMetadata | null;
  confirmationIssue: VersionUpgradeConfirmationIssue | null;
  confirmationRejectionReason: UpgradeCommitRejectionReason | null;
}

export interface VersionMetadataFence {
  pendingReleaseId: string;
  revision: number;
}

export interface AuthoritativeVersionState {
  revision?: number;
  committedReleaseId: string;
  pendingReleaseId: string | null;
  pendingDisplayVersion?: string | null;
  upgradeState: 'idle' | 'prewarming' | 'ready' | 'committing';
  updatedAt?: number;
}

export interface ServiceWorkerVersionStatePayload {
  revision?: number;
  committedReleaseId?: string;
  pendingReleaseId?: string | null;
  /** Legacy Service Worker payload fields. */
  committedVersion?: string;
  pendingVersion?: string | null;
  upgradeState?: 'idle' | 'prewarming' | 'ready' | 'committing';
  appVersion?: string;
  swVersion?: string;
  swReleaseId?: string;
  pendingDisplayVersion?: string | null;
  updatedAt?: number;
}

export interface UpgradeWorker {
  postMessage(message: unknown, transfer?: Transferable[]): void;
}

export type UpgradeCommitResult =
  | 'sent'
  | 'ignored'
  | 'worker-unavailable'
  | 'delivery-failed'
  | 'acknowledgement-pending'
  | 'rejected';

export type UpgradeCommitDelivery = (
  worker: UpgradeWorker,
  request: UpgradeCommitRequest
) => Promise<unknown>;

export interface VersionUpgradeRuntime {
  getSnapshot: () => VersionUpgradeSnapshot;
  subscribe: (listener: () => void) => () => void;
  replacePendingRelease: (
    releaseId: string,
    displayVersion?: string | null
  ) => void;
  applyAuthoritativeState: (state: AuthoritativeVersionState) => void;
  createMetadataFence: () => VersionMetadataFence | null;
  applyMetadata: (
    fence: VersionMetadataFence | null,
    metadata: VersionMetadata
  ) => boolean;
  confirmPendingRelease: (
    releaseId: string,
    resolveWorker: () => Promise<UpgradeWorker | null>,
    deliverCommit: UpgradeCommitDelivery
  ) => Promise<UpgradeCommitResult>;
  claimApprovedActivationReload: (releaseId?: string | null) => boolean;
}

interface VersionUpgradeRuntimeWindow {
  __OPENTU_VERSION_UPGRADE_RUNTIME__?: VersionUpgradeRuntime;
}

const normalizeRequiredIdentity = (value: string, label: string): string => {
  const normalized = value.trim();
  if (!normalized) {
    throw new Error(`${label} must be a non-empty string`);
  }
  return normalized;
};

const normalizeOptionalText = (value?: string | null): string | null => {
  if (typeof value !== 'string') {
    return null;
  }
  const normalized = value.trim();
  return normalized || null;
};

const isUpgradeState = (
  value: unknown
): value is AuthoritativeVersionState['upgradeState'] =>
  value === 'idle' ||
  value === 'prewarming' ||
  value === 'ready' ||
  value === 'committing';

const readNonNegativeSafeInteger = (value: unknown): number | undefined =>
  typeof value === 'number' && Number.isSafeInteger(value) && value >= 0
    ? value
    : undefined;

/**
 * Converts the authoritative SW state message at one compatibility boundary.
 * A channel-only display version deliberately has insufficient identity and is
 * rejected; new pages wait for SW_VERSION_STATE before publishing readiness.
 */
export function resolveServiceWorkerVersionState(
  value: unknown
): AuthoritativeVersionState | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }

  const payload = value as ServiceWorkerVersionStatePayload;
  if (!isUpgradeState(payload.upgradeState)) {
    return null;
  }

  const legacyPendingVersion = normalizeOptionalText(payload.pendingVersion);
  const swReleaseId = normalizeOptionalText(payload.swReleaseId);
  const legacyPendingReleaseId = legacyPendingVersion
    ? swReleaseId || legacyPendingVersion
    : null;
  const committedReleaseId =
    normalizeOptionalText(payload.committedReleaseId) ||
    (!legacyPendingVersion ? swReleaseId : null) ||
    normalizeOptionalText(payload.committedVersion);
  if (!committedReleaseId) {
    return null;
  }

  const hasNewPendingField = Object.prototype.hasOwnProperty.call(
    payload,
    'pendingReleaseId'
  );
  const pendingReleaseId = hasNewPendingField
    ? normalizeOptionalText(payload.pendingReleaseId)
    : legacyPendingReleaseId;
  const updatedAt =
    typeof payload.updatedAt === 'number' && Number.isFinite(payload.updatedAt)
      ? payload.updatedAt
      : undefined;
  const revision = readNonNegativeSafeInteger(payload.revision);

  return {
    ...(revision === undefined ? {} : { revision }),
    committedReleaseId,
    pendingReleaseId,
    pendingDisplayVersion:
      normalizeOptionalText(payload.pendingDisplayVersion) ||
      normalizeOptionalText(payload.appVersion) ||
      normalizeOptionalText(payload.swVersion),
    upgradeState: payload.upgradeState,
    ...(updatedAt === undefined ? {} : { updatedAt }),
  };
}

const freezeMetadata = (metadata: VersionMetadata): VersionMetadata =>
  Object.freeze({
    version: metadata.version,
    releaseId: metadata.releaseId,
    ...(metadata.changelog
      ? { changelog: Object.freeze([...metadata.changelog]) }
      : {}),
  });

const freezeSnapshot = (
  snapshot: VersionUpgradeSnapshot
): VersionUpgradeSnapshot => Object.freeze(snapshot);

interface UpgradeCommitDeliveryOptions {
  timeoutMs?: number;
  createMessageChannel?: () => MessageChannel;
}

class UpgradeCommitDeliveryError extends Error {
  constructor(message: string, readonly commitMayHaveBeenDelivered: boolean) {
    super(message);
    this.name = 'UpgradeCommitDeliveryError';
  }
}

export function postUpgradeCommitWithAcknowledgement(
  worker: UpgradeWorker,
  request: UpgradeCommitRequest,
  {
    timeoutMs = 5000,
    createMessageChannel = () => new MessageChannel(),
  }: UpgradeCommitDeliveryOptions = {}
): Promise<UpgradeCommitAcknowledgement> {
  return new Promise((resolve, reject) => {
    const channel = createMessageChannel();
    let timeout: ReturnType<typeof setTimeout> | null = null;
    let settled = false;

    const cleanup = () => {
      if (timeout !== null) {
        clearTimeout(timeout);
      }
      channel.port1.onmessage = null;
      channel.port1.onmessageerror = null;
      channel.port1.close();
    };
    const rejectOnce = (error: Error) => {
      if (settled) {
        return;
      }
      settled = true;
      cleanup();
      reject(error);
    };

    channel.port1.onmessage = (event: MessageEvent<unknown>) => {
      const acknowledgement = resolveUpgradeCommitAcknowledgement(
        event.data,
        request
      );
      if (!acknowledgement || settled) {
        return;
      }
      settled = true;
      cleanup();
      resolve(acknowledgement);
    };
    channel.port1.onmessageerror = () => {
      rejectOnce(
        new UpgradeCommitDeliveryError(
          'Service Worker commit acknowledgement failed',
          true
        )
      );
    };
    channel.port1.start();

    timeout = setTimeout(() => {
      rejectOnce(
        new UpgradeCommitDeliveryError(
          'Service Worker commit acknowledgement timed out',
          true
        )
      );
    }, timeoutMs);

    try {
      worker.postMessage(request, [channel.port2]);
    } catch (error) {
      rejectOnce(
        new UpgradeCommitDeliveryError(
          error instanceof Error
            ? error.message
            : 'Service Worker commit delivery failed',
          false
        )
      );
    }
  });
}

/**
 * Owns only the current page's version-transition state. Service Worker state
 * remains authoritative; this owner makes that state replayable to deferred UI
 * and fences stale page-local asynchronous work.
 */
export function createVersionUpgradeRuntime(
  initialCommittedReleaseId: string
): VersionUpgradeRuntime {
  const executingReleaseId = normalizeRequiredIdentity(
    initialCommittedReleaseId,
    'initialCommittedReleaseId'
  );
  const listeners = new Set<() => void>();
  const commitAttemptedReleaseIds = new Set<string>();
  const commitSentReleaseIds = new Set<string>();
  let approvedReleaseId: string | null = null;
  let authoritativelyActivatedReleaseId: string | null = null;
  let confirmationDeliveryReleaseId: string | null = null;
  let confirmationSequence = 0;
  let reloadClaimed = false;
  let latestAuthorityRevision: number | null = null;
  let latestAuthorityTimestamp = Number.NEGATIVE_INFINITY;
  let snapshot = freezeSnapshot({
    revision: 0,
    committedReleaseId: executingReleaseId,
    pendingReleaseId: null,
    displayVersion: null,
    phase: 'idle',
    metadata: null,
    confirmationIssue: null,
    confirmationRejectionReason: null,
  });

  const publish = (
    patch: Omit<Partial<VersionUpgradeSnapshot>, 'revision'>
  ): void => {
    snapshot = freezeSnapshot({
      ...snapshot,
      ...patch,
      revision: snapshot.revision + 1,
    });
    listeners.forEach((listener) => listener());
  };

  const replacePendingRelease = (
    releaseId: string,
    displayVersion?: string | null
  ): void => {
    const normalizedReleaseId = normalizeRequiredIdentity(
      releaseId,
      'releaseId'
    );
    if (normalizedReleaseId === snapshot.committedReleaseId) {
      if (snapshot.pendingReleaseId !== null) {
        approvedReleaseId = null;
        authoritativelyActivatedReleaseId = null;
        confirmationDeliveryReleaseId = null;
        reloadClaimed = false;
        publish({
          pendingReleaseId: null,
          displayVersion: null,
          phase: 'idle',
          metadata: null,
          confirmationIssue: null,
          confirmationRejectionReason: null,
        });
      }
      return;
    }

    const normalizedDisplayVersion =
      normalizeOptionalText(displayVersion) || normalizedReleaseId;
    if (snapshot.pendingReleaseId === normalizedReleaseId) {
      if (
        snapshot.displayVersion !== normalizedDisplayVersion &&
        snapshot.metadata === null
      ) {
        publish({ displayVersion: normalizedDisplayVersion });
      }
      return;
    }

    approvedReleaseId = null;
    authoritativelyActivatedReleaseId = null;
    confirmationDeliveryReleaseId = null;
    reloadClaimed = false;
    publish({
      pendingReleaseId: normalizedReleaseId,
      displayVersion: normalizedDisplayVersion,
      phase: 'ready',
      metadata: null,
      confirmationIssue: null,
      confirmationRejectionReason: null,
    });
  };

  const applyAuthoritativeState = (state: AuthoritativeVersionState): void => {
    const authorityRevision = readNonNegativeSafeInteger(state.revision);
    const authorityTimestamp =
      typeof state.updatedAt === 'number' && Number.isFinite(state.updatedAt)
        ? state.updatedAt
        : undefined;
    if (authorityRevision !== undefined) {
      if (
        latestAuthorityRevision !== null &&
        authorityRevision <= latestAuthorityRevision
      ) {
        return;
      }
    } else {
      if (latestAuthorityRevision !== null) {
        return;
      }
      if (
        authorityTimestamp !== undefined &&
        authorityTimestamp <= latestAuthorityTimestamp
      ) {
        return;
      }
    }

    const committedReleaseId = normalizeRequiredIdentity(
      state.committedReleaseId,
      'committedReleaseId'
    );
    const pendingReleaseId = state.pendingReleaseId
      ? normalizeRequiredIdentity(state.pendingReleaseId, 'pendingReleaseId')
      : null;
    const hasReadyPendingRelease =
      pendingReleaseId !== null &&
      pendingReleaseId !== committedReleaseId &&
      (state.upgradeState === 'ready' || state.upgradeState === 'committing');

    if (authorityRevision !== undefined) {
      latestAuthorityRevision = authorityRevision;
    }
    if (authorityTimestamp !== undefined) {
      latestAuthorityTimestamp = Math.max(
        latestAuthorityTimestamp,
        authorityTimestamp
      );
    }

    const markCommitAccepted = (releaseId: string): void => {
      commitAttemptedReleaseIds.add(releaseId);
      commitSentReleaseIds.add(releaseId);
      approvedReleaseId = releaseId;
      confirmationDeliveryReleaseId = null;
      if (snapshot.phase !== 'commit-sent') {
        publish({
          phase: 'commit-sent',
          confirmationIssue: null,
          confirmationRejectionReason: null,
        });
      }
    };

    if (hasReadyPendingRelease) {
      if (snapshot.committedReleaseId !== committedReleaseId) {
        publish({ committedReleaseId });
      }
      replacePendingRelease(
        pendingReleaseId,
        state.pendingDisplayVersion || undefined
      );
      return;
    }

    if (
      confirmationDeliveryReleaseId !== null &&
      snapshot.pendingReleaseId === confirmationDeliveryReleaseId &&
      committedReleaseId === confirmationDeliveryReleaseId
    ) {
      markCommitAccepted(confirmationDeliveryReleaseId);
    }

    const approvedTransitionIsActivating =
      approvedReleaseId !== null &&
      snapshot.pendingReleaseId === approvedReleaseId &&
      (snapshot.phase === 'commit-sent' || snapshot.phase === 'activating') &&
      (state.upgradeState === 'committing' ||
        committedReleaseId === approvedReleaseId);

    if (approvedTransitionIsActivating) {
      if (committedReleaseId === approvedReleaseId) {
        authoritativelyActivatedReleaseId = approvedReleaseId;
      }
      publish({
        committedReleaseId,
        phase: 'activating',
        confirmationIssue: null,
        confirmationRejectionReason: null,
      });
      return;
    }

    approvedReleaseId = null;
    authoritativelyActivatedReleaseId = null;
    confirmationDeliveryReleaseId = null;
    reloadClaimed = false;
    if (
      snapshot.pendingReleaseId !== null ||
      snapshot.committedReleaseId !== committedReleaseId ||
      snapshot.phase !== 'idle'
    ) {
      publish({
        committedReleaseId,
        pendingReleaseId: null,
        displayVersion: null,
        phase: 'idle',
        metadata: null,
        confirmationIssue: null,
        confirmationRejectionReason: null,
      });
    }
  };

  const createMetadataFence = (): VersionMetadataFence | null =>
    snapshot.pendingReleaseId
      ? Object.freeze({
          pendingReleaseId: snapshot.pendingReleaseId,
          revision: snapshot.revision,
        })
      : null;

  const applyMetadata = (
    fence: VersionMetadataFence | null,
    metadata: VersionMetadata
  ): boolean => {
    if (
      !fence ||
      snapshot.pendingReleaseId !== fence.pendingReleaseId ||
      snapshot.revision !== fence.revision ||
      metadata.releaseId !== fence.pendingReleaseId
    ) {
      return false;
    }

    const normalizedVersion = normalizeRequiredIdentity(
      metadata.version,
      'metadata.version'
    );
    const frozenMetadata = freezeMetadata({
      version: normalizedVersion,
      releaseId: fence.pendingReleaseId,
      ...(metadata.changelog ? { changelog: metadata.changelog } : {}),
    });
    publish({
      displayVersion: normalizedVersion,
      metadata: frozenMetadata,
    });
    return true;
  };

  const restoreRetryableConfirmation = (
    releaseId: string,
    issue: VersionUpgradeConfirmationIssue,
    rejectionReason: UpgradeCommitRejectionReason | null = null
  ): void => {
    if (
      snapshot.pendingReleaseId === releaseId &&
      snapshot.phase === 'confirming'
    ) {
      confirmationDeliveryReleaseId = null;
      publish({
        phase: 'ready',
        confirmationIssue: issue,
        confirmationRejectionReason: rejectionReason,
      });
    }
  };

  const isCurrentConfirmation = (releaseId: string): boolean =>
    snapshot.pendingReleaseId === releaseId &&
    snapshot.phase === 'confirming' &&
    !commitAttemptedReleaseIds.has(releaseId);

  const confirmPendingRelease = async (
    releaseId: string,
    resolveWorker: () => Promise<UpgradeWorker | null>,
    deliverCommit: UpgradeCommitDelivery
  ): Promise<UpgradeCommitResult> => {
    const normalizedReleaseId = normalizeRequiredIdentity(
      releaseId,
      'releaseId'
    );
    if (
      snapshot.pendingReleaseId !== normalizedReleaseId ||
      snapshot.phase !== 'ready' ||
      commitAttemptedReleaseIds.has(normalizedReleaseId)
    ) {
      return 'ignored';
    }

    publish({
      phase: 'confirming',
      confirmationIssue: null,
      confirmationRejectionReason: null,
    });

    let worker: UpgradeWorker | null;
    try {
      worker = await resolveWorker();
    } catch {
      restoreRetryableConfirmation(
        normalizedReleaseId,
        'waiting-worker-unavailable'
      );
      return 'worker-unavailable';
    }

    if (!isCurrentConfirmation(normalizedReleaseId)) {
      return 'ignored';
    }

    if (!worker) {
      restoreRetryableConfirmation(
        normalizedReleaseId,
        'waiting-worker-unavailable'
      );
      return 'worker-unavailable';
    }

    const request: UpgradeCommitRequest = {
      type: 'COMMIT_UPGRADE',
      releaseId: normalizedReleaseId,
      clientReleaseId: executingReleaseId,
      requestId: `${normalizedReleaseId}:${++confirmationSequence}`,
    };
    confirmationDeliveryReleaseId = normalizedReleaseId;

    let acknowledgement: UpgradeCommitAcknowledgement | null = null;
    try {
      const value = await deliverCommit(worker, request);
      acknowledgement = resolveUpgradeCommitAcknowledgement(value, request);
    } catch (error) {
      if (
        approvedReleaseId === normalizedReleaseId &&
        commitSentReleaseIds.has(normalizedReleaseId)
      ) {
        return 'sent';
      }

      if (
        error instanceof UpgradeCommitDeliveryError &&
        !error.commitMayHaveBeenDelivered
      ) {
        restoreRetryableConfirmation(
          normalizedReleaseId,
          'commit-delivery-failed'
        );
        return 'delivery-failed';
      }

      // Once postMessage has returned successfully, a missing ACK is
      // ambiguous: the worker may already have committed and activated. Keep
      // the original request as the sole attempt and converge from
      // SW_VERSION_STATE instead of generating a second requestId/post.
      commitAttemptedReleaseIds.add(normalizedReleaseId);
      publish({
        phase: 'commit-sent',
        confirmationIssue: 'commit-acknowledgement-pending',
        confirmationRejectionReason: null,
      });
      return 'acknowledgement-pending';
    }

    if (!acknowledgement) {
      commitAttemptedReleaseIds.add(normalizedReleaseId);
      publish({
        phase: 'commit-sent',
        confirmationIssue: 'commit-acknowledgement-pending',
        confirmationRejectionReason: null,
      });
      return 'acknowledgement-pending';
    }

    if (
      approvedReleaseId === normalizedReleaseId &&
      commitSentReleaseIds.has(normalizedReleaseId)
    ) {
      return 'sent';
    }
    if (!isCurrentConfirmation(normalizedReleaseId)) {
      return 'ignored';
    }
    if (!acknowledgement.accepted) {
      restoreRetryableConfirmation(
        normalizedReleaseId,
        'commit-rejected',
        acknowledgement.reason
      );
      return 'rejected';
    }

    commitAttemptedReleaseIds.add(normalizedReleaseId);
    commitSentReleaseIds.add(normalizedReleaseId);
    approvedReleaseId = normalizedReleaseId;
    confirmationDeliveryReleaseId = null;
    publish({
      phase: 'commit-sent',
      confirmationIssue: null,
      confirmationRejectionReason: null,
    });
    return 'sent';
  };

  const claimApprovedActivationReload = (
    releaseId?: string | null
  ): boolean => {
    const normalizedReleaseId = normalizeOptionalText(releaseId);
    if (
      reloadClaimed ||
      normalizedReleaseId === null ||
      !approvedReleaseId ||
      authoritativelyActivatedReleaseId !== approvedReleaseId ||
      snapshot.committedReleaseId !== approvedReleaseId ||
      snapshot.pendingReleaseId !== approvedReleaseId ||
      normalizedReleaseId !== approvedReleaseId ||
      (snapshot.phase !== 'commit-sent' && snapshot.phase !== 'activating')
    ) {
      return false;
    }

    reloadClaimed = true;
    if (snapshot.phase !== 'activating') {
      publish({ phase: 'activating' });
    }
    return true;
  };

  return {
    getSnapshot: () => snapshot,
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    replacePendingRelease,
    applyAuthoritativeState,
    createMetadataFence,
    applyMetadata,
    confirmPendingRelease,
    claimApprovedActivationReload,
  };
}

/**
 * Reconciles activation and acknowledgement channels without depending on
 * their delivery order. The runtime owns the one-shot claim, so duplicate
 * controller, channel and authoritative-state signals still schedule exactly
 * one reload.
 */
export function subscribeToApprovedActivationReload(
  runtime: VersionUpgradeRuntime,
  onReloadApproved: (releaseId: string) => void
): () => void {
  const reconcile = () => {
    const current = runtime.getSnapshot();
    if (
      current.phase === 'activating' &&
      runtime.claimApprovedActivationReload(current.committedReleaseId)
    ) {
      onReloadApproved(current.committedReleaseId);
    }
  };

  const unsubscribe = runtime.subscribe(reconcile);
  reconcile();
  return unsubscribe;
}

export function installVersionUpgradeRuntime(
  targetWindow: Window,
  initialCommittedReleaseId: string
): VersionUpgradeRuntime {
  const runtimeWindow = targetWindow as Window & VersionUpgradeRuntimeWindow;
  const existing = runtimeWindow.__OPENTU_VERSION_UPGRADE_RUNTIME__;
  if (existing) {
    return existing;
  }

  const runtime = createVersionUpgradeRuntime(initialCommittedReleaseId);
  runtimeWindow.__OPENTU_VERSION_UPGRADE_RUNTIME__ = runtime;
  return runtime;
}

interface VersionMetadataFetchOptions {
  pendingReleaseId: string;
  baseUrl: string;
  expectedOrigin?: string;
  fetcher?: typeof fetch;
}

const parseVersionMetadata = (
  value: unknown,
  pendingReleaseId: string
): VersionMetadata => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('version metadata must be an object');
  }

  const record = value as Record<string, unknown>;
  if (typeof record.version !== 'string' || !record.version.trim()) {
    throw new Error('version metadata has no valid version');
  }
  if (typeof record.releaseId !== 'string' || !record.releaseId.trim()) {
    throw new Error('version metadata has no valid releaseId');
  }

  const releaseId = record.releaseId.trim();
  if (releaseId !== pendingReleaseId) {
    throw new Error('version metadata does not match the pending release');
  }
  if (
    record.changelog !== undefined &&
    (!Array.isArray(record.changelog) ||
      !record.changelog.every((entry) => typeof entry === 'string'))
  ) {
    throw new Error('version metadata has an invalid changelog');
  }

  return freezeMetadata({
    version: record.version.trim(),
    releaseId,
    ...(record.changelog ? { changelog: record.changelog as string[] } : {}),
  });
};

export async function fetchVersionMetadata({
  pendingReleaseId,
  baseUrl,
  expectedOrigin,
  fetcher = fetch,
}: VersionMetadataFetchOptions): Promise<VersionMetadata> {
  const normalizedPendingReleaseId = normalizeRequiredIdentity(
    pendingReleaseId,
    'pendingReleaseId'
  );
  const scopeUrl = new URL(baseUrl);
  if (!scopeUrl.pathname.endsWith('/')) {
    scopeUrl.pathname = `${scopeUrl.pathname}/`;
  }
  const authoritativeOrigin = expectedOrigin || scopeUrl.origin;
  if (scopeUrl.origin !== authoritativeOrigin) {
    throw new Error('version metadata scope must be same-origin');
  }

  const requestUrl = new URL('version.json', scopeUrl);
  if (requestUrl.origin !== authoritativeOrigin) {
    throw new Error('version metadata URL must be same-origin');
  }

  const response = await fetcher(requestUrl.toString(), {
    cache: 'no-store',
    credentials: 'same-origin',
    headers: { Accept: 'application/json' },
  });
  if (!response.ok) {
    throw new Error(`version metadata request failed (${response.status})`);
  }

  if (!response.url) {
    throw new Error('version metadata response URL is unavailable');
  }
  const responseUrl = new URL(response.url);
  if (responseUrl.origin !== authoritativeOrigin) {
    throw new Error('version metadata response is not same-origin');
  }

  return parseVersionMetadata(
    await response.json(),
    normalizedPendingReleaseId
  );
}
