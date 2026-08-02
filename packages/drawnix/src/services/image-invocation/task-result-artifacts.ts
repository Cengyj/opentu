import type { ImageArtifact } from '../../types/image-artifact.types';

export interface ImageTaskResultArtifactProjection {
  url: string;
  urls?: string[];
  imageArtifacts?: ImageArtifact[];
}

/**
 * Keep `imageArtifacts` authoritative while retaining `url`/`urls` as a
 * compatibility projection for consumers that have not migrated yet.
 *
 * Historical results without canonical artifacts continue to normalize their
 * legacy URL fields exactly as before. New canonical results are projected in
 * one place so persisted fields cannot disagree about order or identity.
 */
export function normalizeImageTaskResultArtifactProjection<
  TResult extends ImageTaskResultArtifactProjection
>(result: TResult, normalizeUrl: (value: string) => string): TResult {
  const seenArtifactUrls = new Set<string>();
  const normalizedArtifacts = result.imageArtifacts?.reduce<ImageArtifact[]>(
    (artifacts, artifact) => {
      const url = normalizeUrl(artifact.url);
      if (!url || seenArtifactUrls.has(url)) {
        return artifacts;
      }
      seenArtifactUrls.add(url);
      artifacts.push({ ...artifact, url });
      return artifacts;
    },
    []
  );

  if (normalizedArtifacts?.length) {
    const urls = normalizedArtifacts.map((artifact) => artifact.url);
    return {
      ...result,
      url: urls[0],
      urls: urls.length > 1 ? urls : undefined,
      imageArtifacts: normalizedArtifacts,
    };
  }

  return {
    ...result,
    url: normalizeUrl(result.url),
    urls: result.urls?.map((url) => normalizeUrl(url)),
  };
}
