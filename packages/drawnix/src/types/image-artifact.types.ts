/** Provider-independent image result produced before business consumption. */
export const IMAGE_ARTIFACT_MIME_TYPES = [
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/gif',
] as const;

export type ImageArtifactMimeType =
  (typeof IMAGE_ARTIFACT_MIME_TYPES)[number];

export type ImageArtifactFormat = 'png' | 'jpg' | 'webp' | 'gif';

/**
 * Canonical image artifact shared by adapters, task persistence and UI
 * consumers. Provider-native response fields never cross this boundary.
 */
export interface ImageArtifact {
  readonly url: string;
  readonly source: 'inline' | 'url';
  /** Remote URLs without a trustworthy MIME hint intentionally leave this unset. */
  readonly mimeType?: ImageArtifactMimeType;
  readonly format?: ImageArtifactFormat;
  readonly width?: number;
  readonly height?: number;
}

/** Minimal persisted result shape accepted by the single legacy read boundary. */
export interface ImageArtifactResultLike {
  readonly imageArtifacts?: readonly ImageArtifact[];
  readonly url?: string;
  readonly urls?: readonly string[];
  readonly format?: string;
  readonly width?: number;
  readonly height?: number;
}

const LEGACY_IMAGE_FORMATS: Readonly<
  Record<string, { format: ImageArtifactFormat; mimeType: ImageArtifactMimeType }>
> = Object.freeze({
  png: { format: 'png', mimeType: 'image/png' },
  jpg: { format: 'jpg', mimeType: 'image/jpeg' },
  jpeg: { format: 'jpg', mimeType: 'image/jpeg' },
  webp: { format: 'webp', mimeType: 'image/webp' },
  gif: { format: 'gif', mimeType: 'image/gif' },
});

/**
 * Reads canonical artifacts from a persisted task result. Historical url/urls
 * records are upgraded only here, so business consumers do not replicate
 * legacy precedence or de-duplication rules.
 */
export function resolveImageArtifactsFromTaskResult(
  result?: ImageArtifactResultLike
): ImageArtifact[] {
  const persisted = result?.imageArtifacts?.filter(
    (artifact): artifact is ImageArtifact =>
      typeof artifact?.url === 'string' && artifact.url.length > 0
  );
  if (persisted?.length) {
    const seen = new Set<string>();
    return persisted.filter((artifact) => {
      if (seen.has(artifact.url)) {
        return false;
      }
      seen.add(artifact.url);
      return true;
    });
  }

  const candidates = result?.urls?.length ? result.urls : [result?.url];
  const legacyFormat = result?.format
    ? LEGACY_IMAGE_FORMATS[result.format.toLowerCase()]
    : undefined;

  return Array.from(
    new Set(
      candidates.filter(
        (candidate): candidate is string =>
          typeof candidate === 'string' && candidate.length > 0
      )
    )
  ).map((url) => ({
    url,
    source: 'url' as const,
    ...(legacyFormat || {}),
    ...(result?.width ? { width: result.width } : {}),
    ...(result?.height ? { height: result.height } : {}),
  }));
}
