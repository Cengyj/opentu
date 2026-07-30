import type { VideoCharacter } from '../../../services/video-analysis-service';
import type { Asset } from '../../../types/asset.types';

function readNonEmpty(value: string | undefined): string | undefined {
  const normalized = value?.trim();
  return normalized || undefined;
}

export function applySubjectAssetToCharacter(
  character: VideoCharacter,
  asset: Asset
): VideoCharacter {
  return {
    ...character,
    name:
      readNonEmpty(asset.characterMeta?.name) ||
      readNonEmpty(asset.name) ||
      character.name,
    description:
      readNonEmpty(asset.characterMeta?.prompt) ||
      readNonEmpty(asset.prompt) ||
      character.description,
    referenceImageUrl: asset.url,
  };
}
