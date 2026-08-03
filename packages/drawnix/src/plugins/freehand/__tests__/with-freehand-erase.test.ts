import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  type PreciseEraseRuntimeLoader,
  withFreehandErase,
} from '../with-freehand-erase';
import { createRetriableModuleLoader } from '../../../utils/retriable-module-loader';

const mocks = vi.hoisted(() => {
  let resolveFirstErase: (() => void) | null = null;
  return {
    executePreciseErase: vi.fn(
      () =>
        new Promise<void>((resolve) => {
          if (!resolveFirstErase) {
            resolveFirstErase = resolve;
          } else {
            resolve();
          }
        })
    ),
    findElementsInEraserPath: vi.fn(
      (_board: unknown, path: Array<[number, number]>) => [
        { id: path[0]?.[0] < 50 ? 'shape-1' : 'shape-2', type: 'geometry' },
      ]
    ),
    findUnsupportedElementsInEraserPath: vi.fn(() => []),
    removeElements: vi.fn(),
    resolveFirstErase: () => {
      resolveFirstErase?.();
      resolveFirstErase = null;
    },
    resetDeferred: () => {
      resolveFirstErase = null;
    },
  };
});

vi.mock('@plait/core', () => ({
  PlaitBoard: {
    isInPointer: vi.fn(() => true),
  },
  CoreTransforms: {
    removeElements: mocks.removeElements,
  },
  throttleRAF: vi.fn(
    (_board: unknown, _key: string, callback: () => void) => callback()
  ),
  toHostPoint: vi.fn(
    (_board: unknown, x: number, y: number) => [x, y]
  ),
  toViewBoxPoint: vi.fn((_board: unknown, point: [number, number]) => point),
}));

vi.mock('@plait/draw', () => ({
  PlaitDrawElement: {
    isDrawElement: vi.fn(() => false),
    isImage: vi.fn(() => false),
  },
}));

vi.mock('@plait/common', () => ({
  isDrawingMode: vi.fn(() => true),
}));

vi.mock('../utils', () => ({
  isHitFreehandWithRadius: vi.fn(() => false),
}));

vi.mock('../type', () => ({
  Freehand: { isFreehand: vi.fn(() => false) },
  FreehandShape: { eraser: 'eraser' },
}));

vi.mock('../freehand-settings', () => ({
  getFreehandSettings: vi.fn(() => ({
    eraserWidth: 20,
    eraserShape: 'circle',
  })),
}));

vi.mock('../../../types/frame.types', () => ({
  isFrameElement: vi.fn(() => false),
}));

vi.mock('../../../interfaces/video', () => ({
  isPlaitVideo: vi.fn(() => false),
}));

vi.mock('../../../transforms/precise-erase', () => ({
  executePreciseErase: mocks.executePreciseErase,
  findElementsInEraserPath: mocks.findElementsInEraserPath,
  findUnsupportedElementsInEraserPath:
    mocks.findUnsupportedElementsInEraserPath,
}));

vi.mock('../../hand-mode', () => ({
  shouldDelegateToHandPointer: vi.fn(() => false),
}));

function pointerEvent(x: number, y: number) {
  return { x, y } as PointerEvent;
}

function createBoard() {
  return {
    children: [
      { id: 'shape-1', type: 'geometry' },
      { id: 'shape-2', type: 'geometry' },
    ],
    pointerDown: vi.fn(),
    pointerMove: vi.fn(),
    pointerUp: vi.fn(),
    globalPointerUp: vi.fn(),
  };
}

function createPreciseEraseRuntime() {
  return {
    executePreciseErase: mocks.executePreciseErase,
    findElementsInEraserPath: mocks.findElementsInEraserPath,
    findUnsupportedElementsInEraserPath:
      mocks.findUnsupportedElementsInEraserPath,
  } as unknown as Awaited<ReturnType<PreciseEraseRuntimeLoader>>;
}

describe('withFreehandErase async gesture isolation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.resetDeferred();
  });

  it('does not let completion of the first erase clear a second gesture in progress', async () => {
    const board = createBoard();
    const basePointerUp = board.pointerUp;
    withFreehandErase(board as never);

    board.pointerDown(pointerEvent(0, 0));
    board.pointerMove(pointerEvent(10, 0));
    board.pointerUp(pointerEvent(10, 0));
    await vi.waitFor(() => {
      expect(mocks.executePreciseErase).toHaveBeenCalledTimes(1);
    });

    board.pointerDown(pointerEvent(100, 0));
    board.pointerMove(pointerEvent(110, 0));

    mocks.resolveFirstErase();
    await Promise.resolve();
    await Promise.resolve();

    board.pointerUp(pointerEvent(110, 0));
    await Promise.resolve();
    await Promise.resolve();

    expect(mocks.executePreciseErase).toHaveBeenCalledTimes(2);
    expect(basePointerUp).not.toHaveBeenCalled();
  });

  it('loads the precise erase runtime only after a completed multi-point gesture', async () => {
    const board = createBoard();
    const loadRuntime = vi.fn(
      async () => createPreciseEraseRuntime()
    );
    withFreehandErase(board as never, loadRuntime);

    board.pointerDown(pointerEvent(0, 0));
    board.pointerMove(pointerEvent(10, 0));
    expect(loadRuntime).not.toHaveBeenCalled();

    board.pointerUp(pointerEvent(10, 0));
    await vi.waitFor(() => {
      expect(loadRuntime).toHaveBeenCalledTimes(1);
    });
  });

  it('retries a failed runtime load on the next gesture and keeps the completed element snapshot', async () => {
    const board = createBoard();
    const completedElements = [...board.children];
    const importRuntime = vi
      .fn<PreciseEraseRuntimeLoader>()
      .mockRejectedValueOnce(new Error('chunk unavailable'))
      .mockResolvedValue(createPreciseEraseRuntime());
    const loadRuntime = createRetriableModuleLoader(importRuntime);
    const consoleError = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);

    withFreehandErase(board as never, loadRuntime);
    board.pointerDown(pointerEvent(0, 0));
    board.pointerMove(pointerEvent(10, 0));
    board.pointerUp(pointerEvent(10, 0));

    await vi.waitFor(() => {
      expect(consoleError).toHaveBeenCalledWith(
        'Precise erase error:',
        expect.objectContaining({ message: 'chunk unavailable' })
      );
    });

    board.pointerDown(pointerEvent(100, 0));
    board.pointerMove(pointerEvent(110, 0));
    board.pointerUp(pointerEvent(110, 0));
    board.children = [{ id: 'late-shape', type: 'geometry' }];

    await vi.waitFor(() => {
      expect(importRuntime).toHaveBeenCalledTimes(2);
      expect(mocks.findElementsInEraserPath).toHaveBeenLastCalledWith(
        completedElements,
        [
          [100, 0],
          [110, 0],
        ],
        20
      );
    });

    consoleError.mockRestore();
  });

  it('shares an in-flight runtime import without merging concurrent gestures', async () => {
    const board = createBoard();
    let resolveRuntime: (
      runtime: Awaited<ReturnType<PreciseEraseRuntimeLoader>>
    ) => void = () => undefined;
    const importRuntime = vi.fn(
      () =>
        new Promise<Awaited<ReturnType<PreciseEraseRuntimeLoader>>>(
          (resolve) => {
            resolveRuntime = resolve;
          }
        )
    );
    const loadRuntime = createRetriableModuleLoader(importRuntime);

    withFreehandErase(board as never, loadRuntime);
    board.pointerDown(pointerEvent(0, 0));
    board.pointerMove(pointerEvent(10, 0));
    board.pointerUp(pointerEvent(10, 0));
    board.pointerDown(pointerEvent(100, 0));
    board.pointerMove(pointerEvent(110, 0));
    board.pointerUp(pointerEvent(110, 0));

    await vi.waitFor(() => {
      expect(importRuntime).toHaveBeenCalledTimes(1);
    });
    resolveRuntime(createPreciseEraseRuntime());

    await vi.waitFor(() => {
      expect(mocks.executePreciseErase).toHaveBeenCalledTimes(2);
      expect(mocks.findElementsInEraserPath.mock.calls).toEqual([
        [board.children, [[0, 0], [10, 0]], 20],
        [board.children, [[100, 0], [110, 0]], 20],
      ]);
    });
  });

  it('continues the existing unsupported-element cleanup after precise execution fails', async () => {
    const board = createBoard();
    const unsupportedElement = { id: 'unsupported', type: 'custom' };
    const executeError = new Error('clipper failed');
    const runtime = {
      executePreciseErase: vi.fn().mockRejectedValue(executeError),
      findElementsInEraserPath: vi.fn(() => [board.children[0]]),
      findUnsupportedElementsInEraserPath: vi.fn(() => [unsupportedElement]),
    } as unknown as Awaited<ReturnType<PreciseEraseRuntimeLoader>>;
    const consoleError = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);

    withFreehandErase(board as never, async () => runtime);
    board.pointerDown(pointerEvent(0, 0));
    board.pointerMove(pointerEvent(10, 0));
    board.pointerUp(pointerEvent(10, 0));

    await vi.waitFor(() => {
      expect(consoleError).toHaveBeenCalledWith(
        'Precise erase error:',
        executeError
      );
      expect(mocks.removeElements).toHaveBeenCalledWith(board, [
        unsupportedElement,
      ]);
    });

    consoleError.mockRestore();
  });
});
