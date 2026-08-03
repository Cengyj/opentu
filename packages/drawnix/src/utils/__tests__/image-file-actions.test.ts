import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PlaitBoard } from '@plait/core';

const createBoard = () => ({ id: 'image-file-actions-board' } as unknown as PlaitBoard);

describe('image file action lazy runtime', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    vi.doUnmock('../image');
  });

  it('does not load the heavy image runtime until the first real action', async () => {
    const runtimeLoaded = vi.fn();
    vi.doMock('../image', () => {
      runtimeLoaded();
      return {
        addImage: vi.fn(),
        saveAsImage: vi.fn(),
      };
    });

    await import('../image-file-actions');

    expect(runtimeLoaded).not.toHaveBeenCalled();
  });

  it('shares one first import and preserves file-picker arguments', async () => {
    const runtimeLoaded = vi.fn();
    const addImage = vi.fn().mockResolvedValue(undefined);
    vi.doMock('../image', () => {
      runtimeLoaded();
      return { addImage, saveAsImage: vi.fn() };
    });
    const { openImageFilePicker } = await import('../image-file-actions');
    const firstBoard = createBoard();
    const secondBoard = createBoard();

    await Promise.all([
      openImageFilePicker(firstBoard),
      openImageFilePicker(secondBoard),
    ]);

    expect(runtimeLoaded).toHaveBeenCalledTimes(1);
    expect(addImage.mock.calls).toEqual([[firstBoard], [secondBoard]]);
  });

  it('forwards PNG/JPG transparency exactly and reuses the loaded runtime', async () => {
    const runtimeLoaded = vi.fn();
    const saveAsImage = vi.fn();
    vi.doMock('../image', () => {
      runtimeLoaded();
      return { addImage: vi.fn(), saveAsImage };
    });
    const { exportBoardImage } = await import('../image-file-actions');
    const board = createBoard();

    await exportBoardImage(board, true);
    await exportBoardImage(board, false);

    expect(runtimeLoaded).toHaveBeenCalledTimes(1);
    expect(saveAsImage.mock.calls).toEqual([
      [board, true],
      [board, false],
    ]);
  });

  it('preserves action errors without converting or swallowing them', async () => {
    const actionError = new Error('file picker failed');
    const addImage = vi.fn().mockRejectedValue(actionError);
    vi.doMock('../image', () => ({ addImage, saveAsImage: vi.fn() }));
    const { openImageFilePicker } = await import('../image-file-actions');

    await expect(openImageFilePicker(createBoard())).rejects.toBe(actionError);
  });

  it('drops a failed import attempt so the next user action can retry', async () => {
    const importError = new Error('image action chunk unavailable');
    const addImage = vi.fn().mockResolvedValue(undefined);
    let importAttempts = 0;
    vi.doMock('../image', async () => {
      importAttempts += 1;
      if (importAttempts === 1) {
        throw importError;
      }
      return { addImage, saveAsImage: vi.fn() };
    });
    const { openImageFilePicker } = await import('../image-file-actions');
    const board = createBoard();

    await expect(openImageFilePicker(board)).rejects.toThrow();
    await expect(openImageFilePicker(board)).resolves.toBeUndefined();

    expect(importAttempts).toBe(2);
    expect(addImage).toHaveBeenCalledTimes(1);
    expect(addImage).toHaveBeenCalledWith(board);
  });
});

describe('image file action startup boundary', () => {
  const readSource = (relativePath: string) =>
    readFileSync(resolve(__dirname, relativePath), 'utf8');

  it('keeps the heavy image utility behind the dedicated dynamic boundary', () => {
    const source = readSource('../image-file-actions.ts');

    expect(source).toContain("await import('./image')");
    expect(source).toContain('createRetriableModuleLoader');
    expect(source).not.toMatch(
      /^import\s+.+from\s+['"]\.\/image['"];?$/m
    );
  });

  it('routes every file-picker and board-export entry through the lightweight boundary', () => {
    const consumers = [
      '../../plugins/with-hotkey.ts',
      '../../components/command-palette/command-registry.ts',
      '../../components/toolbar/app-toolbar/app-menu-items.tsx',
      '../../components/toolbar/creation-toolbar.tsx',
      '../../components/toolbar/more-tools-panel-runtime.tsx',
      '../../components/toolbar/quick-creation-toolbar/quick-creation-toolbar.tsx',
    ].map(readSource);

    for (const source of consumers) {
      expect(source).toContain('image-file-actions');
      expect(source).not.toMatch(
        /from\s+['"][^'"]*utils\/image['"]/m
      );
    }
  });

  it('retains the established picker and PNG/JPG action arguments at each entry', () => {
    const hotkey = readSource('../../plugins/with-hotkey.ts');
    const commandRegistry = readSource(
      '../../components/command-palette/command-registry.ts'
    );
    const appMenu = readSource(
      '../../components/toolbar/app-toolbar/app-menu-items.tsx'
    );
    const creationToolbar = readSource(
      '../../components/toolbar/creation-toolbar.tsx'
    );
    const moreToolsPanel = readSource(
      '../../components/toolbar/more-tools-panel-runtime.tsx'
    );
    const quickToolbar = readSource(
      '../../components/toolbar/quick-creation-toolbar/quick-creation-toolbar.tsx'
    );

    expect(hotkey).toContain('exportBoardImage(board, true)');
    expect(hotkey).toContain('openImageFilePicker(board)');
    expect(commandRegistry).toContain('exportBoardImage(board, true)');
    expect(appMenu).toContain('exportBoardImage(board, true)');
    expect(appMenu).toContain('exportBoardImage(board, false)');
    expect(creationToolbar).toContain('openImageFilePicker(board)');
    expect(moreToolsPanel).toContain('openImageFilePicker(board)');
    expect(quickToolbar).toContain('openImageFilePicker(board)');
  });
});
