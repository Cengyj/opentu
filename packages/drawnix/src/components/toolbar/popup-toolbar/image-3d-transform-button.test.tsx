import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PopupImage3DTransformButton } from './image-3d-transform-button';

const mocks = vi.hoisted(() => ({
  withNewBatch: vi.fn((_board: unknown, callback: () => void) => callback()),
  withoutSaving: vi.fn((_board: unknown, callback: () => void) => callback()),
  setNode: vi.fn(
    (
      board: { children: Array<Record<string, unknown>> },
      properties: Record<string, unknown>,
      path: number[]
    ) => {
      board.children[path[0]] = {
        ...board.children[path[0]],
        ...properties,
      };
    }
  ),
}));

vi.mock('@plait/core', () => ({
  ATTACHED_ELEMENT_CLASS_NAME: 'attached-element',
  PlaitBoard: {
    getBoardContainer: vi.fn(() => document.body),
  },
  PlaitHistoryBoard: {
    withNewBatch: mocks.withNewBatch,
    withoutSaving: mocks.withoutSaving,
  },
  Transforms: {
    setNode: mocks.setNode,
  },
}));

vi.mock('../../tool-button', () => ({
  ToolButton: ({
    icon,
    onPointerUp,
    'aria-label': ariaLabel,
  }: React.ButtonHTMLAttributes<HTMLButtonElement> & { icon?: React.ReactNode }) => (
    <button aria-label={ariaLabel} onPointerUp={onPointerUp}>
      {icon}
    </button>
  ),
}));

vi.mock('../../popover/popover', () => ({
  Popover: ({ children }: { children: React.ReactNode }) => children,
  PopoverContent: ({ children }: { children: React.ReactNode }) => children,
  PopoverTrigger: ({ children }: { children: React.ReactNode }) => children,
}));

vi.mock('../../island', () => ({
  Island: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock('../../../utils/selection-utils', () => ({
  notifyAISelectionContentRefresh: vi.fn(),
}));

vi.mock('lucide-react', () => ({
  Box: () => <span />,
  Check: () => <span />,
  RotateCcw: () => <span />,
  X: () => <span />,
}));

describe('PopupImage3DTransformButton selection changes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it('rolls an unconfirmed preview back on the element where editing started', () => {
    const imageA = { id: 'image-a', type: 'image' };
    const imageB = {
      id: 'image-b',
      type: 'image',
      transform3d: { rotateX: 12, rotateY: 0, perspective: 1000 },
    };
    const board = { children: [imageA, imageB] };

    const view = render(
      <PopupImage3DTransformButton
        board={board as never}
        element={imageA as never}
        title="3D"
        language="zh"
      />
    );

    fireEvent.pointerUp(screen.getByRole('button', { name: '3D' }));
    const rotateYSlider = view.container.querySelector<HTMLInputElement>(
      'input[type="range"]'
    );
    expect(rotateYSlider).not.toBeNull();
    if (!rotateYSlider) throw new Error('rotateY slider was not rendered');
    fireEvent.change(rotateYSlider, { target: { value: '45' } });

    expect(board.children[0]).toMatchObject({
      transform3d: { rotateX: 0, rotateY: 45, perspective: 800 },
    });

    view.rerender(
      <PopupImage3DTransformButton
        board={board as never}
        element={imageB as never}
        title="3D"
        language="zh"
      />
    );

    expect(board.children[0].transform3d).toBeUndefined();
    expect(board.children[1]).toMatchObject({
      transform3d: { rotateX: 12, rotateY: 0, perspective: 1000 },
    });
    expect(mocks.withNewBatch).not.toHaveBeenCalled();
  });

  it('restores the opening transform when the user cancels', () => {
    const image = {
      id: 'image-a',
      type: 'image',
      transform3d: { rotateX: 12, rotateY: 0, perspective: 1000 },
    };
    const board = { children: [image] };
    const view = render(
      <PopupImage3DTransformButton
        board={board as never}
        element={image as never}
        title="3D"
        language="zh"
      />
    );

    fireEvent.pointerUp(screen.getByRole('button', { name: '3D' }));
    const rotateYSlider = view.container.querySelector<HTMLInputElement>(
      'input[type="range"]'
    );
    expect(rotateYSlider).not.toBeNull();
    if (!rotateYSlider) throw new Error('rotateY slider was not rendered');
    fireEvent.change(rotateYSlider, { target: { value: '45' } });
    fireEvent.click(screen.getByRole('button', { name: '取消' }));

    expect(board.children[0]).toMatchObject({
      transform3d: { rotateX: 12, rotateY: 0, perspective: 1000 },
    });
    expect(mocks.withNewBatch).not.toHaveBeenCalled();
  });

  it('commits the final transform in one history batch', () => {
    const image = { id: 'image-a', type: 'image' };
    const board = { children: [image] };
    const view = render(
      <PopupImage3DTransformButton
        board={board as never}
        element={image as never}
        title="3D"
        language="zh"
      />
    );

    fireEvent.pointerUp(screen.getByRole('button', { name: '3D' }));
    const rotateYSlider = view.container.querySelector<HTMLInputElement>(
      'input[type="range"]'
    );
    expect(rotateYSlider).not.toBeNull();
    if (!rotateYSlider) throw new Error('rotateY slider was not rendered');
    fireEvent.change(rotateYSlider, { target: { value: '45' } });
    fireEvent.click(screen.getByRole('button', { name: '确定' }));

    expect(board.children[0]).toMatchObject({
      transform3d: { rotateX: 0, rotateY: 45, perspective: 800 },
    });
    expect(mocks.withNewBatch).toHaveBeenCalledTimes(1);
  });
});
