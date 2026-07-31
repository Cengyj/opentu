import {
  AssetCategory,
  AssetSource,
  type Asset,
} from '../types/asset.types';
import { assetStorageService } from './asset-storage-service';
import {
  taskStorageWriter,
  TaskStorageTaskNotFoundError,
} from './media-executor/task-storage-writer';
import { unifiedCacheService } from './unified-cache-service';

export interface CharacterAssetMark {
  name: string;
  prompt?: string;
}

function buildCharacterMetadata(mark: CharacterAssetMark) {
  return {
    category: AssetCategory.CHARACTER,
    characterName: mark.name,
    characterPrompt: mark.prompt?.trim() || undefined,
  };
}

export async function markAssetAsCharacter(
  asset: Asset,
  mark: CharacterAssetMark
): Promise<void> {
  const metadata = buildCharacterMetadata(mark);
  const characterMeta = {
    name: mark.name,
    ...(mark.prompt?.trim() && { prompt: mark.prompt.trim() }),
  };

  await unifiedCacheService.updateCachedMedia(asset.url, {
    metadata,
  });

  if (asset.id.startsWith('unified-cache-')) {
    return;
  }

  if (asset.source === AssetSource.AI_GENERATED) {
    const taskId = asset.taskId || asset.id;
    try {
      await taskStorageWriter.mergeTaskParams(taskId, {
        assetMetadata: metadata,
      });
    } catch (error) {
      // AI assets can outlive their task-history entry after the user clears
      // completed tasks. Cache metadata is already the durable source for this
      // asset in that case, so preserve the previous successful behavior.
      if (!(error instanceof TaskStorageTaskNotFoundError)) {
        throw error;
      }
    }
    return;
  }

  await assetStorageService.updateAssetMetadata(asset.id, {
    category: AssetCategory.CHARACTER,
    characterMeta,
  });
}
