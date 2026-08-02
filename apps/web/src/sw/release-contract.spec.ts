import { describe, expect, it } from 'vitest';

import {
  getReleaseStaticCacheName,
  getUpgradeCommitOwnershipRejectionReason,
  getUpgradeCommitRejectionReason,
  findTrustedReleaseWindowClient,
  isClientURLWithinServiceWorkerScope,
  manifestMatchesRelease,
  normalizeSWReleaseState,
  resolveCDNPackageVersion,
  resolveDynamicImportRecoveryModuleUrl,
  resolveDynamicImportRecoveryAcknowledgement,
  resolveDynamicImportRecoveryRequest,
  resolveStaticRequestReleaseId,
  resolveUpgradeCommitAcknowledgement,
  resolveUpgradeCommitRequest,
  selectDynamicImportRecoveryCacheKeys,
  selectRetirableReleaseStaticCaches,
  selectRetirableReleaseStaticCachesForClients,
  shouldAcceptDynamicImportRecovery,
  shouldAcceptUpgradeCommit,
  shouldClaimClientsOnReleaseActivate,
  type SWReleaseState,
  type UpgradeCommitRequest,
} from './release-contract';

const readyState: SWReleaseState = {
  schemaVersion: 2,
  revision: 7,
  committedReleaseId: '1.0.2',
  pendingReleaseId: '1.0.3-sha-a',
  pendingReadyAt: 100,
  upgradeState: 'ready',
  updatedAt: 100,
};

const readyCommitRequest: UpgradeCommitRequest = {
  type: 'COMMIT_UPGRADE',
  releaseId: '1.0.3-sha-a',
  clientReleaseId: '1.0.2',
  requestId: 'request-1',
};

describe('service-worker release contract', () => {
  it('migrates legacy display-version state only at the persistence boundary', () => {
    expect(
      normalizeSWReleaseState(
        {
          committedVersion: '1.0.2',
          pendingVersion: '1.0.3-sha-a',
          pendingReadyAt: 100,
          upgradeState: 'ready',
          updatedAt: 100,
        },
        '1.0.3-sha-a',
        200
      )
    ).toEqual({
      ...readyState,
      revision: 0,
    });
  });

  it('normalizes a durable monotonic revision independently of wall-clock time', () => {
    expect(
      normalizeSWReleaseState(
        {
          ...readyState,
          revision: 11,
          updatedAt: 100,
        },
        '1.0.3-sha-a',
        100
      )
    ).toMatchObject({
      schemaVersion: 2,
      revision: 11,
      updatedAt: 100,
    });
  });

  it('requires both display version and immutable release identity on manifests', () => {
    expect(
      manifestMatchesRelease(
        { version: '1.0.3', releaseId: '1.0.3-sha-a' },
        '1.0.3',
        '1.0.3-sha-a'
      )
    ).toBe(true);
    expect(
      manifestMatchesRelease(
        { version: '1.0.3', releaseId: '1.0.3-sha-b' },
        '1.0.3',
        '1.0.3-sha-a'
      )
    ).toBe(false);
    expect(
      manifestMatchesRelease({ version: '1.0.3' }, '1.0.3', '1.0.3-sha-a')
    ).toBe(false);
  });

  it('never uses a release id as an npm CDN package version', () => {
    expect(resolveCDNPackageVersion(null, '1.0.3')).toBe('1.0.3');
    expect(resolveCDNPackageVersion('1.0.2', '1.0.3')).toBe('1.0.2');
  });

  it('targets only the failed module inside the page release cache during lazy-chunk recovery', () => {
    expect(getReleaseStaticCacheName('1.0.3-sha-a')).toBe(
      'drawnix-static-v1.0.3-sha-a'
    );
    expect(
      selectDynamicImportRecoveryCacheKeys(
        [
          'https://example.test/opentu/',
          'https://example.test/opentu/index.html',
          'https://example.test/opentu/assets/editor-old.js',
          'https://example.test/opentu/assets/editor-old.js?cached=1',
          'https://example.test/opentu/assets/other.js',
        ],
        '/opentu/assets/editor-old.js',
        'https://example.test/opentu/board/1',
        'https://example.test/opentu/'
      )
    ).toEqual([
      'https://example.test/opentu/assets/editor-old.js',
      'https://example.test/opentu/assets/editor-old.js?cached=1',
    ]);
    expect(
      resolveDynamicImportRecoveryModuleUrl(
        'https://evil.test/assets/editor-old.js',
        'https://example.test/opentu/board/1',
        'https://example.test/opentu/'
      )
    ).toBeNull();
    expect(
      resolveDynamicImportRecoveryModuleUrl(
        'boot-main-entry',
        'https://example.test/opentu/board/1',
        'https://example.test/opentu/'
      )
    ).toBeNull();
  });

  it('retires only release caches without committed, pending, or live-client ownership', () => {
    expect(
      selectRetirableReleaseStaticCaches(
        [
          'drawnix-static-vrelease-old',
          'drawnix-static-vrelease-committed',
          'drawnix-static-vrelease-pending',
          'drawnix-static-vrelease-live-tab',
          'drawnix-images',
          'drawnix-fonts',
        ],
        new Set(['release-committed', 'release-pending', 'release-live-tab'])
      )
    ).toEqual(['drawnix-static-vrelease-old']);
  });

  it('retires nothing until every live window has reported its executing release', () => {
    const context = {
      cacheNames: [
        'drawnix-static-vrelease-old',
        'drawnix-static-vrelease-current',
      ],
      committedReleaseId: 'release-current',
      pendingReleaseId: null,
      liveClientIds: ['client-a', 'client-b'],
    };

    expect(
      selectRetirableReleaseStaticCachesForClients({
        ...context,
        clientReleaseOwnership: new Map([['client-a', 'release-current']]),
      })
    ).toEqual([]);
    expect(
      selectRetirableReleaseStaticCachesForClients({
        ...context,
        clientReleaseOwnership: new Map([
          ['client-a', 'release-current'],
          ['client-b', 'release-current'],
        ]),
      })
    ).toEqual(['drawnix-static-vrelease-old']);
  });

  it('routes old-tab subresources to that tab release while navigations converge to committed', () => {
    const ownership = new Map([
      ['old-client', 'release-a'],
      ['current-client', 'release-b'],
    ]);
    expect(
      resolveStaticRequestReleaseId(
        'same-origin',
        'old-client',
        ownership,
        'release-b'
      )
    ).toBe('release-a');
    expect(
      resolveStaticRequestReleaseId(
        'navigate',
        'old-client',
        ownership,
        'release-b'
      )
    ).toBe('release-b');
    expect(
      resolveStaticRequestReleaseId(
        'same-origin',
        'unknown-client',
        ownership,
        'release-b',
        'release-a'
      )
    ).toBe('release-a');
  });

  it('does not claim existing pages when a staged release activates', () => {
    expect(shouldClaimClientsOnReleaseActivate(false)).toBe(true);
    expect(shouldClaimClientsOnReleaseActivate(true)).toBe(false);
  });

  it('accepts lazy-chunk recovery only for a fully correlated page release request', () => {
    const request = resolveDynamicImportRecoveryRequest({
      type: 'SW_RELEASE_STATIC_RECOVERY_REQUEST',
      releaseId: '1.0.2-sha-old',
      requestId: 'recovery-1',
      target: {
        kind: 'module',
        moduleKey: '/opentu/assets/editor.js',
      },
    });
    expect(request).toEqual({
      type: 'SW_RELEASE_STATIC_RECOVERY_REQUEST',
      releaseId: '1.0.2-sha-old',
      requestId: 'recovery-1',
      target: {
        kind: 'module',
        moduleKey: '/opentu/assets/editor.js',
      },
    });
    if (!request) {
      throw new Error('Expected a valid dynamic import recovery request');
    }
    expect(shouldAcceptDynamicImportRecovery(request, '1.0.2-sha-old')).toBe(
      true
    );
    expect(shouldAcceptDynamicImportRecovery(request, '1.0.3-sha-a')).toBe(
      false
    );
    expect(
      resolveDynamicImportRecoveryRequest({
        type: 'SW_RELEASE_STATIC_RECOVERY_REQUEST',
        releaseId: '1.0.2-sha-old',
        target: {
          kind: 'module',
          moduleKey: '/opentu/assets/editor.js',
        },
      })
    ).toBeNull();
    expect(
      resolveDynamicImportRecoveryRequest({
        type: 'RECOVER_DYNAMIC_IMPORT_FAILURE',
        releaseId: '1.0.2-sha-old',
        requestId: 'legacy-destructive-message',
        moduleKey: '/opentu/assets/editor.js',
      })
    ).toBeNull();
    expect(
      resolveDynamicImportRecoveryRequest({
        type: 'SW_RELEASE_STATIC_RECOVERY_REQUEST',
        releaseId: '1.0.2-sha-old',
        requestId: 'reload-only-1',
        target: { kind: 'reload-only' },
      })
    ).toEqual({
      type: 'SW_RELEASE_STATIC_RECOVERY_REQUEST',
      releaseId: '1.0.2-sha-old',
      requestId: 'reload-only-1',
      target: { kind: 'reload-only' },
    });

    expect(
      resolveDynamicImportRecoveryAcknowledgement(
        {
          type: 'SW_RELEASE_STATIC_RECOVERY_RESULT',
          releaseId: request.releaseId,
          requestId: request.requestId,
          accepted: true,
          invalidatedEntries: 1,
        },
        request
      )
    ).toEqual({
      type: 'SW_RELEASE_STATIC_RECOVERY_RESULT',
      releaseId: '1.0.2-sha-old',
      requestId: 'recovery-1',
      accepted: true,
      invalidatedEntries: 1,
    });
    expect(
      resolveDynamicImportRecoveryAcknowledgement(
        {
          type: 'SW_RELEASE_STATIC_RECOVERY_RESULT',
          releaseId: 'another-release',
          requestId: 'recovery-1',
          accepted: true,
          invalidatedEntries: 1,
        },
        request
      )
    ).toBeNull();
    expect(
      resolveDynamicImportRecoveryAcknowledgement(
        {
          type: 'SW_RELEASE_STATIC_RECOVERY_RESULT',
          releaseId: request.releaseId,
          requestId: request.requestId,
          accepted: false,
          invalidatedEntries: 0,
          reason: 'module-not-found',
        },
        request
      )
    ).toMatchObject({
      accepted: false,
      invalidatedEntries: 0,
      reason: 'module-not-found',
    });
    expect(
      resolveDynamicImportRecoveryAcknowledgement(
        {
          type: 'SW_RELEASE_STATIC_RECOVERY_RESULT',
          releaseId: request.releaseId,
          requestId: request.requestId,
          accepted: true,
          invalidatedEntries: 0,
        },
        request
      )
    ).toMatchObject({
      accepted: true,
      invalidatedEntries: 0,
    });
  });

  it('accepts only the addressed current release and rejects a stale commit', () => {
    expect(
      shouldAcceptUpgradeCommit(readyCommitRequest, readyState, '1.0.3-sha-a')
    ).toBe(true);
    expect(
      shouldAcceptUpgradeCommit(
        { ...readyCommitRequest, releaseId: '1.0.3-sha-old' },
        readyState,
        '1.0.3-sha-a'
      )
    ).toBe(false);
  });

  it('does not activate an addressed update before its release cache is ready', () => {
    expect(
      shouldAcceptUpgradeCommit(
        readyCommitRequest,
        { ...readyState, upgradeState: 'prewarming' },
        '1.0.3-sha-a'
      )
    ).toBe(false);
    expect(
      shouldAcceptUpgradeCommit(
        readyCommitRequest,
        { ...readyState, pendingReleaseId: '1.0.3-sha-b' },
        '1.0.3-sha-a'
      )
    ).toBe(false);
  });

  it('accepts an idempotent replay only after this release entered committing', () => {
    expect(
      shouldAcceptUpgradeCommit(
        readyCommitRequest,
        {
          ...readyState,
          upgradeState: 'committing',
        },
        '1.0.3-sha-a'
      )
    ).toBe(true);
    expect(
      shouldAcceptUpgradeCommit(
        readyCommitRequest,
        {
          ...readyState,
          committedReleaseId: '1.0.3-sha-a',
          pendingReleaseId: null,
          upgradeState: 'committing',
        },
        '1.0.3-sha-a'
      )
    ).toBe(false);
  });

  it('limits the old-page bridge to the currently ready pending release', () => {
    expect(
      shouldAcceptUpgradeCommit(
        { type: 'COMMIT_UPGRADE' },
        readyState,
        '1.0.3-sha-a'
      )
    ).toBe(true);
    expect(
      shouldAcceptUpgradeCommit(
        { type: 'COMMIT_UPGRADE' },
        { ...readyState, upgradeState: 'prewarming' },
        '1.0.3-sha-a'
      )
    ).toBe(false);
    expect(
      shouldAcceptUpgradeCommit(
        { type: 'COMMIT_UPGRADE' },
        { ...readyState, pendingReleaseId: '1.0.3-sha-b' },
        '1.0.3-sha-a'
      )
    ).toBe(false);
    expect(
      shouldAcceptUpgradeCommit(
        { type: 'SKIP_WAITING' },
        readyState,
        '1.0.3-sha-a'
      )
    ).toBe(false);
  });

  it('keeps the old-page confirmation bridge separate from the acknowledged request shape', () => {
    expect(
      shouldAcceptUpgradeCommit(
        { type: 'COMMIT_UPGRADE' },
        readyState,
        '1.0.3-sha-a'
      )
    ).toBe(true);
    expect(resolveUpgradeCommitRequest({ type: 'COMMIT_UPGRADE' })).toBeNull();
  });

  it('fails closed for partial modern commits instead of treating them as legacy', () => {
    expect(
      getUpgradeCommitRejectionReason(
        {
          type: 'COMMIT_UPGRADE',
          releaseId: readyCommitRequest.releaseId,
          requestId: readyCommitRequest.requestId,
        },
        readyState,
        readyCommitRequest.releaseId
      )
    ).toBe('invalid-message');
    expect(
      getUpgradeCommitRejectionReason(
        {
          type: 'COMMIT_UPGRADE',
          clientReleaseId: readyCommitRequest.clientReleaseId,
        },
        readyState,
        readyCommitRequest.releaseId
      )
    ).toBe('invalid-message');
  });

  it('requires a modern commit to match the durable first-wins client ownership', () => {
    expect(
      getUpgradeCommitOwnershipRejectionReason(
        readyCommitRequest,
        readyCommitRequest.clientReleaseId
      )
    ).toBeNull();
    expect(
      getUpgradeCommitOwnershipRejectionReason(readyCommitRequest, '1.0.1')
    ).toBe('client-release-mismatch');
    expect(
      getUpgradeCommitOwnershipRejectionReason(readyCommitRequest, null)
    ).toBe('persistence-failed');
    expect(getUpgradeCommitOwnershipRejectionReason(null, null)).toBeNull();
  });

  it('binds acknowledged commits to the page release that is actually executing', () => {
    const request = resolveUpgradeCommitRequest({
      type: 'COMMIT_UPGRADE',
      releaseId: '1.0.3-sha-a',
      clientReleaseId: '1.0.2',
      requestId: 'request-1',
    });
    expect(request).toEqual({
      type: 'COMMIT_UPGRADE',
      releaseId: '1.0.3-sha-a',
      clientReleaseId: '1.0.2',
      requestId: 'request-1',
    });
    expect(
      getUpgradeCommitRejectionReason(
        { ...request, clientReleaseId: '1.0.1' },
        readyState,
        '1.0.3-sha-a'
      )
    ).toBe('client-release-mismatch');
  });

  it('accepts only an acknowledgement for the exact request and durable revision', () => {
    const request = {
      type: 'COMMIT_UPGRADE' as const,
      releaseId: '1.0.3-sha-a',
      clientReleaseId: '1.0.2',
      requestId: 'request-1',
    };
    expect(
      resolveUpgradeCommitAcknowledgement(
        {
          type: 'SW_UPGRADE_COMMIT_RESULT',
          releaseId: request.releaseId,
          requestId: request.requestId,
          accepted: true,
          revision: 8,
        },
        request
      )
    ).toMatchObject({ accepted: true, revision: 8 });
    expect(
      resolveUpgradeCommitAcknowledgement(
        {
          type: 'SW_UPGRADE_COMMIT_RESULT',
          releaseId: request.releaseId,
          requestId: 'another-request',
          accepted: true,
          revision: 8,
        },
        request
      )
    ).toBeNull();
    expect(
      resolveUpgradeCommitAcknowledgement(
        {
          type: 'SW_UPGRADE_COMMIT_RESULT',
          releaseId: request.releaseId,
          requestId: request.requestId,
          accepted: true,
        },
        request
      )
    ).toBeNull();
  });

  it('requires a same-origin window URL inside the registered Service Worker scope', () => {
    expect(
      isClientURLWithinServiceWorkerScope(
        'https://example.test/opentu/board/1',
        'https://example.test/opentu/'
      )
    ).toBe(true);
    expect(
      isClientURLWithinServiceWorkerScope(
        'https://example.test/opentu-evil/board/1',
        'https://example.test/opentu/'
      )
    ).toBe(false);
    expect(
      isClientURLWithinServiceWorkerScope(
        'https://other.test/opentu/board/1',
        'https://example.test/opentu/'
      )
    ).toBe(false);
  });

  it('rejects null, non-window, unknown, and out-of-scope commit sources', () => {
    const clients = [
      {
        id: 'window-valid',
        type: 'window',
        url: 'https://example.test/opentu/board',
      },
      {
        id: 'worker-client',
        type: 'worker',
        url: 'https://example.test/opentu/worker.js',
      },
      {
        id: 'window-outside',
        type: 'window',
        url: 'https://example.test/another-app/',
      },
    ];
    const resolve = (source: unknown) =>
      findTrustedReleaseWindowClient(
        source,
        clients,
        'https://example.test/opentu/'
      );

    expect(resolve(null)).toBeNull();
    expect(resolve({ postMessage: () => undefined })).toBeNull();
    expect(resolve({ id: 'unknown' })).toBeNull();
    expect(resolve({ id: 'worker-client' })).toBeNull();
    expect(resolve({ id: 'window-outside' })).toBeNull();
    expect(resolve({ id: 'window-valid' })).toEqual(clients[0]);
  });
});
