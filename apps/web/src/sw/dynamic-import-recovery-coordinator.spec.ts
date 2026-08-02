import { describe, expect, it, vi } from 'vitest';

import type { DynamicImportRecoveryRequest } from './release-contract';
import {
  createCompletedDynamicImportRecoveryResult,
  DynamicImportRecoveryCoordinator,
  getDynamicImportRecoveryAttemptKey,
} from './dynamic-import-recovery-coordinator';

const request: DynamicImportRecoveryRequest = {
  type: 'SW_RELEASE_STATIC_RECOVERY_REQUEST',
  releaseId: 'release-a',
  requestId: 'recovery-1',
  target: { kind: 'module', moduleKey: '/assets/editor.js' },
};

describe('dynamic import recovery coordinator', () => {
  it('shares one slow invalidation across repeated delivery attempts', async () => {
    let finishInvalidation:
      | ((value: { accepted: boolean; invalidatedEntries: number }) => void)
      | undefined;
    const invalidation = new Promise<{
      accepted: boolean;
      invalidatedEntries: number;
    }>((resolve) => {
      finishInvalidation = resolve;
    });
    const invalidate = vi.fn(() => invalidation);
    const coordinator = new DynamicImportRecoveryCoordinator();
    const attemptKey = getDynamicImportRecoveryAttemptKey('client-a', request);

    const firstDelivery = coordinator.execute(attemptKey, invalidate);
    const repeatedDelivery = coordinator.execute(attemptKey, invalidate);
    finishInvalidation?.({ accepted: true, invalidatedEntries: 1 });

    await expect(firstDelivery).resolves.toEqual({
      accepted: true,
      invalidatedEntries: 1,
    });
    await expect(repeatedDelivery).resolves.toEqual({
      accepted: true,
      invalidatedEntries: 1,
    });
    expect(invalidate).toHaveBeenCalledTimes(1);
  });

  it('replays a settled acknowledgement when the first ACK was lost', async () => {
    const invalidate = vi.fn(async () => ({
      accepted: true,
      invalidatedEntries: 1,
    }));
    const coordinator = new DynamicImportRecoveryCoordinator();
    const attemptKey = getDynamicImportRecoveryAttemptKey('client-a', request);

    await coordinator.execute(attemptKey, invalidate);
    await expect(coordinator.execute(attemptKey, invalidate)).resolves.toEqual({
      accepted: true,
      invalidatedEntries: 1,
    });
    expect(invalidate).toHaveBeenCalledTimes(1);
  });

  it('treats an already absent module as completed after a worker restart', async () => {
    const firstWorker = new DynamicImportRecoveryCoordinator();
    const restartedWorker = new DynamicImportRecoveryCoordinator();
    const attemptKey = getDynamicImportRecoveryAttemptKey('client-a', request);

    await expect(
      firstWorker.execute(attemptKey, async () =>
        createCompletedDynamicImportRecoveryResult(1)
      )
    ).resolves.toEqual({ accepted: true, invalidatedEntries: 1 });
    await expect(
      restartedWorker.execute(attemptKey, async () =>
        createCompletedDynamicImportRecoveryResult(0)
      )
    ).resolves.toEqual({ accepted: true, invalidatedEntries: 0 });
  });

  it('does not share recovery results across clients or request identities', async () => {
    const invalidate = vi.fn(async () => ({
      accepted: true,
      invalidatedEntries: 1,
    }));
    const coordinator = new DynamicImportRecoveryCoordinator();

    await coordinator.execute(
      getDynamicImportRecoveryAttemptKey('client-a', request),
      invalidate
    );
    await coordinator.execute(
      getDynamicImportRecoveryAttemptKey('client-b', request),
      invalidate
    );
    await coordinator.execute(
      getDynamicImportRecoveryAttemptKey('client-a', {
        ...request,
        requestId: 'recovery-2',
      }),
      invalidate
    );

    expect(invalidate).toHaveBeenCalledTimes(3);
  });
});
