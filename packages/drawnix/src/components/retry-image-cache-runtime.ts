import { createRetriableModuleLoader } from '../utils/retriable-module-loader';
import { loadUnifiedCacheService } from '../services/unified-cache-runtime';

export interface RetryImageCacheRuntime {
  getCachedBlob(url: string): Promise<Blob | null>;
}

/**
 * The cache implementation is only needed when a virtual image URL cannot be
 * served by the active service worker. Keep it out of the startup graph while
 * preserving single-flight loading and retrying a failed chunk on the next
 * fallback attempt.
 */
export const loadRetryImageCacheRuntime =
  createRetriableModuleLoader<RetryImageCacheRuntime>(async () => {
    const unifiedCacheService = await loadUnifiedCacheService();

    return {
      getCachedBlob: (url) => unifiedCacheService.getCachedBlob(url),
    };
  });
