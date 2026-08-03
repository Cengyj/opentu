import { useCallback, useEffect, useState } from 'react';
import { loadUnifiedCacheService } from '../services/unified-cache-runtime';

const CACHE_MONITOR_RETRY_DELAYS_MS = [1000, 3000] as const;
const CACHE_MONITOR_IDLE_TIMEOUT_MS = 2000;
const CACHE_MONITOR_FALLBACK_DELAY_MS = 500;

/**
 * Subscribes to cache quota events without putting the complete cache service
 * in the startup module graph. A failed runtime fetch is retried with bounded
 * backoff because there is no user action that would otherwise retrigger this
 * global monitor.
 */
export function useCacheQuotaMonitor(
  onQuotaExceeded?: () => void,
  enabled = true
) {
  const [isQuotaExceeded, setIsQuotaExceeded] = useState(false);

  useEffect(() => {
    if (!enabled) {
      return;
    }

    let disposed = false;
    let unsubscribe: (() => void) | undefined;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;
    let initialTimer: ReturnType<typeof setTimeout> | undefined;
    let idleCallbackId: number | undefined;
    let retryIndex = 0;

    const handleQuotaExceeded = () => {
      setIsQuotaExceeded(true);
      onQuotaExceeded?.();
    };

    const subscribe = async (): Promise<void> => {
      try {
        const cacheService = await loadUnifiedCacheService();
        if (!disposed) {
          unsubscribe = cacheService.onQuotaExceeded(handleQuotaExceeded);
        }
      } catch (error) {
        if (disposed) {
          return;
        }

        const retryDelay = CACHE_MONITOR_RETRY_DELAYS_MS[retryIndex];
        if (retryDelay === undefined) {
          console.warn('[CacheQuotaMonitor] Cache runtime unavailable:', error);
          return;
        }

        retryIndex += 1;
        retryTimer = setTimeout(() => {
          retryTimer = undefined;
          void subscribe();
        }, retryDelay);
      }
    };

    const idleWindow = window as Window & {
      requestIdleCallback?: (
        callback: () => void,
        options?: { timeout: number }
      ) => number;
      cancelIdleCallback?: (id: number) => void;
    };

    if (typeof idleWindow.requestIdleCallback === 'function') {
      idleCallbackId = idleWindow.requestIdleCallback(
        () => {
          idleCallbackId = undefined;
          if (!disposed) {
            void subscribe();
          }
        },
        { timeout: CACHE_MONITOR_IDLE_TIMEOUT_MS }
      );
    } else {
      initialTimer = setTimeout(() => {
        initialTimer = undefined;
        if (!disposed) {
          void subscribe();
        }
      }, CACHE_MONITOR_FALLBACK_DELAY_MS);
    }

    return () => {
      disposed = true;
      if (idleCallbackId !== undefined) {
        idleWindow.cancelIdleCallback?.(idleCallbackId);
      }
      if (initialTimer !== undefined) {
        clearTimeout(initialTimer);
      }
      if (retryTimer !== undefined) {
        clearTimeout(retryTimer);
      }
      unsubscribe?.();
    };
  }, [enabled, onQuotaExceeded]);

  const resetQuotaFlag = useCallback(() => {
    setIsQuotaExceeded(false);
  }, []);

  return {
    isQuotaExceeded,
    resetQuotaFlag,
  };
}
