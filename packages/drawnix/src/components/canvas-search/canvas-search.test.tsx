import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CanvasSearch } from './canvas-search';

const mocks = vi.hoisted(() => ({
  extractTextFromElement: vi.fn(
    (element: { text?: string }) => element.text || ''
  ),
  scrollToPoint: vi.fn(),
  setSearchHighlightQuery: vi.fn(),
}));

vi.mock('@plait/core', () => ({
  getRectangleByElements: vi.fn(() => ({
    x: 0,
    y: 0,
    width: 100,
    height: 40,
  })),
}));

vi.mock('../../utils/selection-utils', () => ({
  extractTextFromElement: mocks.extractTextFromElement,
  scrollToPoint: mocks.scrollToPoint,
}));

vi.mock('@plait-board/react-text', () => ({
  setSearchHighlightQuery: mocks.setSearchHighlightQuery,
}));

vi.mock('../../i18n', () => ({
  useI18n: () => ({ language: 'zh' }),
}));

vi.mock('../shared', () => ({
  HoverTip: ({ children }: { children: React.ReactNode }) => children,
}));

describe('CanvasSearch', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      callback(0);
      return 1;
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('counts every consecutive element containing the same query', async () => {
    const board = {
      children: [
        { id: 'text-1', text: 'needle' },
        { id: 'text-2', text: 'needle' },
      ],
    };

    render(
      <CanvasSearch
        open
        onClose={vi.fn()}
        board={board as never}
      />
    );

    fireEvent.change(screen.getByPlaceholderText('搜索画布内容...'), {
      target: { value: 'needle' },
    });
    await act(async () => {
      vi.advanceTimersByTime(200);
    });

    expect(screen.queryByText('1 / 2')).not.toBeNull();
  });

  it('recomputes matches when the same board receives replacement children', async () => {
    const board = {
      children: [{ id: 'text-1', text: 'needle' }],
    };
    const { rerender } = render(
      <CanvasSearch open onClose={vi.fn()} board={board as never} />
    );

    fireEvent.change(screen.getByPlaceholderText('搜索画布内容...'), {
      target: { value: 'needle' },
    });
    await act(async () => {
      vi.advanceTimersByTime(200);
    });
    expect(screen.queryByText('1 / 1')).not.toBeNull();

    board.children = [
      { id: 'text-2', text: 'needle' },
      { id: 'text-3', text: 'needle elsewhere' },
    ];
    rerender(<CanvasSearch open onClose={vi.fn()} board={board as never} />);

    expect(screen.queryByText('1 / 2')).not.toBeNull();
  });
});
