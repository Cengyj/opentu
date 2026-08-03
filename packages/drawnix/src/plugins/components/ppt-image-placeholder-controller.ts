import { RectangleClient, type PlaitBoard } from '@plait/core';

export type PPTImagePlaceholderRuntime = typeof import('./ppt-image-placeholder-runtime');

export interface GeneratePPTImagePlaceholderOptions {
  board: PlaitBoard;
  frameId: string;
  prompt: string;
}

type LoadPPTImagePlaceholderRuntime = () => Promise<PPTImagePlaceholderRuntime>;

const loadPPTImagePlaceholderRuntime: LoadPPTImagePlaceholderRuntime = () =>
  import('./ppt-image-placeholder-runtime');

const generationAttemptsByBoard = new WeakMap<
  PlaitBoard,
  Map<string, Promise<void>>
>();

async function executePPTImagePlaceholderGeneration(
  { board, frameId, prompt }: GeneratePPTImagePlaceholderOptions,
  loadRuntime: LoadPPTImagePlaceholderRuntime
): Promise<void> {
  const runtime = await loadRuntime();
  const resetStatus = () => {
    runtime.setPPTImagePlaceholderStatus(board, frameId, 'placeholder');
    runtime.setFramePPTImageStatus(board, frameId, 'placeholder');
  };

  try {
    runtime.setPPTImagePlaceholderStatus(board, frameId, 'loading');
    runtime.setFramePPTImageStatus(board, frameId, 'loading');

    const result = await runtime.generateImage({
      prompt,
      size: '16x9',
    });
    const imageUrl =
      result.success &&
      result.data &&
      typeof result.data === 'object' &&
      'url' in result.data &&
      typeof result.data.url === 'string'
        ? result.data.url
        : null;

    if (!imageUrl) {
      throw new Error(result.error || '图片生成失败');
    }

    runtime.removePPTImagePlaceholder(board, frameId);

    const frame = board.children.find((element) => element.id === frameId);
    if (frame) {
      if (!frame.points) {
        throw new Error('PPT frame has no geometry');
      }
      const frameRect = RectangleClient.getRectangleByPoints(frame.points);
      const imageRegion = runtime.getImageRegion({
        x: frameRect.x,
        y: frameRect.y,
        width: frameRect.width,
        height: frameRect.height,
      });
      await runtime.insertMediaIntoFrame(
        board,
        imageUrl,
        'image',
        frameId,
        { width: frameRect.width, height: frameRect.height },
        { width: 800, height: 450 },
        imageRegion
      );
    }

    runtime.setFramePPTImageStatus(board, frameId, 'generated');
  } catch (error) {
    resetStatus();
    throw error;
  }
}

export function generatePPTImageFromPlaceholder(
  options: GeneratePPTImagePlaceholderOptions,
  loadRuntime: LoadPPTImagePlaceholderRuntime =
    loadPPTImagePlaceholderRuntime
): Promise<void> {
  const { board, frameId } = options;
  let boardAttempts = generationAttemptsByBoard.get(board);
  const existingAttempt = boardAttempts?.get(frameId);
  if (existingAttempt) {
    return existingAttempt;
  }

  if (!boardAttempts) {
    boardAttempts = new Map();
    generationAttemptsByBoard.set(board, boardAttempts);
  }

  const attempt = executePPTImagePlaceholderGeneration(
    options,
    loadRuntime
  ).finally(() => {
    if (boardAttempts?.get(frameId) !== attempt) {
      return;
    }
    boardAttempts.delete(frameId);
    if (boardAttempts.size === 0) {
      generationAttemptsByBoard.delete(board);
    }
  });
  boardAttempts.set(frameId, attempt);
  return attempt;
}
