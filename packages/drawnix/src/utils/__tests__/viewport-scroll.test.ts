import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PlaitBoard } from '@plait/core';
import { isPointInViewport, scrollToPointIfNeeded } from '../viewport-scroll';

const coreMocks = vi.hoisted(() => ({
  getBoardContainer: vi.fn(),
  getViewportOrigination: vi.fn(),
  updateViewport: vi.fn(),
}));

vi.mock('@plait/core', () => ({
  PlaitBoard: {
    getBoardContainer: coreMocks.getBoardContainer,
  },
  BoardTransforms: {
    updateViewport: coreMocks.updateViewport,
  },
  getViewportOrigination: coreMocks.getViewportOrigination,
}));

function createBoard(): PlaitBoard {
  return {
    viewport: {
      zoom: 2,
    },
  } as PlaitBoard;
}

describe('viewport scroll contract', () => {
  beforeEach(() => {
    coreMocks.getBoardContainer.mockReturnValue({
      getBoundingClientRect: () => ({ width: 800, height: 600 }),
    });
    coreMocks.getViewportOrigination.mockReturnValue([10, 20]);
    coreMocks.updateViewport.mockReset();
  });

  it('uses board coordinates, zoom and margin to classify visibility', () => {
    const board = createBoard();

    expect(isPointInViewport(board, [100, 100], 50)).toBe(true);
    expect(isPointInViewport(board, [20, 30], 50)).toBe(false);
  });

  it('does not move an already visible point', () => {
    scrollToPointIfNeeded(createBoard(), [100, 100], 50);

    expect(coreMocks.updateViewport).not.toHaveBeenCalled();
  });

  it('centers an off-screen point while preserving zoom', () => {
    const board = createBoard();

    scrollToPointIfNeeded(board, [1000, 800], 50);

    expect(coreMocks.updateViewport).toHaveBeenCalledWith(board, [800, 650], 2);
  });
});

describe('viewport scroll startup boundary', () => {
  it('keeps the flowchart shortcut off the heavyweight selection utility', () => {
    const flowchartSource = readFileSync(
      resolve(__dirname, '../../plugins/with-flowchart-shortcut.ts'),
      'utf8'
    );

    expect(flowchartSource).toContain("from '../utils/viewport-scroll'");
    expect(flowchartSource).not.toContain("from '../utils/selection-utils'");
  });
});
