// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest';

interface TestMessagePort {
  onmessage: ((event: MessageEvent<unknown>) => void) | null;
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
        port1.onmessage?.({ data } as MessageEvent<unknown>);
      }
    },
  };
  return { port1, port2 } as unknown as MessageChannel;
};

const recoveryRequest = {
  type: 'SW_RELEASE_STATIC_RECOVERY_REQUEST' as const,
  releaseId: 'release-a',
  requestId: 'recovery-1',
  target: { kind: 'module' as const, moduleKey: '/assets/editor.js' },
};

const createAcceptedAcknowledgement = (invalidatedEntries = 1) => ({
  type: 'SW_RELEASE_STATIC_RECOVERY_RESULT' as const,
  releaseId: recoveryRequest.releaseId,
  requestId: recoveryRequest.requestId,
  accepted: true,
  invalidatedEntries,
});

describe('lazy asset recovery release boundary', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    document.head.innerHTML = '';
    window.sessionStorage.clear();
  });

  it('delegates recovery for the page release without deleting release caches in the page', async () => {
    vi.useFakeTimers();
    vi.resetModules();
    document.head.innerHTML = [
      '<meta name="app-version" content="1.0.2" />',
      '<meta name="app-release-id" content="release-a" />',
    ].join('');

    const postMessage = vi.fn();
    Object.defineProperty(navigator, 'serviceWorker', {
      configurable: true,
      value: {
        controller: { postMessage },
        getRegistration: vi.fn(async () => undefined),
      },
    });

    const deleteCache = vi.fn(async () => true);
    const listCaches = vi.fn(async () => [
      'drawnix-static-vrelease-a',
      'drawnix-static-vrelease-b',
      'drawnix-images',
    ]);
    vi.stubGlobal('caches', {
      keys: listCaches,
      delete: deleteCache,
    });

    const { tryRecoverDynamicImportError } = await import(
      './lazy-asset-recovery'
    );
    expect(
      tryRecoverDynamicImportError(
        new Error(
          'Failed to fetch dynamically imported module: https://example.test/assets/editor.js'
        )
      )
    ).toBe(true);

    await Promise.resolve();
    await Promise.resolve();

    expect(postMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'SW_RELEASE_STATIC_RECOVERY_REQUEST',
        releaseId: 'release-a',
        target: { kind: 'module', moduleKey: '/assets/editor.js' },
        requestId: expect.any(String),
      }),
      [expect.any(MessagePort)]
    );
    expect(listCaches).not.toHaveBeenCalled();
    expect(deleteCache).not.toHaveBeenCalled();
  });

  it('waits for a correlated Service Worker invalidation acknowledgement', async () => {
    vi.resetModules();
    const postMessage = vi.fn(
      (message: unknown, transfer: Transferable[] = []) => {
        const request = message as {
          releaseId: string;
          requestId: string;
        };
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
    const { postDynamicImportRecoveryWithAcknowledgement } = await import(
      './lazy-asset-recovery'
    );

    await expect(
      postDynamicImportRecoveryWithAcknowledgement(
        { postMessage },
        recoveryRequest,
        { timeoutMs: 1000 }
      )
    ).resolves.toMatchObject({
      accepted: true,
      invalidatedEntries: 1,
    });
    expect(postMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        releaseId: 'release-a',
        target: { kind: 'module', moduleKey: '/assets/editor.js' },
      }),
      [expect.any(MessagePort)]
    );
  });

  it('keeps waiting through a slow invalidation and reuses the same request identity', async () => {
    vi.useFakeTimers();
    vi.resetModules();
    let finishInvalidation: (() => void) | undefined;
    const invalidation = new Promise<void>((resolve) => {
      finishInvalidation = resolve;
    });
    const postedRequests: unknown[] = [];
    const postMessage = vi.fn(
      (message: unknown, transfer: Transferable[] = []) => {
        postedRequests.push(message);
        const replyPort = transfer[0] as MessagePort;
        void invalidation.then(() => {
          replyPort.postMessage(createAcceptedAcknowledgement());
        });
      }
    );
    const { postDynamicImportRecoveryWithAcknowledgement } = await import(
      './lazy-asset-recovery'
    );

    const acknowledgement = postDynamicImportRecoveryWithAcknowledgement(
      { postMessage },
      recoveryRequest,
      {
        timeoutMs: 100,
        maxAttempts: 2,
        retryDelayMs: 0,
        createMessageChannel: createTestMessageChannel,
        messageTarget: null,
      }
    );
    await vi.advanceTimersByTimeAsync(100);
    expect(postMessage).toHaveBeenCalledTimes(2);

    finishInvalidation?.();
    await expect(acknowledgement).resolves.toMatchObject({
      accepted: true,
      invalidatedEntries: 1,
    });
    expect(postedRequests).toEqual([recoveryRequest, recoveryRequest]);
  });

  it('retries a lost ACK with the same request and accepts the replay', async () => {
    vi.useFakeTimers();
    vi.resetModules();
    const postedRequests: unknown[] = [];
    const postMessage = vi.fn(
      (message: unknown, transfer: Transferable[] = []) => {
        postedRequests.push(message);
        if (postedRequests.length === 2) {
          const replyPort = transfer[0] as MessagePort;
          replyPort.postMessage(createAcceptedAcknowledgement(0));
        }
      }
    );
    const { postDynamicImportRecoveryWithAcknowledgement } = await import(
      './lazy-asset-recovery'
    );

    const acknowledgement = postDynamicImportRecoveryWithAcknowledgement(
      { postMessage },
      recoveryRequest,
      {
        timeoutMs: 100,
        maxAttempts: 2,
        retryDelayMs: 0,
        createMessageChannel: createTestMessageChannel,
        messageTarget: null,
      }
    );
    await vi.advanceTimersByTimeAsync(100);

    await expect(acknowledgement).resolves.toMatchObject({
      accepted: true,
      invalidatedEntries: 0,
    });
    expect(postedRequests).toEqual([recoveryRequest, recoveryRequest]);
  });

  it('supports a correlated global-message ACK when MessageChannel is unavailable', async () => {
    vi.resetModules();
    let listener: ((event: MessageEvent<unknown>) => void) | null = null;
    const messageTarget = {
      addEventListener: vi.fn(
        (
          _type: 'message',
          nextListener: (event: MessageEvent<unknown>) => void
        ) => {
          listener = nextListener;
        }
      ),
      removeEventListener: vi.fn(() => {
        listener = null;
      }),
    };
    const postMessage = vi.fn(() => {
      listener?.({
        data: createAcceptedAcknowledgement(),
      } as MessageEvent<unknown>);
    });
    const { postDynamicImportRecoveryWithAcknowledgement } = await import(
      './lazy-asset-recovery'
    );

    await expect(
      postDynamicImportRecoveryWithAcknowledgement(
        { postMessage },
        recoveryRequest,
        {
          createMessageChannel: () => null,
          messageTarget,
        }
      )
    ).resolves.toMatchObject({ accepted: true, invalidatedEntries: 1 });
    expect(postMessage).toHaveBeenCalledWith(recoveryRequest);
    expect(messageTarget.removeEventListener).toHaveBeenCalledOnce();
  });

  it('does not reload after an explicit failure acknowledgement', async () => {
    vi.resetModules();
    document.head.innerHTML = [
      '<meta name="app-version" content="1.0.2" />',
      '<meta name="app-release-id" content="release-a" />',
    ].join('');
    const postMessage = vi.fn(
      (message: unknown, transfer: Transferable[] = []) => {
        const request = message as {
          releaseId: string;
          requestId: string;
        };
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
    Object.defineProperty(navigator, 'serviceWorker', {
      configurable: true,
      value: {
        controller: { postMessage },
        getRegistration: vi.fn(async () => undefined),
      },
    });
    const reload = vi.fn();
    const { reloadAfterDynamicImportRecovery } = await import(
      './lazy-asset-recovery'
    );

    await expect(
      reloadAfterDynamicImportRecovery('/assets/editor.js', reload)
    ).rejects.toThrow('invalidation-failed');
    expect(reload).not.toHaveBeenCalled();
    expect(postMessage).toHaveBeenCalledTimes(1);
  });

  it('uses a non-controlling active modern worker without triggering the legacy cache-wide message', async () => {
    vi.resetModules();
    document.head.innerHTML = [
      '<meta name="app-version" content="1.0.3" />',
      '<meta name="app-release-id" content="release-b" />',
    ].join('');
    const deleteAllReleaseCaches = vi.fn();
    const legacyControllerPostMessage = vi.fn((message: { type?: string }) => {
      // This is the exact destructive dispatch contract in the previously
      // released worker. A versioned request must never enter it.
      if (message.type === 'RECOVER_DYNAMIC_IMPORT_FAILURE') {
        deleteAllReleaseCaches();
      }
    });
    const waitingPostMessage = vi.fn(
      (message: unknown, transfer: Transferable[] = []) => {
        const request = message as {
          releaseId: string;
          requestId: string;
        };
        (transfer[0] as MessagePort).postMessage({
          type: 'SW_RELEASE_STATIC_RECOVERY_RESULT',
          releaseId: request.releaseId,
          requestId: request.requestId,
          accepted: true,
          invalidatedEntries: 1,
        });
      }
    );
    Object.defineProperty(navigator, 'serviceWorker', {
      configurable: true,
      value: {
        controller: { postMessage: legacyControllerPostMessage },
        getRegistration: vi.fn(async () => ({
          active: { postMessage: waitingPostMessage },
          update: vi.fn(async () => undefined),
        })),
      },
    });
    const reload = vi.fn();
    const { reloadAfterDynamicImportRecovery } = await import(
      './lazy-asset-recovery'
    );

    await expect(
      reloadAfterDynamicImportRecovery('/assets/editor.js', reload)
    ).resolves.toBeUndefined();
    expect(reload).toHaveBeenCalledOnce();
    expect(waitingPostMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'SW_RELEASE_STATIC_RECOVERY_REQUEST',
        releaseId: 'release-b',
      }),
      [expect.any(MessagePort)]
    );
    expect(legacyControllerPostMessage).not.toHaveBeenCalled();
    expect(deleteAllReleaseCaches).not.toHaveBeenCalled();
  });

  it('authorizes a URL-less import recovery without deleting a guessed module', async () => {
    vi.resetModules();
    document.head.innerHTML = [
      '<meta name="app-version" content="1.0.3" />',
      '<meta name="app-release-id" content="release-b" />',
    ].join('');
    const postMessage = vi.fn(
      (message: unknown, transfer: Transferable[] = []) => {
        const request = message as {
          releaseId: string;
          requestId: string;
          target: unknown;
        };
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
    Object.defineProperty(navigator, 'serviceWorker', {
      configurable: true,
      value: {
        controller: { postMessage },
        getRegistration: vi.fn(async () => undefined),
      },
    });
    const reload = vi.fn();
    const { reloadAfterDynamicImportRecovery } = await import(
      './lazy-asset-recovery'
    );

    await expect(
      reloadAfterDynamicImportRecovery(null, reload)
    ).resolves.toBeUndefined();
    expect(reload).toHaveBeenCalledOnce();
    expect(postMessage).toHaveBeenCalledTimes(1);
  });

  it('allows one cache-busted reload when the page is not SW-controlled', async () => {
    vi.resetModules();
    document.head.innerHTML = [
      '<meta name="app-version" content="1.0.2" />',
      '<meta name="app-release-id" content="release-a" />',
    ].join('');
    const update = vi.fn(async () => undefined);
    Object.defineProperty(navigator, 'serviceWorker', {
      configurable: true,
      value: {
        controller: null,
        getRegistration: vi.fn(async () => ({ update })),
      },
    });
    const reload = vi.fn();
    const { reloadAfterDynamicImportRecovery } = await import(
      './lazy-asset-recovery'
    );

    await expect(
      reloadAfterDynamicImportRecovery('/assets/editor.js', reload)
    ).resolves.toBeUndefined();
    expect(reload).toHaveBeenCalledOnce();
  });
});
