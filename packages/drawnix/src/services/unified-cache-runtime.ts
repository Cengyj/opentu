import { createRetriableModuleLoader } from '../utils/retriable-module-loader';
import type {
  CacheInfo,
  CacheMediaFromBlobOptions,
  CacheMediaType,
} from './unified-cache-service';

/**
 * Public surface exposed across the lazy cache boundary. Keeping this contract
 * explicit prevents declaration generation from leaking the implementation
 * class and its private IndexedDB state into consumers.
 */
export interface UnifiedCacheService {
  getCachedBlob(url: string): Promise<Blob | null>;
  getCacheInfo(url: string): Promise<CacheInfo>;
  isCached(url: string): Promise<boolean>;
  cacheMediaFromBlob(
    url: string,
    blob: Blob,
    type: CacheMediaType,
    options?: CacheMediaFromBlobOptions
  ): Promise<string>;
  onQuotaExceeded(callback: () => void): () => void;
}

/**
 * Shared lazy boundary for UI paths that only need cache access after mount or
 * after an explicit media operation. Rejected imports are not retained, and
 * concurrent callers share one attempt.
 */
export const loadUnifiedCacheService =
  createRetriableModuleLoader<UnifiedCacheService>(async () => {
    const { unifiedCacheService } = await import('./unified-cache-service');
    return unifiedCacheService;
  });
