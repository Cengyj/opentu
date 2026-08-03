import { getSelectedElements, PlaitBoard } from '@plait/core';
import { base64ToBlob, download } from '@aitu/utils';
import { boardToImage } from './common';
import { fileOpen, isFileSystemAbortError } from '../data/filesystem';
import { IMAGE_MIME_TYPES } from '../constants';
import { insertImage } from '../data/image';
import { MessagePlugin } from './message-plugin';
export {
  calculateEditedImagePoints,
  type ImageElementInfo,
  type ScaledImageResult,
} from './image-edit-layout';

export { getImageNaturalSize } from './image-natural-size';

export const saveAsImage = (board: PlaitBoard, isTransparent: boolean) => {
  const selectedElements = getSelectedElements(board);
  void (async () => {
    try {
      const image = await boardToImage(board, {
        elements: selectedElements.length > 0 ? selectedElements : undefined,
        fillStyle: isTransparent ? 'transparent' : 'white',
      });

      if (image) {
        const ext = isTransparent ? 'png' : 'jpg';
        const pngImage = base64ToBlob(image);
        const imageName = `drawnix-${new Date().getTime()}.${ext}`;
        download(pngImage, imageName);
      }
    } catch (error) {
      console.warn('[ImageExport] Failed to export image:', error);
      MessagePlugin.error('导出图片失败，请稍后重试');
    }
  })();
};

export const addImage = async (board: PlaitBoard) => {
  try {
    const imageFile = await fileOpen({
      description: 'Image',
      extensions: Object.keys(
        IMAGE_MIME_TYPES
      ) as (keyof typeof IMAGE_MIME_TYPES)[],
    });
    insertImage(board, imageFile);
  } catch (error) {
    if (isFileSystemAbortError(error)) {
      return;
    }
    throw error;
  }
};
