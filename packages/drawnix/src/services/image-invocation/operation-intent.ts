import type { ImageOperationIntent, NormalizedImageRequest } from './types';

/** The sole generation/edit decision for a normalized image request. */
export function resolveImageOperationIntent(
  request: NormalizedImageRequest
): ImageOperationIntent {
  if (
    request.referenceImages.length > 0 ||
    !!request.maskImage ||
    request.generationMode === 'image_to_image' ||
    request.generationMode === 'image_edit'
  ) {
    return 'edit';
  }

  return 'generation';
}
