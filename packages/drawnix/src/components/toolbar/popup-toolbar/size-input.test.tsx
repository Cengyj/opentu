import React from 'react';
import { cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SizeInput } from './size-input';

const mocks = vi.hoisted(() => ({
  selectedElement: {
    id: 'shape-1',
    type: 'geometry',
    points: [
      [0, 0],
      [170, 100],
    ],
  },
  selectionRect: { x: 0, y: 0, width: 170, height: 100 },
  setNode: vi.fn(),
}));

vi.mock('@plait/core', () => ({
  PlaitBoard: {
    getBoardContainer: vi.fn(() => document.body),
  },
  getSelectedElements: vi.fn(() => [mocks.selectedElement]),
  getRectangleByElements: vi.fn(() => mocks.selectionRect),
  Transforms: {
    setNode: mocks.setNode,
  },
}));

vi.mock('@plait/draw', () => ({
  PlaitDrawElement: {
    isDrawElement: vi.fn(() => true),
  },
}));

vi.mock('@plait/mind', () => ({
  MindElement: {
    isMindElement: vi.fn(() => false),
  },
}));

vi.mock('../../../plugins/freehand/type', () => ({
  Freehand: { isFreehand: vi.fn(() => false) },
}));

vi.mock('../../../plugins/pen/type', () => ({
  PenPath: { isPenPath: vi.fn(() => false) },
}));

vi.mock('../../../types/frame.types', () => ({
  isFrameElement: vi.fn(() => false),
}));

vi.mock('../../icons', () => ({
  LockIcon: () => <span />,
  UnlockIcon: () => <span />,
}));

vi.mock('../../popover/popover', () => ({
  Popover: ({ children }: { children: React.ReactNode }) => children,
  PopoverContent: ({ children }: { children: React.ReactNode }) => children,
  PopoverTrigger: ({ children }: { children: React.ReactNode }) => children,
}));

vi.mock('lucide-react', () => ({
  ChevronDown: () => <span />,
}));

vi.mock('../../../i18n', () => ({
  useI18n: () => ({ language: 'zh' }),
}));

vi.mock('../../../constants/frame-presets', () => ({
  PRESET_SIZES: [],
}));

vi.mock('../../shared/hover', () => ({
  HoverTip: ({ children }: { children: React.ReactNode }) => children,
}));

function renderSizeInput() {
  const board = { children: [mocks.selectedElement] };
  const view = render(<SizeInput board={board as never} />);
  const inputs = view.container.querySelectorAll<HTMLInputElement>('.size-input');

  expect(inputs).toHaveLength(2);
  return { ...view, widthInput: inputs[0], heightInput: inputs[1] };
}

describe('SizeInput keyboard commit behavior', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it('cancels the draft size without writing element points when Escape is pressed', () => {
    const { widthInput, heightInput } = renderSizeInput();

    widthInput.focus();
    fireEvent.change(widthInput, { target: { value: '300' } });
    expect(widthInput.value).toBe('300');
    expect(heightInput.value).toBe('176');

    fireEvent.keyDown(widthInput, { key: 'Escape' });

    expect(widthInput.value).toBe('170');
    expect(heightInput.value).toBe('100');
    expect(mocks.setNode).not.toHaveBeenCalled();
  });

  it('commits a valid draft once when Enter is pressed', () => {
    const { widthInput } = renderSizeInput();

    widthInput.focus();
    fireEvent.change(widthInput, { target: { value: '300' } });
    fireEvent.keyDown(widthInput, { key: 'Enter' });

    expect(mocks.setNode).toHaveBeenCalledTimes(1);
    expect(mocks.setNode).toHaveBeenCalledWith(
      expect.anything(),
      {
        points: [
          [0, 0],
          [300, 176],
        ],
      },
      [0]
    );
  });

  it('keeps committing a valid draft when focus leaves normally', () => {
    const { widthInput } = renderSizeInput();

    widthInput.focus();
    fireEvent.change(widthInput, { target: { value: '300' } });
    fireEvent.blur(widthInput);

    expect(mocks.setNode).toHaveBeenCalledTimes(1);
  });

  it('does not suppress the next ordinary blur after Escape consumes its own blur', () => {
    const { widthInput } = renderSizeInput();

    widthInput.focus();
    fireEvent.change(widthInput, { target: { value: '300' } });
    fireEvent.keyDown(widthInput, { key: 'Escape' });
    expect(mocks.setNode).not.toHaveBeenCalled();

    widthInput.focus();
    fireEvent.change(widthInput, { target: { value: '300' } });
    expect(mocks.setNode).not.toHaveBeenCalled();
    widthInput.blur();

    expect(mocks.setNode).toHaveBeenCalledTimes(1);
  });

  it('does not suppress the next ordinary blur after Enter consumes its own blur', () => {
    const { widthInput } = renderSizeInput();

    widthInput.focus();
    fireEvent.change(widthInput, { target: { value: '300' } });
    fireEvent.keyDown(widthInput, { key: 'Enter' });
    expect(mocks.setNode).toHaveBeenCalledTimes(1);

    widthInput.focus();
    fireEvent.change(widthInput, { target: { value: '400' } });
    expect(mocks.setNode).toHaveBeenCalledTimes(1);
    widthInput.blur();

    expect(mocks.setNode).toHaveBeenCalledTimes(2);
  });
});
