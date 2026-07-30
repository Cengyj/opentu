import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { LayerPanel } from './LayerPanel';

const mocks = vi.hoisted(() => ({
  board: null as null | {
    children: Array<{ id: string; type: string; text: string; locked?: boolean }>;
    afterChange: () => void;
  },
  setNode: vi.fn(),
}));

vi.mock('../../hooks/use-drawnix', () => ({
  useDrawnix: () => ({ board: mocks.board }),
}));

vi.mock('@plait/core', () => ({
  PlaitBoard: {
    getBoardContainer: vi.fn(() => ({ clientWidth: 1000, clientHeight: 800 })),
  },
  PlaitElement: {
    getElementG: vi.fn(),
  },
  Transforms: {
    setNode: mocks.setNode,
  },
  getSelectedElements: vi.fn(() => []),
  clearSelectedElement: vi.fn(),
  addSelectedElement: vi.fn(),
  BoardTransforms: {
    updateViewport: vi.fn(),
  },
  RectangleClient: {},
  getRectangleByElements: vi.fn(() => ({
    x: 0,
    y: 0,
    width: 100,
    height: 40,
  })),
}));

vi.mock('@plait/draw', () => ({
  PlaitDrawElement: {
    isDrawElement: vi.fn(() => false),
  },
}));

vi.mock('@plait/mind', () => ({
  MindElement: {
    isMindElement: vi.fn(() => false),
  },
}));

vi.mock('../../plugins/freehand/type', () => ({
  Freehand: { isFreehand: vi.fn(() => false) },
}));

vi.mock('../../plugins/pen/type', () => ({
  PenPath: { isPenPath: vi.fn(() => false) },
}));

vi.mock('../../types/frame.types', () => ({
  getFrameDisplayName: vi.fn(() => ''),
  isFrameElement: vi.fn(() => false),
}));

vi.mock('../../plugins/with-tool', () => ({
  isToolElement: vi.fn(() => false),
}));

vi.mock('../../utils/selection-utils', () => ({
  extractTextFromElement: (element: { text?: string }) => element.text || '',
}));

vi.mock('../shared', () => ({
  HoverTip: ({ children }: { children: React.ReactNode }) => children,
}));

vi.mock('tdesign-icons-react', () => ({
  BrowseIcon: () => <span data-icon="visible" />,
  BrowseOffIcon: () => <span data-icon="hidden" />,
  LockOnIcon: () => <span data-icon="locked" />,
  LockOffIcon: () => <span data-icon="unlocked" />,
}));

function createBoard(
  children: Array<{ id: string; type: string; text: string; locked?: boolean }>
) {
  return {
    children,
    afterChange: vi.fn(),
  };
}

describe('LayerPanel current board state', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.board = null;
  });

  it('refreshes layers when the same board instance receives replacement children', () => {
    const board = createBoard([
      { id: 'old', type: 'text', text: 'old layer' },
    ]);
    mocks.board = board;
    const { rerender } = render(<LayerPanel />);

    expect(screen.queryByText('old layer')).not.toBeNull();

    board.children = [
      { id: 'new', type: 'text', text: 'new layer', locked: true },
    ];
    rerender(<LayerPanel />);

    expect(screen.queryByText('old layer')).toBeNull();
    expect(screen.queryByText('new layer')).not.toBeNull();
  });

  it('unlocks an element whose locked value changed outside the panel', () => {
    const element = { id: 'text-1', type: 'text', text: 'layer' };
    const board = createBoard([element]);
    mocks.board = board;
    const { container } = render(<LayerPanel />);

    element.locked = true;
    act(() => board.afterChange());

    const buttons = container.querySelectorAll('.layer-panel__item button');
    expect(buttons).toHaveLength(2);
    fireEvent.click(buttons[1]);

    expect(mocks.setNode).toHaveBeenCalledWith(
      board,
      { locked: false },
      [0]
    );
  });
});
