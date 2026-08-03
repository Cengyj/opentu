import { StrictMode } from 'react';
import * as ReactDOM from 'react-dom/client';
import App from './app';
import { ErrorBoundary } from './ErrorBoundary';
import { initCrashLogger } from '../crash-logger';
import {
  initWebVitals,
  initPageReport,
  initPreventPinchZoom,
  runDatabaseCleanup,
  storageMigrationService,
  initPromptStorageCache,
  toolbarConfigService,
  memoryMonitorService,
  crashRecoveryService,
  swChannelClient,
  getAnalyticsReleaseContext,
  registerAnalyticsSuperProperties,
} from '@drawnix/drawnix/runtime';
import { initSWConsoleCapture } from '../utils/sw-console-capture';
import {
  fetchVersionMetadata,
  installVersionUpgradeRuntime,
  postUpgradeCommitWithAcknowledgement,
  resolveServiceWorkerVersionState,
  subscribeToApprovedActivationReload,
} from './version-upgrade-runtime';

const swQueryParam =
  typeof window !== 'undefined'
    ? new URLSearchParams(window.location.search).get('sw')
    : null;
const isServiceWorkerExplicitlyDisabled = swQueryParam === '0';
const hasServiceWorkerSupport =
  typeof navigator !== 'undefined' && 'serviceWorker' in navigator;
const shouldUseServiceWorker =
  hasServiceWorkerSupport && !isServiceWorkerExplicitlyDisabled;

// ===== 控制台日志捕获（尽早初始化，确保默认 console 被改写） =====
// 必须在其他业务代码之前执行，否则后续工具（如 rrweb）可能先改写 console 导致捕获失效
if (shouldUseServiceWorker) {
  initSWConsoleCapture();
}

// ===== 崩溃恢复检测 =====
// 必须最先执行，检测上次是否因内存不足等原因崩溃
crashRecoveryService.markLoadingStart();
crashRecoveryService.checkUrlSafeMode();

// ===== 初始化崩溃日志系统 =====
// 必须尽早初始化，以捕获启动阶段的内存状态和错误
initCrashLogger();

const APP_VERSION =
  import.meta.env.VITE_APP_VERSION ||
  document.querySelector('meta[name="app-version"]')?.getAttribute('content') ||
  '0.0.0';
const APP_RELEASE_ID =
  import.meta.env.VITE_APP_RELEASE_ID ||
  document
    .querySelector('meta[name="app-release-id"]')
    ?.getAttribute('content') ||
  APP_VERSION;
const RELEASE_CONTEXT = getAnalyticsReleaseContext();
const LAZY_CHUNK_RETRY_PARAM = '_lazy_chunk_retry';
const LAZY_CHUNK_RETRY_TS_PARAM = '_t';

type CDNName = 'jsdelivr' | 'unpkg' | 'local';

interface RuntimeCDNPreference {
  cdn: CDNName;
  latency: number;
  timestamp: number;
}

interface RuntimeCDNApi {
  selectBestCDN: () => Promise<RuntimeCDNPreference | null>;
}

interface BootProgressOptions {
  title?: string;
  tip?: string;
  note?: string;
  source?: 'phase' | 'sw';
  progress?: number;
}

interface BootController {
  markReady: () => void;
  markError: (message?: string) => void;
  setProgress?: (progress?: number, options?: BootProgressOptions) => void;
}

declare global {
  interface Window {
    __OPENTU_CDN__?: RuntimeCDNPreference | null;
    __AITU_CDN__?: RuntimeCDNPreference | null;
    __OPENTU_CDN_API__?: RuntimeCDNApi;
    __AITU_CDN_API__?: RuntimeCDNApi;
    __OPENTU_BOOT__?: BootController;
    __OPENTU_SW_REGISTRATION_PROMISE__?: Promise<ServiceWorkerRegistration | null>;
  }
}

function cleanupLazyChunkRecoveryParams(): void {
  if (typeof window === 'undefined') {
    return;
  }

  const url = new URL(window.location.href);
  if (!url.searchParams.has(LAZY_CHUNK_RETRY_PARAM)) {
    return;
  }

  url.searchParams.delete(LAZY_CHUNK_RETRY_PARAM);
  url.searchParams.delete(LAZY_CHUNK_RETRY_TS_PARAM);

  try {
    window.history.replaceState(window.history.state, '', url.toString());
  } catch {
    // ignore URL cleanup failures and continue booting
  }
}

cleanupLazyChunkRecoveryParams();

function isValidCDNName(value: unknown): value is CDNName {
  return value === 'jsdelivr' || value === 'unpkg' || value === 'local';
}

function getBootController(): BootController | null {
  return window.__OPENTU_BOOT__ || null;
}

function updateBootStatus(options?: BootProgressOptions): void {
  getBootController()?.setProgress?.(options?.progress, options);
}

function getRuntimeCDNPreference(): RuntimeCDNPreference | null {
  const preference = window.__OPENTU_CDN__ || window.__AITU_CDN__;
  if (!preference || !isValidCDNName(preference.cdn)) {
    return null;
  }

  return {
    cdn: preference.cdn,
    latency:
      Number.isFinite(preference.latency) && preference.latency >= 0
        ? preference.latency
        : 0,
    timestamp:
      Number.isFinite(preference.timestamp) && preference.timestamp > 0
        ? preference.timestamp
        : Date.now(),
  };
}

function postCDNPreferenceToServiceWorker(
  registration: ServiceWorkerRegistration | null
): void {
  const preference = getRuntimeCDNPreference();
  if (!preference) {
    return;
  }

  const payload = {
    type: 'SW_CDN_SET_PREFERENCE' as const,
    ...preference,
    version: APP_VERSION,
  };

  const targets = new Set<ServiceWorker>();
  const maybeWorkers = [
    navigator.serviceWorker.controller,
    registration?.active,
    registration?.waiting,
    registration?.installing,
  ];

  for (const worker of maybeWorkers) {
    if (worker) {
      targets.add(worker);
    }
  }

  targets.forEach((worker) => {
    worker.postMessage(payload);
  });
}

function scheduleCDNPreferenceSync(
  registration: ServiceWorkerRegistration | null
): void {
  postCDNPreferenceToServiceWorker(registration);

  const api = window.__OPENTU_CDN_API__ || window.__AITU_CDN_API__;
  if (api?.selectBestCDN) {
    api
      .selectBestCDN()
      .then((preference) => {
        if (preference && isValidCDNName(preference.cdn)) {
          window.__OPENTU_CDN__ = preference;
        }
        postCDNPreferenceToServiceWorker(registration);
      })
      .catch((error) => {
        console.warn(
          '[Main] Failed to sync CDN preference to Service Worker:',
          error
        );
      });
  }
}

function cleanupDisabledServiceWorker(): void {
  navigator.serviceWorker
    .getRegistration()
    .then((registration) => registration?.unregister())
    .catch((error) => {
      console.warn('[Main] Disabled service worker cleanup failed:', error);
    });
}

function scheduleAfterFirstFrameIdle(
  callback: () => void,
  options: { delay?: number; timeout?: number } = {}
): void {
  if (typeof window === 'undefined') {
    return;
  }

  const { delay = 0, timeout = 2000 } = options;
  const run = () => {
    const idleCallback = (
      window as Window & {
        requestIdleCallback?: (
          cb: () => void,
          opts?: { timeout: number }
        ) => number;
      }
    ).requestIdleCallback;

    if (typeof idleCallback === 'function') {
      idleCallback(callback, { timeout });
      return;
    }

    window.setTimeout(callback, Math.min(timeout, 500));
  };

  const start = () => {
    if (delay > 0) {
      window.setTimeout(run, delay);
      return;
    }
    run();
  };

  window.requestAnimationFrame(() => {
    window.requestAnimationFrame(start);
  });
}

updateBootStatus({
  tip: '正在初始化启动服务...',
  source: 'phase',
  progress: 12,
});

// ===== 立即初始化防止双指缩放 =====
// 必须在任何其他代码之前执行，确保事件监听器最先注册
if (typeof window !== 'undefined') {
  initPreventPinchZoom();

  const initPostHogContext = () => {
    if (window.posthog) {
      registerAnalyticsSuperProperties(RELEASE_CONTEXT);
      initPageReport();
      return;
    }

    setTimeout(initPostHogContext, 300);
  };

  scheduleAfterFirstFrameIdle(initPostHogContext, {
    delay: 0,
    timeout: 1000,
  });

  scheduleAfterFirstFrameIdle(
    () => {
      runDatabaseCleanup().catch((error) => {
        console.warn('[Main] Database cleanup failed:', error);
      });

      storageMigrationService
        .runMigration()
        .then(() => {
          return Promise.all([
            initPromptStorageCache(),
            toolbarConfigService.initializeAsync(),
          ]);
        })
        .catch((error) => {
          console.warn('[Main] Storage migration/init failed:', error);
        });
    },
    {
      delay: 400,
      timeout: 2500,
    }
  );

  scheduleAfterFirstFrameIdle(
    () => {
      memoryMonitorService.start();
      memoryMonitorService.logMemoryStatus();
    },
    {
      delay: 5000,
      timeout: 2500,
    }
  );

  // 统计上报为旁路逻辑：page view 尽早初始化，性能指标继续延迟
  const initMonitoring = () => {
    if (window.posthog) {
      initWebVitals();
    } else {
      setTimeout(initMonitoring, 500);
    }
  };

  scheduleAfterFirstFrameIdle(initMonitoring, {
    delay: 1500,
    timeout: 3000,
  });
}

if (hasServiceWorkerSupport && isServiceWorkerExplicitlyDisabled) {
  cleanupDisabledServiceWorker();
}

// 注册Service Worker来处理CORS问题和PWA功能
if (shouldUseServiceWorker) {
  const isDevelopment = import.meta.env.DEV;
  const versionUpgradeRuntime = installVersionUpgradeRuntime(
    window,
    APP_RELEASE_ID
  );

  // 等待中的新 Worker
  let pendingWorker: ServiceWorker | null = null;
  let lastPendingReleaseNotified: string | null = null;
  let metadataRequestKey: string | null = null;
  let upgradeReloadScheduled = false;

  // Global reference to service worker registration
  let swRegistration: ServiceWorkerRegistration | null = null;

  const resolveVersionMetadataScope = (): string => {
    if (swRegistration?.scope) {
      return swRegistration.scope;
    }

    const worker =
      pendingWorker ||
      swRegistration?.waiting ||
      navigator.serviceWorker.controller ||
      swRegistration?.active ||
      null;
    if (worker?.scriptURL) {
      try {
        return new URL('.', worker.scriptURL).toString();
      } catch {
        // Fall through to the application origin below.
      }
    }

    return new URL('/', window.location.origin).toString();
  };

  const refreshVersionMetadata = () => {
    const currentSnapshot = versionUpgradeRuntime.getSnapshot();
    if (
      currentSnapshot.pendingReleaseId &&
      currentSnapshot.metadata?.releaseId === currentSnapshot.pendingReleaseId
    ) {
      return;
    }
    const fence = versionUpgradeRuntime.createMetadataFence();
    if (!fence) {
      return;
    }

    const requestKey = `${fence.pendingReleaseId}:${fence.revision}`;
    if (metadataRequestKey === requestKey) {
      return;
    }
    metadataRequestKey = requestKey;

    fetchVersionMetadata({
      pendingReleaseId: fence.pendingReleaseId,
      baseUrl: resolveVersionMetadataScope(),
      expectedOrigin: window.location.origin,
    })
      .then((metadata) => {
        versionUpgradeRuntime.applyMetadata(fence, metadata);
      })
      .catch((error) => {
        console.warn('[Main] Failed to load version metadata:', error);
      })
      .finally(() => {
        if (metadataRequestKey === requestKey) {
          metadataRequestKey = null;
        }
      });
  };

  const notifyUpdateReady = (
    releaseId: string,
    displayVersion?: string | null
  ) => {
    versionUpgradeRuntime.replacePendingRelease(releaseId, displayVersion);
    refreshVersionMetadata();

    if (lastPendingReleaseNotified === releaseId) {
      return;
    }
    lastPendingReleaseNotified = releaseId;
    window.dispatchEvent(
      new CustomEvent('sw-update-available', {
        detail: {
          releaseId,
          version: displayVersion || releaseId,
        },
      })
    );
  };

  const handleRuntimeVersionState = (payload: unknown) => {
    const state = resolveServiceWorkerVersionState(payload);
    if (!state) {
      console.warn('[Main] Ignored invalid Service Worker version state');
      return;
    }

    versionUpgradeRuntime.applyAuthoritativeState(state);

    const snapshot = versionUpgradeRuntime.getSnapshot();
    if (snapshot.pendingReleaseId && snapshot.phase === 'ready') {
      notifyUpdateReady(
        snapshot.pendingReleaseId,
        snapshot.displayVersion || state.pendingDisplayVersion
      );
    } else if (!snapshot.pendingReleaseId) {
      lastPendingReleaseNotified = null;
    }
  };

  const requestSWVersionState = (target?: ServiceWorker | null) => {
    const worker =
      target ||
      pendingWorker ||
      swRegistration?.waiting ||
      navigator.serviceWorker.controller ||
      swRegistration?.active ||
      null;

    if (!worker) {
      return;
    }

    worker.postMessage({
      type: 'GET_VERSION_STATE',
      clientReleaseId: APP_RELEASE_ID,
    });
  };

  const claimCurrentClientIfNeeded = (
    registration?: ServiceWorkerRegistration | null
  ) => {
    if (navigator.serviceWorker.controller || !registration?.active) {
      return;
    }

    registration.active.postMessage({ type: 'CLAIM_CLIENTS' });
  };

  const scheduleApprovedUpgradeReload = (reason: string) => {
    if (upgradeReloadScheduled) {
      return;
    }
    upgradeReloadScheduled = true;

    // 延迟一点，给新 SW 留出接管后收尾时间
    setTimeout(() => {
      console.info(`[Main] Reloading after approved upgrade (${reason})`);
      window.location.reload();
    }, 1000);
  };

  subscribeToApprovedActivationReload(versionUpgradeRuntime, () =>
    scheduleApprovedUpgradeReload('authoritative-version-state')
  );

  const selectWaitingUpgradeWorker = (
    candidates: Array<ServiceWorker | null | undefined>
  ): ServiceWorker | null => {
    for (const worker of candidates) {
      if (!worker || worker.state === 'redundant') {
        continue;
      }

      // A staged commit must never be sent to the controller serving this page.
      if (worker === navigator.serviceWorker.controller) {
        continue;
      }

      pendingWorker = worker;
      return worker;
    }
    return null;
  };

  const resolvePendingUpgradeWorker =
    async (): Promise<ServiceWorker | null> => {
      const immediateWorker = selectWaitingUpgradeWorker([
        pendingWorker,
        swRegistration?.waiting,
      ]);
      if (immediateWorker) {
        return immediateWorker;
      }

      try {
        const liveRegistration =
          (await navigator.serviceWorker.getRegistration()) || null;
        if (liveRegistration) {
          swRegistration = liveRegistration;
          return selectWaitingUpgradeWorker([liveRegistration.waiting]);
        }
      } catch (error) {
        console.warn(
          '[Main] Failed to get live service worker registration:',
          error
        );
      }

      return null;
    };

  const swRegistrationPromise =
    window.__OPENTU_SW_REGISTRATION_PROMISE__ ||
    navigator.serviceWorker
      .register('./sw.js', { updateViaCache: 'none' })
      .catch((error) => {
        console.warn('[Main] Service worker registration failed:', error);
        return null;
      });

  window.__OPENTU_SW_REGISTRATION_PROMISE__ = swRegistrationPromise;

  swRegistrationPromise
    .then((registration) => {
      if (!registration) {
        updateBootStatus({
          tip: '离线加速未启用，正在直接启动工作台...',
          source: 'phase',
          progress: 70,
        });
        return;
      }

      swRegistration = registration;
      claimCurrentClientIfNeeded(registration);
      navigator.serviceWorker.ready
        .then(claimCurrentClientIfNeeded)
        .catch((error) => {
          console.warn('[Main] Service worker ready check failed:', error);
        });
      updateBootStatus({
        tip: '启动缓存服务已连接，正在准备资源清单...',
        source: 'phase',
        progress: 72,
      });
      scheduleCDNPreferenceSync(registration);

      // 在开发模式下，强制检查更新并处理等待中的Worker
      if (isDevelopment) {
        registration
          .update()
          .catch((err) => console.warn('Forced update check failed:', err));

        if (registration.waiting) {
          registration.waiting.postMessage({ type: 'FORCE_UPGRADE' });
        }
      } else if (registration.waiting && navigator.serviceWorker.controller) {
        pendingWorker = registration.waiting;
        requestSWVersionState(registration.waiting);
      }

      // 监听Service Worker更新
      registration.addEventListener('updatefound', () => {
        const newWorker = registration.installing;
        if (newWorker) {
          newWorker.addEventListener('statechange', () => {
            if (
              newWorker.state === 'installed' &&
              navigator.serviceWorker.controller
            ) {
              pendingWorker = newWorker;

              // 在开发模式下自动激活新的Service Worker
              if (isDevelopment) {
                newWorker.postMessage({ type: 'FORCE_UPGRADE' });
              } else {
                requestSWVersionState(newWorker);
                // 重试：覆盖 SW 仍在预缓存、首次响应丢失的情况
                setTimeout(() => requestSWVersionState(newWorker), 5000);
              }
            }
          });
        }
      });

      if (
        registration.active &&
        !registration.installing &&
        !registration.waiting
      ) {
        updateBootStatus({
          tip: '启动缓存服务已就绪，正在恢复工作台状态...',
          source: 'phase',
          progress: 78,
        });
      }

      requestSWVersionState();

      // 定期检查更新（每 5 分钟检查一次）
      setInterval(() => {
        registration.update().catch((error) => {
          console.warn('Update check failed:', error);
        });
      }, 5 * 60 * 1000);

      // 页面重新可见时检查版本状态，捕获 tab 切走期间错过的升级通知
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
          requestSWVersionState();
        }
      });
    })
    .catch((error) => {
      updateBootStatus({
        tip: '离线加速未启用，正在直接启动工作台...',
        source: 'phase',
        progress: 70,
      });
    });

  // 设置 SW 事件处理器（通过 postmessage-duplex）
  const setupSWEventHandlers = () => {
    if (!swChannelClient.isInitialized()) {
      setTimeout(setupSWEventHandlers, 500);
      return;
    }

    swChannelClient.setEventHandlers({
      onSWUpdated: (_event) => {
        // sw:updated 在 skipWaiting() 后立即发出，早于 activate/claim。
        // 这里只同步一次状态，真正刷新等待 sw:activated / controllerchange。
        requestSWVersionState();
      },
      onSWNewVersionReady: (_event) => {
        // This legacy channel event carries only a display version. The
        // immutable pending identity comes exclusively from SW_VERSION_STATE.
        requestSWVersionState();
      },
      onSWActivated: (_event) => {
        // 老版本页面关闭后，waiting worker 可能在后台自然转为 active。
        // 这时不再重复弹升级提示。sw:activated 的 version 可能只是展示
        // 版本，不能作为 immutable release identity；刷新统一等待新 controller
        // 返回权威 SW_VERSION_STATE 后由 runtime 的 one-shot claim 决定。
        pendingWorker = null;
        requestSWVersionState();
      },
    });

    if (swRegistration?.waiting && navigator.serviceWorker.controller) {
      pendingWorker = swRegistration.waiting;
      requestSWVersionState(swRegistration.waiting);
    }
  };

  // 延迟初始化 SW 事件处理器，等待 swChannelClient 就绪
  setTimeout(setupSWEventHandlers, 1000);

  // 注册视频缩略图生成处理器（使用 postmessage-duplex 双工通讯）
  // SW 通过 publish('thumbnail:generate', { url }) 请求，主线程处理并直接返回结果
  const setupVideoThumbnailHandler = async () => {
    // 等待 swChannelClient 初始化
    if (!swChannelClient.isInitialized()) {
      setTimeout(setupVideoThumbnailHandler, 500);
      return;
    }

    swChannelClient.registerVideoThumbnailHandler(async (url, maxSize) => {
      try {
        const { generateVideoThumbnailFromBlob } = await import('@aitu/utils');

        let videoBlob: Blob | null = null;

        // 1. 尝试从缓存获取视频 blob
        const cache = await caches.open('drawnix-images');
        const cachedResponse = await cache.match(url);
        if (cachedResponse) {
          videoBlob = await cachedResponse.blob();
        }

        // 2. 如果缓存中没有，尝试从网络获取（支持远程视频）
        if (
          !videoBlob &&
          (url.startsWith('http://') || url.startsWith('https://'))
        ) {
          try {
            const networkResponse = await fetch(url);
            if (networkResponse.ok) {
              videoBlob = await networkResponse.blob();
            }
          } catch {
            videoBlob = null;
          }
        }

        if (!videoBlob) {
          return { error: 'Video not found in cache or network' };
        }

        // 生成预览图
        const thumbnailBlob = await generateVideoThumbnailFromBlob(
          videoBlob,
          maxSize || 400
        );

        // 将 Blob 转换为 Data URL
        const thumbnailUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(thumbnailBlob);
        });

        return { thumbnailUrl };
      } catch (error) {
        return {
          error: error instanceof Error ? error.message : String(error),
        };
      }
    });
  };

  setupVideoThumbnailHandler();

  navigator.serviceWorker.addEventListener('message', (event: MessageEvent) => {
    if (event.data?.type === 'SW_VERSION_STATE') {
      handleRuntimeVersionState(event.data);
    }
  });

  // 监听controller变化（新的Service Worker接管）
  // 只有用户主动确认升级后才刷新页面
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    scheduleCDNPreferenceSync(swRegistration);
    requestSWVersionState();
  });

  window.addEventListener(
    'user-requested-current-release-reload',
    (event: Event) => {
      const customEvent = event as CustomEvent<{
        committedReleaseId?: string;
      }>;
      const snapshot = versionUpgradeRuntime.getSnapshot();
      const isReloadRequiredRejection =
        snapshot.confirmationIssue === 'commit-rejected' &&
        (snapshot.confirmationRejectionReason === 'client-release-mismatch' ||
          snapshot.confirmationRejectionReason === 'already-committed');
      if (
        !isReloadRequiredRejection ||
        customEvent.detail?.committedReleaseId !== snapshot.committedReleaseId
      ) {
        return;
      }
      window.location.reload();
    }
  );

  // 监听用户确认升级事件
  window.addEventListener('user-confirmed-upgrade', (event: Event) => {
    void (async () => {
      const customEvent = event as CustomEvent<{ releaseId?: string }>;
      const pendingReleaseId =
        customEvent.detail?.releaseId ||
        versionUpgradeRuntime.getSnapshot().pendingReleaseId;
      if (!pendingReleaseId) {
        return;
      }

      const result = await versionUpgradeRuntime.confirmPendingRelease(
        pendingReleaseId,
        resolvePendingUpgradeWorker,
        postUpgradeCommitWithAcknowledgement
      );
      if (result === 'acknowledgement-pending') {
        console.warn(
          '[Main] Upgrade commit acknowledgement is unknown; waiting for authoritative Service Worker state'
        );
        requestSWVersionState();
      } else if (
        result === 'worker-unavailable' ||
        result === 'delivery-failed' ||
        result === 'rejected'
      ) {
        console.warn(`[Main] Upgrade commit remains retryable (${result})`);
        requestSWVersionState();
        swRegistration?.update().catch((error) => {
          console.warn(
            '[Main] Update check after missing waiting worker failed:',
            error
          );
        });
      }
    })();
  });

  // 页面卸载前，不再自动触发升级，必须用户手动确认
  // window.addEventListener('beforeunload', () => {
  //   if (newVersionReady && pendingWorker) {
  //     console.log('Main: Page unloading, triggering pending upgrade');
  //     pendingWorker.postMessage({ type: 'SKIP_WAITING' });
  //   }
  // });

  // 页面隐藏时，不再自动触发升级
  // document.addEventListener('visibilitychange', () => {
  //   if (document.visibilityState === 'hidden' && newVersionReady && pendingWorker) {
  //     console.log('Main: Page hidden, triggering pending upgrade');
  //     pendingWorker.postMessage({ type: 'SKIP_WAITING' });
  //   }
  // });
}

updateBootStatus({
  tip: '正在挂载工作台界面...',
  source: 'phase',
  progress: 88,
});

const root = ReactDOM.createRoot(
  document.getElementById('root') as HTMLElement
);
root.render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>
);
