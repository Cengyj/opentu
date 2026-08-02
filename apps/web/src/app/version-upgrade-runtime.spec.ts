// @vitest-environment jsdom

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  createVersionUpgradeRuntime,
  fetchVersionMetadata,
  postUpgradeCommitWithAcknowledgement,
  resolveServiceWorkerVersionState,
  subscribeToApprovedActivationReload,
  type UpgradeCommitDelivery,
} from './version-upgrade-runtime';

const acknowledgeCommit: UpgradeCommitDelivery = async (worker, request) => {
  worker.postMessage(request);
  return {
    type: 'SW_UPGRADE_COMMIT_RESULT',
    requestId: request.requestId,
    releaseId: request.releaseId,
    accepted: true,
    revision: 1,
  };
};

describe('version upgrade page runtime', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('replays readiness to late subscribers and applies authoritative replace and clear', () => {
    const runtime = createVersionUpgradeRuntime('release-current');

    runtime.replacePendingRelease('release-a', '1.0.3');
    const readyRevision = runtime.getSnapshot().revision;
    const listener = vi.fn();
    const unsubscribe = runtime.subscribe(listener);

    expect(runtime.getSnapshot()).toMatchObject({
      committedReleaseId: 'release-current',
      pendingReleaseId: 'release-a',
      displayVersion: '1.0.3',
      phase: 'ready',
    });

    runtime.applyAuthoritativeState({
      committedReleaseId: 'release-current',
      pendingReleaseId: 'release-b',
      pendingDisplayVersion: '1.0.4',
      upgradeState: 'ready',
      updatedAt: 20,
    });

    expect(listener).toHaveBeenCalledTimes(1);
    expect(runtime.getSnapshot()).toMatchObject({
      pendingReleaseId: 'release-b',
      displayVersion: '1.0.4',
      phase: 'ready',
    });
    expect(runtime.getSnapshot().revision).toBeGreaterThan(readyRevision);

    runtime.applyAuthoritativeState({
      committedReleaseId: 'release-b',
      pendingReleaseId: null,
      upgradeState: 'idle',
      updatedAt: 30,
    });

    expect(runtime.getSnapshot()).toMatchObject({
      committedReleaseId: 'release-b',
      pendingReleaseId: null,
      displayVersion: null,
      phase: 'idle',
    });
    unsubscribe();
  });

  it('rejects stale authoritative messages and stale metadata results', () => {
    const runtime = createVersionUpgradeRuntime('release-current');
    runtime.applyAuthoritativeState({
      committedReleaseId: 'release-current',
      pendingReleaseId: 'release-a',
      pendingDisplayVersion: '1.0.3',
      upgradeState: 'ready',
      updatedAt: 20,
    });
    const staleFence = runtime.createMetadataFence();

    runtime.applyAuthoritativeState({
      committedReleaseId: 'release-current',
      pendingReleaseId: 'release-b',
      pendingDisplayVersion: '1.0.4',
      upgradeState: 'ready',
      updatedAt: 30,
    });

    expect(
      runtime.applyMetadata(staleFence, {
        releaseId: 'release-a',
        version: '1.0.3',
        changelog: ['stale'],
      })
    ).toBe(false);

    runtime.applyAuthoritativeState({
      committedReleaseId: 'release-current',
      pendingReleaseId: null,
      upgradeState: 'idle',
      updatedAt: 10,
    });

    expect(runtime.getSnapshot().pendingReleaseId).toBe('release-b');
  });

  it('does not let an equal-timestamp authority message regress committed state', () => {
    const runtime = createVersionUpgradeRuntime('release-a');

    runtime.applyAuthoritativeState({
      committedReleaseId: 'release-b',
      pendingReleaseId: null,
      upgradeState: 'idle',
      updatedAt: 100,
    });
    runtime.applyAuthoritativeState({
      committedReleaseId: 'release-a',
      pendingReleaseId: 'release-b',
      pendingDisplayVersion: '1.0.3',
      upgradeState: 'ready',
      updatedAt: 100,
    });

    expect(runtime.getSnapshot()).toMatchObject({
      committedReleaseId: 'release-b',
      pendingReleaseId: null,
      phase: 'idle',
    });
  });

  it('uses durable authority revision before timestamps and legacy messages', () => {
    const runtime = createVersionUpgradeRuntime('release-a');

    runtime.applyAuthoritativeState({
      revision: 8,
      committedReleaseId: 'release-b',
      pendingReleaseId: null,
      upgradeState: 'idle',
      updatedAt: 100,
    });
    runtime.applyAuthoritativeState({
      revision: 7,
      committedReleaseId: 'release-a',
      pendingReleaseId: 'release-b',
      upgradeState: 'ready',
      updatedAt: 200,
    });
    runtime.applyAuthoritativeState({
      committedReleaseId: 'release-a',
      pendingReleaseId: 'release-b',
      upgradeState: 'ready',
      updatedAt: 300,
    });
    runtime.applyAuthoritativeState({
      revision: 8,
      committedReleaseId: 'release-a',
      pendingReleaseId: 'release-b',
      upgradeState: 'ready',
      updatedAt: 400,
    });

    expect(runtime.getSnapshot()).toMatchObject({
      committedReleaseId: 'release-b',
      pendingReleaseId: null,
      phase: 'idle',
    });
  });

  it('posts one commit for concurrent confirmations of the same release', async () => {
    const runtime = createVersionUpgradeRuntime('release-current');
    runtime.replacePendingRelease('release-a', '1.0.3');
    const worker = { postMessage: vi.fn() };
    let resolveWorker: ((worker: typeof worker) => void) | undefined;
    const workerPromise = new Promise<typeof worker>((resolve) => {
      resolveWorker = resolve;
    });

    const first = runtime.confirmPendingRelease(
      'release-a',
      () => workerPromise,
      acknowledgeCommit
    );
    const duplicate = await runtime.confirmPendingRelease(
      'release-a',
      async () => worker,
      acknowledgeCommit
    );
    resolveWorker?.(worker);

    expect(await first).toBe('sent');
    expect(duplicate).toBe('ignored');
    expect(worker.postMessage).toHaveBeenCalledTimes(1);
    expect(worker.postMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'COMMIT_UPGRADE',
        releaseId: 'release-a',
        clientReleaseId: 'release-current',
        requestId: expect.any(String),
      })
    );
    expect(runtime.getSnapshot().phase).toBe('commit-sent');
  });

  it('keeps a missing waiting worker retryable without reporting a commit', async () => {
    const runtime = createVersionUpgradeRuntime('release-current');
    runtime.replacePendingRelease('release-a', '1.0.3');

    await expect(
      runtime.confirmPendingRelease(
        'release-a',
        async () => null,
        acknowledgeCommit
      )
    ).resolves.toBe('worker-unavailable');
    expect(runtime.getSnapshot()).toMatchObject({
      pendingReleaseId: 'release-a',
      phase: 'ready',
      confirmationIssue: 'waiting-worker-unavailable',
    });

    const worker = { postMessage: vi.fn() };
    await expect(
      runtime.confirmPendingRelease(
        'release-a',
        async () => worker,
        acknowledgeCommit
      )
    ).resolves.toBe('sent');
    expect(worker.postMessage).toHaveBeenCalledTimes(1);
  });

  it('keeps a synchronously failed post retryable because no commit was delivered', async () => {
    const runtime = createVersionUpgradeRuntime('release-current');
    runtime.replacePendingRelease('release-a', '1.0.3');
    const unavailableWorker = {
      postMessage: vi.fn(() => {
        throw new Error('worker became redundant before post');
      }),
    };

    await expect(
      runtime.confirmPendingRelease(
        'release-a',
        async () => unavailableWorker,
        postUpgradeCommitWithAcknowledgement
      )
    ).resolves.toBe('delivery-failed');
    expect(runtime.getSnapshot()).toMatchObject({
      pendingReleaseId: 'release-a',
      phase: 'ready',
      confirmationIssue: 'commit-delivery-failed',
    });

    const replacementWorker = { postMessage: vi.fn() };
    await expect(
      runtime.confirmPendingRelease(
        'release-a',
        async () => replacementWorker,
        acknowledgeCommit
      )
    ).resolves.toBe('sent');
    expect(replacementWorker.postMessage).toHaveBeenCalledTimes(1);
  });

  it('keeps an explicitly rejected commit retryable until the worker acknowledges it', async () => {
    const runtime = createVersionUpgradeRuntime('release-current');
    runtime.replacePendingRelease('release-a', '1.0.3');
    const worker = { postMessage: vi.fn() };
    const rejectDelivery: UpgradeCommitDelivery = async (_target, request) => ({
      type: 'SW_UPGRADE_COMMIT_RESULT',
      requestId: request.requestId,
      releaseId: request.releaseId,
      accepted: false,
      reason: 'not-ready',
    });

    await expect(
      runtime.confirmPendingRelease(
        'release-a',
        async () => worker,
        rejectDelivery
      )
    ).resolves.toBe('rejected');
    expect(runtime.getSnapshot()).toMatchObject({
      pendingReleaseId: 'release-a',
      phase: 'ready',
      confirmationIssue: 'commit-rejected',
    });

    const acceptDelivery: UpgradeCommitDelivery = async (_target, request) => ({
      type: 'SW_UPGRADE_COMMIT_RESULT',
      requestId: request.requestId,
      releaseId: request.releaseId,
      accepted: true,
      revision: 2,
    });
    await expect(
      runtime.confirmPendingRelease(
        'release-a',
        async () => worker,
        acceptDelivery
      )
    ).resolves.toBe('sent');
    expect(runtime.getSnapshot().phase).toBe('commit-sent');
  });

  it('correlates the commit acknowledgement through a dedicated message channel', async () => {
    const request = {
      type: 'COMMIT_UPGRADE' as const,
      releaseId: 'release-a',
      clientReleaseId: 'release-current',
      requestId: 'request-1',
    };
    const worker = {
      postMessage: vi.fn((message: unknown, transfer: Transferable[] = []) => {
        const replyPort = transfer[0] as MessagePort;
        const sentRequest = message as typeof request;
        replyPort.postMessage({
          type: 'SW_UPGRADE_COMMIT_RESULT',
          releaseId: sentRequest.releaseId,
          requestId: sentRequest.requestId,
          accepted: true,
          revision: 9,
        });
      }),
    };

    await expect(
      postUpgradeCommitWithAcknowledgement(worker, request, {
        timeoutMs: 1000,
      })
    ).resolves.toMatchObject({
      accepted: true,
      revision: 9,
    });
    expect(worker.postMessage).toHaveBeenCalledWith(request, [
      expect.any(MessagePort),
    ]);
  });

  it('ignores a late acknowledgement after the pending release was replaced', async () => {
    const runtime = createVersionUpgradeRuntime('release-current');
    runtime.replacePendingRelease('release-a', '1.0.3');
    let acknowledge:
      | ((value: {
          type: 'SW_UPGRADE_COMMIT_RESULT';
          requestId: string;
          releaseId: string;
          accepted: true;
          revision: number;
        }) => void)
      | null = null;
    let requestId = '';
    const delivery: UpgradeCommitDelivery = async (_worker, request) => {
      requestId = request.requestId;
      return await new Promise((resolve) => {
        acknowledge = resolve;
      });
    };
    const confirmation = runtime.confirmPendingRelease(
      'release-a',
      async () => ({ postMessage: vi.fn() }),
      delivery
    );

    await Promise.resolve();
    runtime.applyAuthoritativeState({
      revision: 2,
      committedReleaseId: 'release-current',
      pendingReleaseId: 'release-b',
      pendingDisplayVersion: '1.0.4',
      upgradeState: 'ready',
      updatedAt: 200,
    });
    acknowledge?.({
      type: 'SW_UPGRADE_COMMIT_RESULT',
      requestId,
      releaseId: 'release-a',
      accepted: true,
      revision: 1,
    });

    await expect(confirmation).resolves.toBe('ignored');
    expect(runtime.getSnapshot()).toMatchObject({
      pendingReleaseId: 'release-b',
      phase: 'ready',
    });
  });

  it('converges from committed authority when an accepted acknowledgement is lost', async () => {
    const runtime = createVersionUpgradeRuntime('release-current');
    runtime.replacePendingRelease('release-a', '1.0.3');
    let rejectDelivery: ((error: Error) => void) | null = null;
    const delivery: UpgradeCommitDelivery = async () =>
      await new Promise((_resolve, reject) => {
        rejectDelivery = reject;
      });
    const confirmation = runtime.confirmPendingRelease(
      'release-a',
      async () => ({ postMessage: vi.fn() }),
      delivery
    );

    await Promise.resolve();
    runtime.applyAuthoritativeState({
      revision: 3,
      committedReleaseId: 'release-a',
      pendingReleaseId: null,
      upgradeState: 'idle',
      updatedAt: 300,
    });
    rejectDelivery?.(new Error('acknowledgement lost'));

    await expect(confirmation).resolves.toBe('sent');
    expect(runtime.getSnapshot().phase).toBe('activating');
    expect(runtime.claimApprovedActivationReload('release-a')).toBe(true);
  });

  it('retains explicit approval when activation arrives after acknowledgement timeout', async () => {
    const runtime = createVersionUpgradeRuntime('release-current');
    runtime.replacePendingRelease('release-a', '1.0.3');
    const worker = { postMessage: vi.fn() };
    const delivery = vi.fn<UpgradeCommitDelivery>((target, request) =>
      postUpgradeCommitWithAcknowledgement(target, request, { timeoutMs: 1 })
    );
    const confirmation = runtime.confirmPendingRelease(
      'release-a',
      async () => worker,
      delivery
    );

    await expect(confirmation).resolves.toBe('acknowledgement-pending');
    expect(runtime.getSnapshot()).toMatchObject({
      pendingReleaseId: 'release-a',
      phase: 'commit-sent',
      confirmationIssue: 'commit-acknowledgement-pending',
    });
    await expect(
      runtime.confirmPendingRelease('release-a', async () => worker, delivery)
    ).resolves.toBe('ignored');
    expect(delivery).toHaveBeenCalledTimes(1);
    expect(worker.postMessage).toHaveBeenCalledTimes(1);
    expect(worker.postMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        releaseId: 'release-a',
        requestId: 'release-a:1',
      }),
      [expect.any(MessagePort)]
    );
    expect(runtime.claimApprovedActivationReload('release-a')).toBe(false);

    runtime.applyAuthoritativeState({
      revision: 3,
      committedReleaseId: 'release-current',
      pendingReleaseId: 'release-a',
      upgradeState: 'committing',
      updatedAt: 300,
    });
    await expect(
      runtime.confirmPendingRelease('release-a', async () => worker, delivery)
    ).resolves.toBe('ignored');
    expect(worker.postMessage).toHaveBeenCalledTimes(1);

    runtime.applyAuthoritativeState({
      revision: 4,
      committedReleaseId: 'release-a',
      pendingReleaseId: null,
      upgradeState: 'idle',
      updatedAt: 400,
    });

    expect(runtime.getSnapshot().phase).toBe('activating');
    expect(runtime.claimApprovedActivationReload('release-a')).toBe(true);
  });

  it('does not treat pre-activation committing authority as an accepted commit', async () => {
    const runtime = createVersionUpgradeRuntime('release-current');
    runtime.replacePendingRelease('release-a', '1.0.3');
    let rejectDelivery: ((error: Error) => void) | null = null;
    const confirmation = runtime.confirmPendingRelease(
      'release-a',
      async () => ({ postMessage: vi.fn() }),
      async () =>
        await new Promise((_resolve, reject) => {
          rejectDelivery = reject;
        })
    );

    await Promise.resolve();
    runtime.applyAuthoritativeState({
      revision: 8,
      committedReleaseId: 'release-current',
      pendingReleaseId: 'release-a',
      upgradeState: 'committing',
      updatedAt: 800,
    });
    expect(runtime.getSnapshot().phase).toBe('confirming');

    rejectDelivery?.(new Error('acknowledgement timed out'));
    await expect(confirmation).resolves.toBe('acknowledgement-pending');
    expect(runtime.getSnapshot()).toMatchObject({
      pendingReleaseId: 'release-a',
      phase: 'commit-sent',
      confirmationIssue: 'commit-acknowledgement-pending',
    });
    expect(runtime.claimApprovedActivationReload('release-b')).toBe(false);

    runtime.applyAuthoritativeState({
      revision: 9,
      committedReleaseId: 'release-a',
      pendingReleaseId: null,
      upgradeState: 'idle',
      updatedAt: 900,
    });
    expect(runtime.getSnapshot().phase).toBe('activating');
    expect(runtime.claimApprovedActivationReload('release-a')).toBe(true);
  });

  it('returns to retryable ready when skipWaiting fails after committing was observed', async () => {
    const runtime = createVersionUpgradeRuntime('release-current');
    runtime.applyAuthoritativeState({
      revision: 7,
      committedReleaseId: 'release-current',
      pendingReleaseId: 'release-a',
      upgradeState: 'ready',
      updatedAt: 700,
    });
    let resolveDelivery:
      | ((value: {
          type: 'SW_UPGRADE_COMMIT_RESULT';
          releaseId: string;
          requestId: string;
          accepted: false;
          reason: 'activation-failed';
          revision: number;
        }) => void)
      | null = null;
    let sentRequestId = '';
    const confirmation = runtime.confirmPendingRelease(
      'release-a',
      async () => ({ postMessage: vi.fn() }),
      async (_worker, request) => {
        sentRequestId = request.requestId;
        return await new Promise((resolve) => {
          resolveDelivery = resolve;
        });
      }
    );

    await Promise.resolve();
    runtime.applyAuthoritativeState({
      revision: 8,
      committedReleaseId: 'release-current',
      pendingReleaseId: 'release-a',
      upgradeState: 'committing',
      updatedAt: 800,
    });
    runtime.applyAuthoritativeState({
      revision: 9,
      committedReleaseId: 'release-current',
      pendingReleaseId: 'release-a',
      upgradeState: 'ready',
      updatedAt: 900,
    });
    resolveDelivery?.({
      type: 'SW_UPGRADE_COMMIT_RESULT',
      releaseId: 'release-a',
      requestId: sentRequestId,
      accepted: false,
      reason: 'activation-failed',
      revision: 9,
    });

    await expect(confirmation).resolves.toBe('rejected');
    expect(runtime.getSnapshot()).toMatchObject({
      pendingReleaseId: 'release-a',
      phase: 'ready',
      confirmationIssue: 'commit-rejected',
      confirmationRejectionReason: 'activation-failed',
    });
    await expect(
      runtime.confirmPendingRelease(
        'release-a',
        async () => ({ postMessage: vi.fn() }),
        async (_worker, request) => ({
          type: 'SW_UPGRADE_COMMIT_RESULT',
          releaseId: request.releaseId,
          requestId: request.requestId,
          accepted: false,
          reason: 'activation-failed',
          revision: 10,
        })
      )
    ).resolves.toBe('rejected');
  });

  it('does not let a NACK revision suppress the complete state at the same revision', async () => {
    const runtime = createVersionUpgradeRuntime('release-current');
    runtime.replacePendingRelease('release-a', '1.0.3');
    const rejection: UpgradeCommitDelivery = async (_worker, request) => ({
      type: 'SW_UPGRADE_COMMIT_RESULT',
      releaseId: request.releaseId,
      requestId: request.requestId,
      accepted: false,
      reason: 'already-committed',
      revision: 8,
    });

    await expect(
      runtime.confirmPendingRelease(
        'release-a',
        async () => ({ postMessage: vi.fn() }),
        rejection
      )
    ).resolves.toBe('rejected');

    runtime.applyAuthoritativeState({
      revision: 8,
      committedReleaseId: 'release-a',
      pendingReleaseId: null,
      upgradeState: 'idle',
      updatedAt: 800,
    });
    expect(runtime.getSnapshot()).toMatchObject({
      committedReleaseId: 'release-a',
      pendingReleaseId: null,
      phase: 'idle',
    });
  });

  it('does not regress an acknowledged commit when committing state is broadcast', async () => {
    const runtime = createVersionUpgradeRuntime('release-current');
    runtime.replacePendingRelease('release-a', '1.0.3');
    await runtime.confirmPendingRelease(
      'release-a',
      async () => ({ postMessage: vi.fn() }),
      acknowledgeCommit
    );

    runtime.applyAuthoritativeState({
      revision: 8,
      committedReleaseId: 'release-current',
      pendingReleaseId: 'release-a',
      upgradeState: 'committing',
      updatedAt: 800,
    });

    expect(runtime.getSnapshot()).toMatchObject({
      pendingReleaseId: 'release-a',
      phase: 'commit-sent',
      confirmationIssue: null,
    });
  });

  it('reconciles one reload when committed authority arrives after an earlier activation signal', async () => {
    const runtime = createVersionUpgradeRuntime('release-current');
    runtime.replacePendingRelease('release-a', '1.0.3');
    let rejectDelivery: ((error: Error) => void) | null = null;
    const confirmation = runtime.confirmPendingRelease(
      'release-a',
      async () => ({ postMessage: vi.fn() }),
      async () =>
        await new Promise((_resolve, reject) => {
          rejectDelivery = reject;
        })
    );
    const reload = vi.fn();
    const unsubscribe = subscribeToApprovedActivationReload(runtime, reload);
    await Promise.resolve();

    // controllerchange/sw:activated can both occur before the commit ACK. Their
    // immediate claims fail because approval has not converged yet.
    expect(runtime.claimApprovedActivationReload('release-a')).toBe(false);
    expect(runtime.claimApprovedActivationReload('release-a')).toBe(false);

    runtime.applyAuthoritativeState({
      revision: 9,
      committedReleaseId: 'release-a',
      pendingReleaseId: null,
      upgradeState: 'idle',
      updatedAt: 900,
    });
    rejectDelivery?.(new Error('acknowledgement arrived after activation'));

    await expect(confirmation).resolves.toBe('sent');
    expect(reload).toHaveBeenCalledTimes(1);
    expect(reload).toHaveBeenCalledWith('release-a');
    unsubscribe();
  });

  it('preserves the exact NACK reason needed to escape a non-retryable old-page loop', async () => {
    const runtime = createVersionUpgradeRuntime('release-a');
    runtime.applyAuthoritativeState({
      revision: 8,
      committedReleaseId: 'release-b',
      pendingReleaseId: 'release-c',
      pendingDisplayVersion: '1.0.4',
      upgradeState: 'ready',
      updatedAt: 800,
    });

    await expect(
      runtime.confirmPendingRelease(
        'release-c',
        async () => ({ postMessage: vi.fn() }),
        async (_worker, request) => ({
          type: 'SW_UPGRADE_COMMIT_RESULT',
          requestId: request.requestId,
          releaseId: request.releaseId,
          accepted: false,
          reason: 'client-release-mismatch',
          revision: 8,
        })
      )
    ).resolves.toBe('rejected');
    expect(runtime.getSnapshot()).toMatchObject({
      pendingReleaseId: 'release-c',
      phase: 'ready',
      confirmationIssue: 'commit-rejected',
      confirmationRejectionReason: 'client-release-mismatch',
    });
  });

  it('allows one dedicated reload only after the matching release was committed', async () => {
    const runtime = createVersionUpgradeRuntime('release-current');
    runtime.replacePendingRelease('release-a', '1.0.3');

    expect(runtime.claimApprovedActivationReload('release-a')).toBe(false);

    await runtime.confirmPendingRelease(
      'release-a',
      async () => ({
        postMessage: vi.fn(),
      }),
      acknowledgeCommit
    );

    // ACK proves acceptance, but it does not prove which release now controls
    // this page. Neither an unlabelled controllerchange nor a claimed release
    // can authorize the reload before authoritative SW state converges.
    expect(runtime.claimApprovedActivationReload()).toBe(false);
    expect(runtime.claimApprovedActivationReload('release-b')).toBe(false);
    expect(runtime.claimApprovedActivationReload('release-a')).toBe(false);

    runtime.applyAuthoritativeState({
      revision: 2,
      committedReleaseId: 'release-a',
      pendingReleaseId: null,
      upgradeState: 'idle',
      updatedAt: 200,
    });

    expect(runtime.claimApprovedActivationReload('release-a')).toBe(true);
    expect(runtime.claimApprovedActivationReload('release-a')).toBe(false);
    expect(runtime.claimApprovedActivationReload()).toBe(false);
  });
});

describe('Service Worker version-state compatibility boundary', () => {
  it('keeps immutable release identity separate from the display version', () => {
    expect(
      resolveServiceWorkerVersionState({
        revision: 8,
        committedReleaseId: 'release-current',
        pendingReleaseId: 'release-a',
        pendingDisplayVersion: '1.0.3',
        appVersion: '1.0.3',
        swReleaseId: 'release-a',
        upgradeState: 'ready',
        updatedAt: 20,
      })
    ).toEqual({
      revision: 8,
      committedReleaseId: 'release-current',
      pendingReleaseId: 'release-a',
      pendingDisplayVersion: '1.0.3',
      upgradeState: 'ready',
      updatedAt: 20,
    });
  });

  it('normalizes a legacy SW_VERSION_STATE payload at the read boundary', () => {
    expect(
      resolveServiceWorkerVersionState({
        committedVersion: '1.0.2',
        pendingVersion: '1.0.3',
        swVersion: '1.0.3',
        upgradeState: 'ready',
      })
    ).toEqual({
      committedReleaseId: '1.0.2',
      pendingReleaseId: '1.0.3',
      pendingDisplayVersion: '1.0.3',
      upgradeState: 'ready',
    });
  });

  it('does not treat a channel-only display version as release identity', () => {
    expect(resolveServiceWorkerVersionState({ version: '1.0.3' })).toBeNull();
  });
});

describe('bootstrap convergence source contract', () => {
  it('bypasses the HTTP cache in both registration paths and uses the dedicated reload', () => {
    const workspaceRoot = resolve(__dirname, '../../../..');
    const earlyBootstrap = readFileSync(
      resolve(workspaceRoot, 'apps/web/index.html'),
      'utf8'
    );
    const applicationBootstrap = readFileSync(
      resolve(workspaceRoot, 'apps/web/src/app/bootstrap.tsx'),
      'utf8'
    );
    const serviceWorkerSource = readFileSync(
      resolve(workspaceRoot, 'apps/web/src/sw/index.ts'),
      'utf8'
    );

    expect(earlyBootstrap).toContain(
      ".register('./sw.js', { updateViaCache: 'none' })"
    );
    expect(applicationBootstrap).toContain(
      ".register('./sw.js', { updateViaCache: 'none' })"
    );
    expect(applicationBootstrap).toContain('window.location.reload()');
    expect(applicationBootstrap).not.toContain('safeReload');
    expect(applicationBootstrap).toContain(
      'const isDevelopment = import.meta.env.DEV;'
    );
    expect(applicationBootstrap).not.toContain(
      "window.location.hostname === 'localhost'"
    );
    expect(serviceWorkerSource).toContain(
      'const isDevelopment = import.meta.env.DEV;'
    );
    expect(serviceWorkerSource).not.toContain(
      "location.hostname === 'localhost'"
    );
    expect(applicationBootstrap).toContain(
      'postUpgradeCommitWithAcknowledgement'
    );
    expect(applicationBootstrap).toContain('clientReleaseId: APP_RELEASE_ID');
    expect(applicationBootstrap).not.toContain(
      "scheduleConfirmedUpgradeReload('controllerchange')"
    );
    expect(applicationBootstrap).not.toContain(
      "scheduleConfirmedUpgradeReload('sw:activated'"
    );
    expect(serviceWorkerSource).toContain(
      'resolveTrustedWindowClient(event.source)'
    );
    expect(serviceWorkerSource).toContain(
      'const acknowledgementPort = event.ports[0]'
    );
    expect(serviceWorkerSource).not.toContain(
      '(!isLegacyCommit || client !== null)'
    );
  });
});

describe('version metadata fetch', () => {
  it('bypasses cache and preserves a same-origin Service Worker subpath', async () => {
    const fetcher = vi.fn(async () => ({
      ok: true,
      url: 'https://example.test/opentu/version.json',
      json: async () => ({
        version: '1.0.3',
        releaseId: 'release-a',
        changelog: ['fixed routing'],
      }),
    })) as unknown as typeof fetch;

    await expect(
      fetchVersionMetadata({
        pendingReleaseId: 'release-a',
        baseUrl: 'https://example.test/opentu/',
        expectedOrigin: 'https://example.test',
        fetcher,
      })
    ).resolves.toEqual({
      version: '1.0.3',
      releaseId: 'release-a',
      changelog: ['fixed routing'],
    });
    expect(fetcher).toHaveBeenCalledWith(
      'https://example.test/opentu/version.json',
      expect.objectContaining({
        cache: 'no-store',
        credentials: 'same-origin',
      })
    );
  });

  it.each([
    {
      name: 'cross-origin redirect',
      responseUrl: 'https://other.test/version.json',
      body: { version: '1.0.3', releaseId: 'release-a' },
    },
    {
      name: 'mismatched release identity',
      responseUrl: 'https://example.test/version.json',
      body: { version: '1.0.3', releaseId: 'release-b' },
    },
    {
      name: 'invalid changelog structure',
      responseUrl: 'https://example.test/version.json',
      body: { version: '1.0.3', releaseId: 'release-a', changelog: [1] },
    },
  ])('rejects $name', async ({ responseUrl, body }) => {
    const fetcher = vi.fn(async () => ({
      ok: true,
      url: responseUrl,
      json: async () => body,
    })) as unknown as typeof fetch;

    await expect(
      fetchVersionMetadata({
        pendingReleaseId: 'release-a',
        baseUrl: 'https://example.test/',
        fetcher,
      })
    ).rejects.toThrow();
  });

  it('rejects a metadata scope outside the application origin before fetch', async () => {
    const fetcher = vi.fn();

    await expect(
      fetchVersionMetadata({
        pendingReleaseId: 'release-a',
        baseUrl: 'https://other.test/opentu/',
        expectedOrigin: 'https://example.test',
        fetcher,
      })
    ).rejects.toThrow('scope must be same-origin');
    expect(fetcher).not.toHaveBeenCalled();
  });
});
