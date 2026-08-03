import { AssetSource, type Asset } from '../../types/asset.types';

/**
 * Returns the unique local URLs that the existing manual media-sync action can
 * submit. Remote de-duplication remains owned by MediaSyncService.
 */
export function getSyncableMediaAssetUrls(
  assets: readonly Asset[],
  syncedUrls: ReadonlySet<string>
): string[] {
  const urls = new Set<string>();

  for (const asset of assets) {
    if (syncedUrls.has(asset.url)) {
      continue;
    }

    if (asset.source === AssetSource.AI_GENERATED) {
      urls.add(asset.url);
      continue;
    }

    if (
      asset.source === AssetSource.LOCAL &&
      asset.url.startsWith('/__aitu_cache__/')
    ) {
      urls.add(asset.url);
    }
  }

  return [...urls];
}
