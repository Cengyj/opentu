import { getImageNaturalSize } from './image-natural-size';

export interface ImageElementInfo {
  url: string;
  width?: number;
  height?: number;
  points: [[number, number], [number, number]];
}

export interface ScaledImageResult {
  newPoints: [[number, number], [number, number]];
  scale: number;
}

/**
 * Preserve the current canvas scale while replacing an image with content that
 * has different natural dimensions.
 */
export async function calculateEditedImagePoints(
  element: ImageElementInfo,
  newNaturalWidth: number,
  newNaturalHeight: number
): Promise<ScaledImageResult> {
  const [start, end] = element.points;
  const originalDisplayWidth = end[0] - start[0];
  const originalDisplayHeight = end[1] - start[1];

  let originalNaturalWidth = element.width;
  let originalNaturalHeight = element.height;

  if (!originalNaturalWidth || !originalNaturalHeight) {
    const size = await getImageNaturalSize(
      element.url,
      originalDisplayWidth,
      originalDisplayHeight
    );
    originalNaturalWidth = size.width;
    originalNaturalHeight = size.height;
  }

  const scale = Math.min(
    originalDisplayWidth / originalNaturalWidth,
    originalDisplayHeight / originalNaturalHeight
  );

  return {
    newPoints: [
      start,
      [start[0] + newNaturalWidth * scale, start[1] + newNaturalHeight * scale],
    ],
    scale,
  };
}
