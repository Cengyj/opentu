import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';

import { afterEach, describe, expect, it, vi } from 'vitest';

const readBootHtml = () =>
  readFile(new URL('../../index.html', import.meta.url), 'utf8');
const readServiceWorkerSource = () =>
  readFile(new URL('./index.ts', import.meta.url), 'utf8');
const readCDNFallbackSource = () =>
  readFile(new URL('./cdn-fallback.ts', import.meta.url), 'utf8');

interface TestMessagePort {
  onmessage: ((event: { data: unknown }) => void) | null;
  onmessageerror: (() => void) | null;
  close: () => void;
  start: () => void;
}

const createTestMessageChannel = (): MessageChannel => {
  let closed = false;
  const port1: TestMessagePort = {
    onmessage: null,
    onmessageerror: null,
    close: () => {
      closed = true;
    },
    start: () => undefined,
  };
  const port2 = {
    postMessage: (data: unknown) => {
      if (!closed) {
        port1.onmessage?.({ data });
      }
    },
  };
  return { port1, port2 } as unknown as MessageChannel;
};

type BootRecoveryRequest = {
  type: string;
  releaseId: string;
  requestId: string;
  target: { kind: 'module'; moduleKey: string } | { kind: 'reload-only' };
};

type PrepareBootImportRecovery = (error: Error) => Promise<{
  mode: 'uncontrolled' | 'acknowledged';
  acknowledgement?: {
    accepted: boolean;
    invalidatedEntries: number;
  };
}>;

async function extractBootImportModuleKey(
  error: Error
): Promise<string | null> {
  const html = await readBootHtml();
  const resolverStart = html.indexOf('function getBootImportModuleKey');
  const resolverEnd = html.indexOf(
    'function postBootImportRecoveryAttempt',
    resolverStart
  );
  const context: Record<string, unknown> = {
    window: { location: { href: 'https://example.test/board' } },
    URL,
    error,
    moduleKeyResult: null,
  };
  runInNewContext(
    `${html.slice(
      resolverStart,
      resolverEnd
    )}\nmoduleKeyResult = getBootImportModuleKey(error);`,
    context
  );
  return context.moduleKeyResult as string | null;
}

async function createBootRecoveryHarness(
  postMessage: (message: unknown, transfer?: Transferable[]) => void,
  {
    timeoutMs = 100,
    maxAttempts = 2,
    retryDelayMs = 1,
    controlled = true,
    moduleKey = '/assets/editor.js',
    messageChannel = function TestMessageChannel() {
      return createTestMessageChannel();
    },
    waitingPostMessage = null,
    activePostMessage = null,
  }: {
    timeoutMs?: number;
    maxAttempts?: number;
    retryDelayMs?: number;
    controlled?: boolean;
    moduleKey?: string | null;
    messageChannel?: unknown;
    waitingPostMessage?:
      | ((message: unknown, transfer?: Transferable[]) => void)
      | null;
    activePostMessage?:
      | ((message: unknown, transfer?: Transferable[]) => void)
      | null;
  } = {}
): Promise<PrepareBootImportRecovery> {
  const html = await readBootHtml();
  const recoveryStart = html.indexOf('function postBootImportRecoveryAttempt');
  const recoveryEnd = html.indexOf(
    'window.__OPENTU_BOOT_DYNAMIC_IMPORT_RECOVERY__',
    recoveryStart
  );
  const context: Record<string, unknown> = {
    window: {
      setTimeout,
      clearTimeout,
      location: { href: 'https://example.test/board' },
    },
    navigator: {
      serviceWorker: {
        controller: controlled ? { postMessage } : null,
        getRegistration: vi.fn(async () =>
          waitingPostMessage || activePostMessage
            ? {
                waiting: waitingPostMessage
                  ? { postMessage: waitingPostMessage }
                  : null,
                active: activePostMessage
                  ? { postMessage: activePostMessage }
                  : null,
              }
            : null
        ),
      },
    },
    MessageChannel: messageChannel,
    BOOT_IMPORT_RECOVERY_ACK_TIMEOUT_MS: timeoutMs,
    BOOT_IMPORT_RECOVERY_MAX_ATTEMPTS: maxAttempts,
    BOOT_IMPORT_RECOVERY_RETRY_DELAY_MS: retryDelayMs,
    getBootAppReleaseId: () => 'release-a',
    getBootImportModuleKey: () => moduleKey,
    prepareBootImportRecoveryResult: null,
  };
  runInNewContext(
    `${html.slice(
      recoveryStart,
      recoveryEnd
    )}\nprepareBootImportRecoveryResult = prepareBootImportRecovery;`,
    context
  );
  return context.prepareBootImportRecoveryResult as PrepareBootImportRecovery;
}

describe('boot release recovery contract', () => {
  it('does not fetch the deferred manifest on activation when defaults are empty', async () => {
    const serviceWorkerSource = await readServiceWorkerSource();
    const activationStart = serviceWorkerSource.indexOf(
      "sw.addEventListener('activate'"
    );
    const activationEnd = serviceWorkerSource.indexOf(
      "sw.addEventListener('message'",
      activationStart
    );
    const activationHandler = serviceWorkerSource.slice(
      activationStart,
      activationEnd
    );

    expect(activationStart).toBeGreaterThan(0);
    expect(activationEnd).toBeGreaterThan(activationStart);
    expect(activationHandler).toContain(
      'if (IDLE_PREFETCH_DEFAULTS.length > 0)'
    );
    expect(activationHandler).toContain('prefetchDefaultIdleGroups()');
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('uses one compact favicon source instead of the legacy oversized ICO', async () => {
    const html = await readBootHtml();
    const iconLinks = Array.from(
      html.matchAll(/<link\b[^>]*\brel=["']icon["'][^>]*>/gi),
      (match) => match[0]
    );

    expect(iconLinks).toHaveLength(1);
    expect(iconLinks[0]).toContain('favicon-32x32.png');
    expect(iconLinks[0]).not.toContain('favicon.ico');
  });

  it('starts Service Worker installation only after the operable shell schedules post-boot idle work', async () => {
    vi.useFakeTimers();
    const html = await readBootHtml();
    const setupStart = html.indexOf(
      'function shouldEnableEarlyServiceWorkerBootstrap'
    );
    const setupEnd = html.indexOf('\n        renderProgress();', setupStart);
    const markReadyStart = html.indexOf('function markReady()');
    const markReadyEnd = html.indexOf('function markError(', markReadyStart);
    const register = vi.fn(async () => ({
      active: null,
      installing: null,
      waiting: null,
    }));
    const requestIdleCallback = vi.fn((callback: () => void) => {
      callback();
      return 1;
    });
    const syncEarlyCDNPreference = vi.fn();
    const context: Record<string, unknown> = {
      window: {
        location: { search: '' },
        setTimeout,
        requestIdleCallback,
      },
      navigator: {
        serviceWorker: {
          register,
          getRegistration: vi.fn(async () => null),
        },
      },
      URLSearchParams,
      Promise,
      console,
      setProgress: vi.fn(),
      syncEarlyCDNPreference,
      registrationHarness: null,
    };

    expect(setupStart).toBeGreaterThan(0);
    expect(setupEnd).toBeGreaterThan(setupStart);
    expect(markReadyEnd).toBeGreaterThan(markReadyStart);
    expect(html.slice(markReadyStart, markReadyEnd)).toContain(
      'schedulePostBootServiceWorkerRegistration();'
    );

    runInNewContext(
      `${html.slice(setupStart, setupEnd)}
setupEarlyServiceWorkerBootstrap();
registrationHarness = {
  schedule: schedulePostBootServiceWorkerRegistration,
  start: function () {
    return window.__OPENTU_START_POST_BOOT_SERVICE_WORKER__();
  }
};`,
      context
    );

    const harness = context.registrationHarness as {
      schedule: () => void;
      start: () => Promise<ServiceWorkerRegistration | null>;
    };
    const registrationPromise = (
      context.window as {
        __OPENTU_SW_REGISTRATION_PROMISE__: Promise<ServiceWorkerRegistration | null>;
      }
    ).__OPENTU_SW_REGISTRATION_PROMISE__;

    expect(register).not.toHaveBeenCalled();
    harness.schedule();
    await vi.advanceTimersByTimeAsync(3999);
    expect(register).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    await registrationPromise;
    expect(requestIdleCallback).toHaveBeenCalledTimes(1);
    expect(register).toHaveBeenCalledTimes(1);
    expect(syncEarlyCDNPreference).toHaveBeenCalledTimes(1);

    harness.schedule();
    await harness.start();
    expect(register).toHaveBeenCalledTimes(1);
  });

  it('uses a correlated release-scoped SW request and never deletes release caches directly', async () => {
    const html = await readBootHtml();
    const recoveryStart = html.indexOf(
      'function postBootImportRecoveryAttempt'
    );
    const recoveryEnd = html.indexOf('function clearBootTimers', recoveryStart);
    const recovery = html.slice(recoveryStart, recoveryEnd);

    expect(recoveryStart).toBeGreaterThan(0);
    expect(recoveryEnd).toBeGreaterThan(recoveryStart);
    expect(recovery).toContain('getBootAppReleaseId()');
    expect(html).toContain('meta[name="app-release-id"]');
    expect(recovery).toContain('requestId');
    expect(recovery).toContain('getBootImportModuleKey(error)');
    expect(html).toContain('/Unable to preload CSS/i.test(message)');
    expect(recovery).toContain('MessageChannel');
    expect(recovery).toContain('SW_RELEASE_STATIC_RECOVERY_RESULT');
    expect(recovery).toContain('SW_RELEASE_STATIC_RECOVERY_REQUEST');
    expect(recovery).not.toContain("type: 'RECOVER_DYNAMIC_IMPORT_FAILURE'");
    expect(recovery).toContain('BOOT_IMPORT_RECOVERY_MAX_ATTEMPTS');
    expect(recovery).toContain(
      "messageTarget.addEventListener(\n                'message'"
    );
    expect(recovery).toContain(
      'prepareBootImportRecovery(error).then(reload, function'
    );
    expect(recovery).not.toContain('window.setTimeout(reload');
    expect(recovery).not.toContain('.then(reload, reload)');
    expect(recovery).not.toContain('}, 1500)');
    expect(recovery).not.toContain("type: 'GET_VERSION_STATE'");
    expect(recovery).not.toContain('window.caches');
    expect(recovery).not.toContain('drawnix-static-v');
  });

  it('waits for a slow SW result and resends the same boot recovery identity', async () => {
    vi.useFakeTimers();
    let finishInvalidation: (() => void) | undefined;
    const invalidation = new Promise<void>((resolve) => {
      finishInvalidation = resolve;
    });
    const postedRequests: unknown[] = [];
    const postMessage = vi.fn(
      (message: unknown, transfer: Transferable[] = []) => {
        postedRequests.push(message);
        const request = message as BootRecoveryRequest;
        const replyPort = transfer[0] as MessagePort;
        void invalidation.then(() => {
          replyPort.postMessage({
            type: 'SW_RELEASE_STATIC_RECOVERY_RESULT',
            releaseId: request.releaseId,
            requestId: request.requestId,
            accepted: true,
            invalidatedEntries: 1,
          });
        });
      }
    );
    const prepareBootImportRecovery = await createBootRecoveryHarness(
      postMessage
    );

    const recovery = prepareBootImportRecovery(new Error('chunk failed'));
    await vi.advanceTimersByTimeAsync(100);
    await vi.advanceTimersByTimeAsync(1);
    expect(postMessage).toHaveBeenCalledTimes(2);

    finishInvalidation?.();
    await expect(recovery).resolves.toMatchObject({
      mode: 'acknowledged',
      acknowledgement: { accepted: true },
    });
    expect(postedRequests[0]).toEqual(postedRequests[1]);
  });

  it('accepts an idempotent completion after the first boot ACK was lost', async () => {
    vi.useFakeTimers();
    const postedRequests: unknown[] = [];
    const postMessage = vi.fn(
      (message: unknown, transfer: Transferable[] = []) => {
        postedRequests.push(message);
        if (postedRequests.length !== 2) {
          return;
        }
        const request = message as BootRecoveryRequest;
        const replyPort = transfer[0] as MessagePort;
        replyPort.postMessage({
          type: 'SW_RELEASE_STATIC_RECOVERY_RESULT',
          releaseId: request.releaseId,
          requestId: request.requestId,
          accepted: true,
          invalidatedEntries: 0,
        });
      }
    );
    const prepareBootImportRecovery = await createBootRecoveryHarness(
      postMessage
    );

    const recovery = prepareBootImportRecovery(new Error('chunk failed'));
    await vi.advanceTimersByTimeAsync(100);
    await vi.advanceTimersByTimeAsync(1);

    await expect(recovery).resolves.toMatchObject({
      mode: 'acknowledged',
      acknowledgement: {
        accepted: true,
        invalidatedEntries: 0,
      },
    });
    expect(postedRequests[0]).toEqual(postedRequests[1]);
  });

  it('rejects a failure ACK instead of entering the boot reload path', async () => {
    const postMessage = vi.fn(
      (message: unknown, transfer: Transferable[] = []) => {
        const request = message as BootRecoveryRequest;
        const replyPort = transfer[0] as MessagePort;
        replyPort.postMessage({
          type: 'SW_RELEASE_STATIC_RECOVERY_RESULT',
          releaseId: request.releaseId,
          requestId: request.requestId,
          accepted: false,
          invalidatedEntries: 0,
          reason: 'invalidation-failed',
        });
      }
    );
    const prepareBootImportRecovery = await createBootRecoveryHarness(
      postMessage
    );

    await expect(
      prepareBootImportRecovery(new Error('chunk failed'))
    ).rejects.toThrow('invalidation-failed');
    expect(postMessage).toHaveBeenCalledTimes(1);
  });

  it('marks an uncontrolled page as safe without waiting for a SW ACK', async () => {
    const postMessage = vi.fn();
    const prepareBootImportRecovery = await createBootRecoveryHarness(
      postMessage,
      { controlled: false }
    );

    await expect(
      prepareBootImportRecovery(new Error('chunk failed'))
    ).resolves.toEqual({ mode: 'uncontrolled' });
    expect(postMessage).not.toHaveBeenCalled();
  });

  it('delivers a CSS preload failure module through the same ACK contract', async () => {
    const cssError = new Error(
      'Unable to preload CSS for https://example.test/assets/editor.css'
    );
    const moduleKey = await extractBootImportModuleKey(cssError);
    expect(moduleKey).toBe('/assets/editor.css');
    const postMessage = vi.fn(
      (message: unknown, transfer: Transferable[] = []) => {
        const request = message as BootRecoveryRequest;
        const replyPort = transfer[0] as MessagePort;
        replyPort.postMessage({
          type: 'SW_RELEASE_STATIC_RECOVERY_RESULT',
          releaseId: request.releaseId,
          requestId: request.requestId,
          accepted: true,
          invalidatedEntries: 1,
        });
      }
    );
    const prepareBootImportRecovery = await createBootRecoveryHarness(
      postMessage,
      { moduleKey }
    );

    await expect(prepareBootImportRecovery(cssError)).resolves.toMatchObject({
      mode: 'acknowledged',
    });
    expect(postMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        target: { kind: 'module', moduleKey: '/assets/editor.css' },
      }),
      [expect.anything()]
    );
  });

  it('uses a URL-less reload-only target without guessing a module path', async () => {
    const urlLessError = new Error('Importing a module script failed');
    await expect(extractBootImportModuleKey(urlLessError)).resolves.toBeNull();
    const postMessage = vi.fn(
      (message: unknown, transfer: Transferable[] = []) => {
        const request = message as BootRecoveryRequest;
        expect(request.target).toEqual({ kind: 'reload-only' });
        (transfer[0] as MessagePort).postMessage({
          type: 'SW_RELEASE_STATIC_RECOVERY_RESULT',
          releaseId: request.releaseId,
          requestId: request.requestId,
          accepted: true,
          invalidatedEntries: 0,
        });
      }
    );
    const prepareBootImportRecovery = await createBootRecoveryHarness(
      postMessage,
      { moduleKey: null }
    );

    await expect(
      prepareBootImportRecovery(urlLessError)
    ).resolves.toMatchObject({
      mode: 'acknowledged',
      acknowledgement: { accepted: true, invalidatedEntries: 0 },
    });
    expect(postMessage).toHaveBeenCalledTimes(1);
  });

  it('never dispatches the legacy destructive type to an old controller', async () => {
    const deleteAllReleaseCaches = vi.fn();
    const oldControllerPostMessage = vi.fn((message: { type?: string }) => {
      if (message.type === 'RECOVER_DYNAMIC_IMPORT_FAILURE') {
        deleteAllReleaseCaches();
      }
    });
    const waitingPostMessage = vi.fn(
      (message: unknown, transfer: Transferable[] = []) => {
        const request = message as BootRecoveryRequest;
        (transfer[0] as MessagePort).postMessage({
          type: 'SW_RELEASE_STATIC_RECOVERY_RESULT',
          releaseId: request.releaseId,
          requestId: request.requestId,
          accepted: true,
          invalidatedEntries: 1,
        });
      }
    );
    const prepareBootImportRecovery = await createBootRecoveryHarness(
      oldControllerPostMessage,
      { activePostMessage: waitingPostMessage }
    );

    await expect(
      prepareBootImportRecovery(new Error('chunk failed'))
    ).resolves.toMatchObject({ mode: 'acknowledged' });
    expect(waitingPostMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'SW_RELEASE_STATIC_RECOVERY_REQUEST',
      }),
      [expect.anything()]
    );
    expect(oldControllerPostMessage).not.toHaveBeenCalled();
    expect(deleteAllReleaseCaches).not.toHaveBeenCalled();
  });

  it('uses an explicit build marker instead of inferring development from localhost', async () => {
    const html = await readBootHtml();
    const modeStart = html.indexOf('function isBootLocalDevelopment');
    const modeEnd = html.indexOf(
      'function isManagedBootFallbackTarget',
      modeStart
    );
    const modeResolver = html.slice(modeStart, modeEnd);

    expect(modeStart).toBeGreaterThan(0);
    expect(modeResolver).toContain('app-build-mode');
    expect(modeResolver).not.toContain('location.hostname');
  });

  it('keeps origin recovery active without manufacturing CDN candidates from localhost', async () => {
    const [serviceWorkerSource, cdnFallbackSource] = await Promise.all([
      readServiceWorkerSource(),
      readCDNFallbackSource(),
    ]);

    expect(serviceWorkerSource).toContain(
      'const isDevelopment = import.meta.env.DEV'
    );
    expect(cdnFallbackSource).not.toContain('location.hostname');
    expect(cdnFallbackSource).not.toContain('if (isDevelopment)');
    expect(cdnFallbackSource).toContain('const CDN_SOURCES: CDNSource[] = []');
  });

  it('never resolves a committed cache miss from another release namespace', async () => {
    const serviceWorkerSource = await readServiceWorkerSource();

    expect(serviceWorkerSource).toContain('isPrecacheResponseValidForRelease');
    expect(serviceWorkerSource).toContain(
      'createCompletedDynamicImportRecoveryResult'
    );
    expect(serviceWorkerSource).not.toContain('findStaticResponseInOldCaches');
    expect(serviceWorkerSource).not.toContain("cache: 'only-if-cached'");
  });

  it('routes recovery and version-state claims through the atomic durable ownership boundary', async () => {
    const serviceWorkerSource = await readServiceWorkerSource();
    const rememberStart = serviceWorkerSource.indexOf(
      'async function rememberClientReleaseOwnership'
    );
    const rememberEnd = serviceWorkerSource.indexOf(
      'async function resolveClientReleaseOwnership',
      rememberStart
    );
    const rememberOwnership = serviceWorkerSource.slice(
      rememberStart,
      rememberEnd
    );
    const recoveryStart = serviceWorkerSource.indexOf(
      'event.data.type === DYNAMIC_IMPORT_RECOVERY_REQUEST_TYPE'
    );
    const recoveryEnd = serviceWorkerSource.indexOf(
      "event.data.type === 'SW_BOOT_PROGRESS_GET'",
      recoveryStart
    );
    const recoveryHandler = serviceWorkerSource.slice(
      recoveryStart,
      recoveryEnd
    );
    const versionStateStart = serviceWorkerSource.indexOf(
      "event.data.type === 'GET_VERSION_STATE'",
      recoveryEnd
    );
    const versionStateEnd = serviceWorkerSource.indexOf(
      "event.data.type === 'SW_PREFETCH_GROUPS'",
      versionStateStart
    );
    const versionStateHandler = serviceWorkerSource.slice(
      versionStateStart,
      versionStateEnd
    );

    expect(rememberStart).toBeGreaterThan(0);
    expect(rememberEnd).toBeGreaterThan(rememberStart);
    expect(recoveryStart).toBeGreaterThan(0);
    expect(recoveryEnd).toBeGreaterThan(recoveryStart);
    expect(versionStateStart).toBeGreaterThan(recoveryEnd);
    expect(versionStateEnd).toBeGreaterThan(versionStateStart);
    expect(serviceWorkerSource).not.toContain('SW_IDLE_PREFETCH_STATUS');
    expect(serviceWorkerSource).not.toContain('broadcastIdlePrefetchStatus');
    expect(rememberOwnership).toContain(
      'resolveOrEstablishSWClientReleaseOwnership'
    );
    expect(rememberOwnership).toContain(
      'clientReleaseOwnership.set(clientId, resolvedReleaseId)'
    );
    expect(
      rememberOwnership.indexOf(
        'await resolveOrEstablishSWClientReleaseOwnership'
      )
    ).toBeLessThan(
      rememberOwnership.indexOf(
        'clientReleaseOwnership.set(clientId, resolvedReleaseId)'
      )
    );
    expect(recoveryHandler).toContain('await rememberClientReleaseOwnership');
    expect(recoveryHandler).toContain('if (!targetValid)');
    expect(recoveryHandler).toContain("reason: 'module-not-found'");
    expect(recoveryHandler).toContain(
      'createCompletedDynamicImportRecoveryResult'
    );
    expect(versionStateHandler).toContain(
      'await rememberClientReleaseOwnership(client.id, reportedReleaseId)'
    );
    expect(
      recoveryHandler.indexOf('await rememberClientReleaseOwnership')
    ).toBeLessThan(
      recoveryHandler.indexOf('shouldAcceptDynamicImportRecovery')
    );
  });

  it('rejects a modern commit before activation when durable client ownership does not match', async () => {
    const serviceWorkerSource = await readServiceWorkerSource();
    const commitStart = serviceWorkerSource.indexOf(
      "event.data.type === 'COMMIT_UPGRADE'"
    );
    const commitEnd = serviceWorkerSource.indexOf(
      "event.data.type === 'FORCE_UPGRADE'",
      commitStart
    );
    const commitHandler = serviceWorkerSource.slice(commitStart, commitEnd);
    const messageValidation = commitHandler.indexOf(
      'getUpgradeCommitRejectionReason'
    );
    const durableClaim = commitHandler.indexOf(
      'resolvedClientReleaseId = await rememberClientReleaseOwnership'
    );
    const ownershipValidation = commitHandler.indexOf(
      'getUpgradeCommitOwnershipRejectionReason'
    );
    const rejectionBranch = commitHandler.indexOf('if (!accepted)');
    const executeCommit = commitHandler.indexOf('executeUpgradeCommit');

    expect(commitStart).toBeGreaterThan(0);
    expect(commitEnd).toBeGreaterThan(commitStart);
    expect(messageValidation).toBeGreaterThan(0);
    expect(durableClaim).toBeGreaterThan(messageValidation);
    expect(ownershipValidation).toBeGreaterThan(durableClaim);
    expect(rejectionBranch).toBeGreaterThan(ownershipValidation);
    expect(executeCommit).toBeGreaterThan(rejectionBranch);
    expect(commitHandler).toContain(
      'let resolvedClientReleaseId: string | null'
    );
  });
});
