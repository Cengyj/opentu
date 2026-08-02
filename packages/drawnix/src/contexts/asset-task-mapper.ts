import type { AssetTaskRecord } from '../services/task-storage-reader';
import type { Asset } from '../types/asset.types';
import { AssetCategory, AssetSource, AssetType } from '../types/asset.types';
import { TaskType } from '../types/task.types';
import { getTaskResultImageArtifacts } from '../utils/image-generation-anchor-batch';

export function normalizeAssetCategory(
  category: unknown
): AssetCategory | undefined {
  return category === AssetCategory.CHARACTER
    ? AssetCategory.CHARACTER
    : category === AssetCategory.GENERAL
    ? AssetCategory.GENERAL
    : undefined;
}

export function buildCharacterMeta(input: {
  characterName?: unknown;
  characterPrompt?: unknown;
  prompt?: unknown;
}): Asset['characterMeta'] | undefined {
  const name =
    typeof input.characterName === 'string' && input.characterName.trim()
      ? input.characterName.trim()
      : undefined;
  const prompt =
    typeof input.characterPrompt === 'string' && input.characterPrompt.trim()
      ? input.characterPrompt.trim()
      : typeof input.prompt === 'string' && input.prompt.trim()
      ? input.prompt.trim()
      : undefined;

  return name || prompt
    ? { ...(name && { name }), ...(prompt && { prompt }) }
    : undefined;
}

export function mapImageTaskToAssets(task: AssetTaskRecord): Asset[] {
  if (task.type !== TaskType.IMAGE || !task.result) {
    return [];
  }

  const result = task.result;
  const artifacts = getTaskResultImageArtifacts(task);
  const baseName = task.params.prompt?.substring(0, 30) || 'AI生成';
  const category = normalizeAssetCategory(task.params.assetMetadata?.category);
  const characterMeta = buildCharacterMeta({
    characterName: task.params.assetMetadata?.characterName,
    characterPrompt: task.params.assetMetadata?.characterPrompt,
    prompt: task.params.prompt,
  });

  return artifacts.map((artifact, index) => ({
    id: index === 0 ? task.id : `${task.id}::image:${index}`,
    taskId: task.id,
    type: AssetType.IMAGE,
    source: AssetSource.AI_GENERATED,
    url: artifact.url,
    name: artifacts.length > 1 ? `${baseName} ${index + 1}` : baseName,
    mimeType:
      artifact.mimeType || `image/${artifact.format || result.format || 'png'}`,
    createdAt: task.completedAt || task.createdAt,
    size: result.size,
    category,
    characterMeta,
    cacheWarning: result.cacheWarning,
    prompt: task.params.prompt,
    modelName: task.params.model,
    ...(result.previewImageUrl && { thumbnail: result.previewImageUrl }),
  }));
}

export interface AIGeneratedAssetCleanupTargets {
  taskId: string;
  assetIds: string[];
  urls: string[];
}

/**
 * An AI image asset represents its source task. Canonical multi-image results
 * therefore have to be removed as one task-scoped group. Other media retain
 * their existing per-asset cleanup behavior.
 */
export function getAIGeneratedAssetCleanupTargets(
  asset: Asset,
  assets: readonly Asset[]
): AIGeneratedAssetCleanupTargets {
  const taskId = asset.taskId || asset.id;
  const taskImageAssets =
    asset.type === AssetType.IMAGE && asset.taskId
      ? assets.filter(
          (candidate) =>
            candidate.source === AssetSource.AI_GENERATED &&
            candidate.type === AssetType.IMAGE &&
            candidate.taskId === asset.taskId
        )
      : [asset];

  return {
    taskId,
    assetIds: Array.from(
      new Set(taskImageAssets.map((candidate) => candidate.id))
    ),
    urls: Array.from(
      new Set(
        taskImageAssets
          .map((candidate) => candidate.url)
          .filter((url): url is string => Boolean(url))
      )
    ),
  };
}
