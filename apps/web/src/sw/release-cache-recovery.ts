import {
  getReleaseStaticCacheName,
  resolveDynamicImportRecoveryModuleUrl,
  selectDynamicImportRecoveryCacheKeys,
  type DynamicImportRecoveryTarget,
} from './release-contract';

interface ReleaseCacheRecoveryStorage {
  has(cacheName: string): Promise<boolean>;
  open(cacheName: string): Promise<Pick<Cache, 'keys' | 'delete'>>;
}

interface InvalidateReleaseStaticModuleOptions {
  cacheStorage: ReleaseCacheRecoveryStorage;
  releaseId: string;
  moduleKey: string;
  clientUrl: string;
  serviceWorkerScope: string;
}

type RecoverReleaseStaticTargetOptions = Omit<
  InvalidateReleaseStaticModuleOptions,
  'moduleKey'
> & {
  target: DynamicImportRecoveryTarget;
};

export interface ReleaseStaticModuleInvalidationResult {
  targetValid: boolean;
  invalidatedEntries: number;
}

/**
 * Applies the canonical recovery target. A URL-less browser error is an
 * identity-confirmed reload only and is deliberately incapable of reading or
 * mutating CacheStorage.
 */
export async function recoverReleaseStaticTarget({
  target,
  ...options
}: RecoverReleaseStaticTargetOptions): Promise<ReleaseStaticModuleInvalidationResult> {
  if (target.kind === 'reload-only') {
    return { targetValid: true, invalidatedEntries: 0 };
  }
  return invalidateReleaseStaticModule({
    ...options,
    moduleKey: target.moduleKey,
  });
}

/**
 * Invalidates only the failed JS/CSS module in the reporting page's immutable
 * release cache. It never deletes a cache namespace or touches media caches.
 */
export async function invalidateReleaseStaticModule({
  cacheStorage,
  releaseId,
  moduleKey,
  clientUrl,
  serviceWorkerScope,
}: InvalidateReleaseStaticModuleOptions): Promise<ReleaseStaticModuleInvalidationResult> {
  const moduleUrl = resolveDynamicImportRecoveryModuleUrl(
    moduleKey,
    clientUrl,
    serviceWorkerScope
  );
  if (!moduleUrl) {
    return { targetValid: false, invalidatedEntries: 0 };
  }

  const cacheName = getReleaseStaticCacheName(releaseId);
  if (!(await cacheStorage.has(cacheName))) {
    return { targetValid: true, invalidatedEntries: 0 };
  }

  const cache = await cacheStorage.open(cacheName);
  const cacheRequests = await cache.keys();
  const keysToInvalidate = selectDynamicImportRecoveryCacheKeys(
    cacheRequests.map((request) => request.url),
    moduleUrl.toString(),
    clientUrl,
    serviceWorkerScope
  );
  let invalidatedEntries = 0;
  for (const requestUrl of keysToInvalidate) {
    if (await cache.delete(requestUrl)) {
      invalidatedEntries += 1;
    }
  }
  return { targetValid: true, invalidatedEntries };
}
