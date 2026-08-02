import {
  DYNAMIC_IMPORT_RECOVERY_REQUEST_TYPE,
  resolveDynamicImportRecoveryAcknowledgement,
  type DynamicImportRecoveryAcknowledgement,
  type DynamicImportRecoveryRequest,
  type DynamicImportRecoveryTarget,
} from '../sw/release-contract';

const LAZY_CHUNK_RETRY_KEY_PREFIX = 'aitu:lazy-chunk-retry';
const LAZY_CHUNK_RETRY_PARAM = '_lazy_chunk_retry';
const LAZY_CHUNK_RETRY_TS_PARAM = '_t';
const DYNAMIC_IMPORT_RECOVERY_ACK_TIMEOUT_MS = 4000;
const DYNAMIC_IMPORT_RECOVERY_MAX_ATTEMPTS = 3;
const DYNAMIC_IMPORT_RECOVERY_RETRY_DELAY_MS = 250;
const DYNAMIC_IMPORT_ERROR_PATTERNS = [
  /Failed to fetch dynamically imported module/i,
  /Importing a module script failed/i,
  /Unable to preload CSS/i,
  /Loading chunk [\w-]+ failed/i,
  /ChunkLoadError/i,
];

let lazyAssetRecoveryScheduled = false;
let dynamicImportRecoverySequence = 0;

interface DynamicImportRecoveryWorker {
  postMessage(message: unknown, transfer?: Transferable[]): void;
}

interface DynamicImportRecoveryDeliveryOptions {
  timeoutMs?: number;
  maxAttempts?: number;
  retryDelayMs?: number;
  createMessageChannel?: () => MessageChannel | null;
  messageTarget?: DynamicImportRecoveryMessageTarget | null;
}

interface DynamicImportRecoveryMessageTarget {
  addEventListener(
    type: 'message',
    listener: (event: MessageEvent<unknown>) => void
  ): void;
  removeEventListener(
    type: 'message',
    listener: (event: MessageEvent<unknown>) => void
  ): void;
}

function getDefaultRecoveryMessageTarget(): DynamicImportRecoveryMessageTarget | null {
  if (
    typeof navigator === 'undefined' ||
    !('serviceWorker' in navigator) ||
    !navigator.serviceWorker
  ) {
    return null;
  }
  return navigator.serviceWorker;
}

function createDefaultRecoveryMessageChannel(): MessageChannel | null {
  return typeof MessageChannel === 'function' ? new MessageChannel() : null;
}

function postDynamicImportRecoveryAttempt(
  worker: DynamicImportRecoveryWorker,
  request: DynamicImportRecoveryRequest,
  timeoutMs: number,
  createMessageChannel: () => MessageChannel | null,
  messageTarget: DynamicImportRecoveryMessageTarget | null
): Promise<DynamicImportRecoveryAcknowledgement> {
  return new Promise((resolve, reject) => {
    let channel: MessageChannel | null = null;
    try {
      channel = createMessageChannel();
    } catch {
      channel = null;
    }
    let settled = false;
    let fallbackMessageListener:
      | ((event: MessageEvent<unknown>) => void)
      | null = null;
    const timeout = setTimeout(() => {
      settleWithError(
        new Error('Dynamic import cache invalidation acknowledgement timed out')
      );
    }, timeoutMs);

    const cleanup = () => {
      clearTimeout(timeout);
      if (channel) {
        channel.port1.onmessage = null;
        channel.port1.onmessageerror = null;
        channel.port1.close();
      }
      if (fallbackMessageListener && messageTarget) {
        messageTarget.removeEventListener('message', fallbackMessageListener);
      }
    };
    const settleWithError = (error: Error) => {
      if (settled) {
        return;
      }
      settled = true;
      cleanup();
      reject(error);
    };
    const settleFromMessage = (data: unknown) => {
      const acknowledgement = resolveDynamicImportRecoveryAcknowledgement(
        data,
        request
      );
      if (!acknowledgement || settled) {
        return;
      }
      settled = true;
      cleanup();
      resolve(acknowledgement);
    };

    if (channel) {
      channel.port1.onmessage = (event: MessageEvent<unknown>) => {
        settleFromMessage(event.data);
      };
      channel.port1.onmessageerror = () => {
        settleWithError(
          new Error('Dynamic import cache invalidation acknowledgement failed')
        );
      };
      channel.port1.start();
    } else if (messageTarget) {
      fallbackMessageListener = (event: MessageEvent<unknown>) => {
        settleFromMessage(event.data);
      };
      messageTarget.addEventListener('message', fallbackMessageListener);
    } else {
      settleWithError(
        new Error('Dynamic import acknowledgement channel is unavailable')
      );
      return;
    }

    try {
      if (channel) {
        worker.postMessage(request, [channel.port2]);
      } else {
        worker.postMessage(request);
      }
    } catch (error) {
      settleWithError(
        error instanceof Error
          ? error
          : new Error('Dynamic import cache invalidation delivery failed')
      );
    }
  });
}

export async function postDynamicImportRecoveryWithAcknowledgement(
  worker: DynamicImportRecoveryWorker,
  request: DynamicImportRecoveryRequest,
  {
    timeoutMs = DYNAMIC_IMPORT_RECOVERY_ACK_TIMEOUT_MS,
    maxAttempts = DYNAMIC_IMPORT_RECOVERY_MAX_ATTEMPTS,
    retryDelayMs = DYNAMIC_IMPORT_RECOVERY_RETRY_DELAY_MS,
    createMessageChannel = createDefaultRecoveryMessageChannel,
    messageTarget = getDefaultRecoveryMessageTarget(),
  }: DynamicImportRecoveryDeliveryOptions = {}
): Promise<DynamicImportRecoveryAcknowledgement> {
  const safeMaxAttempts = Math.max(1, Math.floor(maxAttempts));
  let lastError: Error | null = null;
  for (let attempt = 1; attempt <= safeMaxAttempts; attempt += 1) {
    try {
      return await postDynamicImportRecoveryAttempt(
        worker,
        request,
        timeoutMs,
        createMessageChannel,
        messageTarget
      );
    } catch (error) {
      lastError =
        error instanceof Error
          ? error
          : new Error('Dynamic import cache invalidation delivery failed');
      if (attempt < safeMaxAttempts && retryDelayMs > 0) {
        await new Promise<void>((resolve) => {
          setTimeout(resolve, retryDelayMs);
        });
      }
    }
  }
  throw (
    lastError ||
    new Error('Dynamic import cache invalidation was not acknowledged')
  );
}

type ErrorLikeEvent = Event & {
  error?: unknown;
  reason?: unknown;
  payload?: unknown;
  message?: string;
};

function getAppVersion(): string {
  if (typeof document === 'undefined') {
    return 'unknown';
  }

  return (
    document
      .querySelector('meta[name="app-version"]')
      ?.getAttribute('content') || 'unknown'
  );
}

function getAppReleaseId(): string {
  if (typeof document === 'undefined') {
    return 'unknown';
  }

  return (
    document
      .querySelector('meta[name="app-release-id"]')
      ?.getAttribute('content') || getAppVersion()
  );
}

function getEventTargetAssetUrl(target: EventTarget | null): string | null {
  if (!(target instanceof HTMLElement)) {
    return null;
  }

  const assetTarget = target as HTMLElement & {
    src?: string;
    currentSrc?: string;
    href?: string;
  };

  return assetTarget.currentSrc || assetTarget.src || assetTarget.href || null;
}

function serializeError(error: unknown, depth = 0): string {
  if (error instanceof Error) {
    const parts = [error.name, error.message, error.stack];
    const errorWithCause = error as Error & { cause?: unknown };
    if (errorWithCause.cause && depth < 2) {
      parts.push(serializeError(errorWithCause.cause, depth + 1));
    }
    return parts.filter(Boolean).join('\n');
  }

  if (typeof Event !== 'undefined' && error instanceof Event) {
    const event = error as ErrorLikeEvent;
    const parts = [`event:${event.type}`];
    const targetAssetUrl = getEventTargetAssetUrl(event.target);

    if (event.message) {
      parts.push(event.message);
    }
    if (targetAssetUrl) {
      parts.push(targetAssetUrl);
    }

    if (depth < 2) {
      [event.error, event.reason, event.payload].forEach((value) => {
        if (value && value !== error) {
          parts.push(serializeError(value, depth + 1));
        }
      });
    }

    return parts.filter(Boolean).join('\n');
  }

  return String(error ?? '');
}

function extractModuleKey(errorText: string): string | null {
  const matchedUrl = errorText.match(
    /https?:\/\/[^\s)'"]+\.(?:js|css)(?:\?[^\s)'"]*)?/i
  );
  if (!matchedUrl) {
    return null;
  }

  try {
    return new URL(matchedUrl[0]).pathname;
  } catch {
    return matchedUrl[0];
  }
}

function isRecoverableDynamicImportError(error: unknown): boolean {
  const errorText = serializeError(error);
  return DYNAMIC_IMPORT_ERROR_PATTERNS.some((pattern) =>
    pattern.test(errorText)
  );
}

async function prepareDynamicImportRecoveryReload(
  moduleKey: string | null
): Promise<void> {
  const controller = navigator.serviceWorker?.controller;
  const releaseId = getAppReleaseId();
  const target: DynamicImportRecoveryTarget = moduleKey
    ? { kind: 'module', moduleKey }
    : { kind: 'reload-only' };
  const recoveryRequest: DynamicImportRecoveryRequest = {
    type: DYNAMIC_IMPORT_RECOVERY_REQUEST_TYPE,
    releaseId,
    requestId: `${releaseId}:${Date.now()}:${++dynamicImportRecoverySequence}`,
    target,
  };

  if (controller) {
    const workers: DynamicImportRecoveryWorker[] = [];
    const addWorker = (worker: DynamicImportRecoveryWorker | null) => {
      if (worker && !workers.includes(worker)) {
        workers.push(worker);
      }
    };

    try {
      const registration = await navigator.serviceWorker.getRegistration();
      const addRegistrationWorkers = () => {
        addWorker(registration?.waiting || null);
        if (registration?.active !== controller) {
          addWorker(registration?.active || null);
        }
      };
      addRegistrationWorkers();
      if (
        !registration?.waiting &&
        (!registration?.active || registration.active === controller)
      ) {
        await registration?.update();
        addRegistrationWorkers();
      }
    } catch (error) {
      console.warn(
        '[ErrorBoundary] Service Worker update check failed during lazy recovery:',
        error
      );
    }
    // A newly installed or activated worker understands the versioned
    // contract; the current page may still use the previous controller.
    addWorker(controller);

    let lastDeliveryError: Error | null = null;
    for (const worker of workers) {
      try {
        const acknowledgement =
          await postDynamicImportRecoveryWithAcknowledgement(
            worker,
            recoveryRequest
          );
        if (acknowledgement.accepted) {
          return;
        }
        lastDeliveryError = new Error(
          `Dynamic import cache invalidation was rejected: ${
            acknowledgement.reason || 'unknown-reason'
          }`
        );
        if (acknowledgement.reason !== 'release-mismatch') {
          throw lastDeliveryError;
        }
      } catch (error) {
        lastDeliveryError =
          error instanceof Error
            ? error
            : new Error('Dynamic import cache invalidation delivery failed');
      }
    }
    throw (
      lastDeliveryError ||
      new Error('No Service Worker accepted dynamic import recovery')
    );
  }

  // An uncontrolled page cannot have a Service Worker invalidation in flight.
  // Preserve the one-time cache-busted reload for older/uncontrolled clients.
}

export async function reloadAfterDynamicImportRecovery(
  moduleKey: string | null,
  reload: () => void
): Promise<void> {
  await prepareDynamicImportRecoveryReload(moduleKey);
  reload();
}

export function tryRecoverDynamicImportError(error: unknown): boolean {
  if (!isRecoverableDynamicImportError(error)) {
    return false;
  }

  if (lazyAssetRecoveryScheduled) {
    return true;
  }

  if (typeof window === 'undefined') {
    return false;
  }

  const errorText = serializeError(error);
  const moduleKey = extractModuleKey(errorText);
  const retryKey = `${LAZY_CHUNK_RETRY_KEY_PREFIX}:${getAppReleaseId()}:${
    moduleKey || 'reload-only'
  }`;

  try {
    if (sessionStorage.getItem(retryKey) === '1') {
      return false;
    }

    sessionStorage.setItem(retryKey, '1');
  } catch {
    const currentUrl = new URL(window.location.href);
    if (currentUrl.searchParams.has(LAZY_CHUNK_RETRY_PARAM)) {
      return false;
    }
  }

  lazyAssetRecoveryScheduled = true;

  const reloadUrl = new URL(window.location.href);
  reloadUrl.searchParams.set(LAZY_CHUNK_RETRY_PARAM, '1');
  reloadUrl.searchParams.set(LAZY_CHUNK_RETRY_TS_PARAM, String(Date.now()));

  console.warn(
    '[ErrorBoundary] Detected stale lazy asset. Preparing one safe recovery.',
    error
  );

  let didReload = false;
  const reload = () => {
    if (didReload) {
      return;
    }
    didReload = true;
    window.location.replace(reloadUrl.toString());
  };

  void reloadAfterDynamicImportRecovery(moduleKey, reload).catch((error) => {
    console.warn(
      '[ErrorBoundary] Dynamic import recovery did not complete; reload was suppressed:',
      error
    );
  });

  return true;
}
