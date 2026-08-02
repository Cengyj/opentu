import {
  getUpgradeCommitRejectionReason,
  type SWReleaseState,
  type UpgradeCommitMessage,
  type UpgradeCommitRejectionReason,
} from './release-contract';

type ReleaseStatePatch = Partial<
  Pick<
    SWReleaseState,
    | 'committedReleaseId'
    | 'pendingReleaseId'
    | 'pendingReadyAt'
    | 'upgradeState'
  >
>;

type UpdateReleaseState = (
  patch: ReleaseStatePatch | ((current: SWReleaseState) => ReleaseStatePatch)
) => Promise<SWReleaseState>;

interface ExecuteUpgradeCommitOptions {
  message: UpgradeCommitMessage;
  currentReleaseId: string;
  initialRevision: number;
  updateState: UpdateReleaseState;
  publishState: (state: SWReleaseState) => Promise<void>;
  skipWaiting: () => Promise<void>;
  now?: () => number;
}

export interface UpgradeCommitAttemptResult {
  accepted: boolean;
  revision: number;
  reason?: UpgradeCommitRejectionReason;
}

/**
 * Commits a waiting release only after the ready-state predicate is checked
 * inside the same transaction that writes `committing`. Persistence failure
 * and activation failure both return a NACK result; neither can be mistaken
 * for an accepted upgrade.
 */
export async function executeUpgradeCommit({
  message,
  currentReleaseId,
  initialRevision,
  updateState,
  publishState,
  skipWaiting,
  now = Date.now,
}: ExecuteUpgradeCommitOptions): Promise<UpgradeCommitAttemptResult> {
  let transactionRejection: UpgradeCommitRejectionReason | null = null;
  let committingState: SWReleaseState;
  try {
    committingState = await updateState((current) => {
      transactionRejection = getUpgradeCommitRejectionReason(
        message,
        current,
        currentReleaseId
      );
      if (transactionRejection) {
        throw new Error(`Upgrade commit rejected: ${transactionRejection}`);
      }
      return {
        committedReleaseId: current.committedReleaseId,
        pendingReleaseId: currentReleaseId,
        pendingReadyAt: null,
        upgradeState: 'committing',
      };
    });
  } catch {
    return {
      accepted: false,
      revision: initialRevision,
      reason: transactionRejection || 'persistence-failed',
    };
  }

  try {
    await skipWaiting();
  } catch {
    let restoredState = committingState;
    try {
      restoredState = await updateState((current) =>
        current.pendingReleaseId === currentReleaseId &&
        current.committedReleaseId !== currentReleaseId &&
        current.upgradeState === 'committing'
          ? {
              pendingReleaseId: currentReleaseId,
              pendingReadyAt: now(),
              upgradeState: 'ready',
            }
          : {}
      );
      await publishState(restoredState);
    } catch {
      // The persisted committing state remains authoritative. A later
      // revisioned read can reconcile it; this attempt is still a NACK.
    }
    return {
      accepted: false,
      revision: restoredState.revision,
      reason: 'activation-failed',
    };
  }

  try {
    await publishState(committingState);
  } catch {
    // The dedicated ACK still carries the durable revision. Broadcast is a
    // convergence aid and cannot undo an already accepted skipWaiting call.
  }

  return {
    accepted: true,
    revision: committingState.revision,
  };
}
