import { describe, expect, it, vi } from 'vitest';

import type { SWReleaseState, UpgradeCommitMessage } from './release-contract';
import { executeUpgradeCommit } from './upgrade-commit-coordinator';

const readyState = (revision = 7): SWReleaseState => ({
  schemaVersion: 2,
  revision,
  committedReleaseId: 'release-current',
  pendingReleaseId: 'release-next',
  pendingReadyAt: 100,
  upgradeState: 'ready',
  updatedAt: 100,
});

const message: UpgradeCommitMessage = {
  type: 'COMMIT_UPGRADE',
  releaseId: 'release-next',
  clientReleaseId: 'release-current',
  requestId: 'request-1',
};

const createStateUpdater = (initial: SWReleaseState) => {
  let state = initial;
  return async (
    patch:
      | Partial<SWReleaseState>
      | ((current: SWReleaseState) => Partial<SWReleaseState>)
  ): Promise<SWReleaseState> => {
    const nextPatch = typeof patch === 'function' ? patch(state) : patch;
    state = {
      ...state,
      ...nextPatch,
      revision: state.revision + 1,
      updatedAt: state.updatedAt + 1,
    };
    return state;
  };
};

describe('Service Worker upgrade commit coordinator', () => {
  it('does not call skipWaiting when committing state cannot be persisted', async () => {
    const skipWaiting = vi.fn(async () => undefined);

    await expect(
      executeUpgradeCommit({
        message,
        currentReleaseId: 'release-next',
        initialRevision: 7,
        updateState: async () => {
          throw new Error('IndexedDB unavailable');
        },
        publishState: async () => undefined,
        skipWaiting,
      })
    ).resolves.toEqual({
      accepted: false,
      revision: 7,
      reason: 'persistence-failed',
    });
    expect(skipWaiting).not.toHaveBeenCalled();
  });

  it('revalidates readiness inside the state write transaction', async () => {
    const skipWaiting = vi.fn(async () => undefined);
    const updateState = createStateUpdater({
      ...readyState(8),
      upgradeState: 'prewarming',
    });

    await expect(
      executeUpgradeCommit({
        message,
        currentReleaseId: 'release-next',
        initialRevision: 7,
        updateState,
        publishState: async () => undefined,
        skipWaiting,
      })
    ).resolves.toEqual({
      accepted: false,
      revision: 7,
      reason: 'not-ready',
    });
    expect(skipWaiting).not.toHaveBeenCalled();
  });

  it('publishes durable committing state only after one successful skipWaiting call', async () => {
    const calls: string[] = [];
    const updateState = createStateUpdater(readyState());

    await expect(
      executeUpgradeCommit({
        message,
        currentReleaseId: 'release-next',
        initialRevision: 7,
        updateState,
        publishState: async (state) => {
          calls.push(`publish:${state.upgradeState}:${state.revision}`);
        },
        skipWaiting: async () => {
          calls.push('skipWaiting');
        },
      })
    ).resolves.toEqual({
      accepted: true,
      revision: 8,
    });
    expect(calls).toEqual(['skipWaiting', 'publish:committing:8']);
  });

  it('restores ready state and returns a NACK when activation fails', async () => {
    const publishedStates: SWReleaseState[] = [];
    const updateState = createStateUpdater(readyState());

    await expect(
      executeUpgradeCommit({
        message,
        currentReleaseId: 'release-next',
        initialRevision: 7,
        updateState,
        publishState: async (state) => {
          publishedStates.push(state);
        },
        skipWaiting: async () => {
          throw new Error('activation rejected');
        },
        now: () => 300,
      })
    ).resolves.toEqual({
      accepted: false,
      revision: 9,
      reason: 'activation-failed',
    });
    expect(publishedStates).toHaveLength(1);
    expect(publishedStates[0]).toMatchObject({
      revision: 9,
      upgradeState: 'ready',
      pendingReadyAt: 300,
    });
  });
});
