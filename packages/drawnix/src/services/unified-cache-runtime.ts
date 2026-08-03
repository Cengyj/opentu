import { createRetriableModuleLoader } from '../utils/retriable-module-loader';

export type UnifiedCacheService =
  typeof import('./unified-cache-service')['unifiedCacheService'];

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
