import type { PlaitBoard } from '@plait/core';
import { createRetriableModuleLoader } from './retriable-module-loader';

const loadImageFileActionRuntime = createRetriableModuleLoader(async () => {
  const { addImage, saveAsImage } = await import('./image');
  return { addImage, saveAsImage };
});

export async function openImageFilePicker(board: PlaitBoard): Promise<void> {
  const { addImage } = await loadImageFileActionRuntime();
  await addImage(board);
}

export async function exportBoardImage(
  board: PlaitBoard,
  isTransparent: boolean
): Promise<void> {
  const { saveAsImage } = await loadImageFileActionRuntime();
  saveAsImage(board, isTransparent);
}
