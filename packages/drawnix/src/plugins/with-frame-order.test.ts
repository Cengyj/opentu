import { createTestingBoard, withHistory } from '@plait/core';
import { describe, expect, it } from 'vitest';
import { FrameTransforms } from './with-frame';

function createFrame(
  id: string,
  pageIndex: number,
  name = `PPT 页面 ${pageIndex}`
) {
  return {
    id,
    type: 'frame',
    name,
    points: [
      [(pageIndex - 1) * 1980, 0],
      [(pageIndex - 1) * 1980 + 1920, 1080],
    ],
    children: [],
    pptMeta: {
      pageIndex,
      slidePrompt: `slide ${pageIndex}`,
    },
  };
}

describe('FrameTransforms.reorderPPTFrames', () => {
  it('keeps the root node order and PPT page metadata in one deck order', () => {
    const first = createFrame('frame-1', 1);
    const second = createFrame('frame-2', 2, 'Custom title');
    const third = createFrame('frame-3', 3);
    const boundImage = {
      id: 'image-1',
      type: 'image',
      frameId: first.id,
      points: first.points,
      url: 'data:image/png;base64,AA==',
      children: [],
    };
    const board = createTestingBoard([], [
      first,
      boundImage,
      second,
      third,
    ] as any);

    FrameTransforms.reorderPPTFrames(board, [third.id, first.id, second.id]);

    const frames = board.children.filter(
      (element) => element.type === 'frame'
    ) as typeof first[];
    expect(frames.map((frame) => frame.id)).toEqual([
      third.id,
      first.id,
      second.id,
    ]);
    expect(frames.map((frame) => frame.pptMeta.pageIndex)).toEqual([1, 2, 3]);
    expect(frames.map((frame) => frame.name)).toEqual([
      'PPT 页面 1',
      'PPT 页面 2',
      'Custom title',
    ]);
    expect(board.children.find((element) => element.id === boundImage.id)).toBe(
      boundImage
    );
  });

  it('does not turn a generic Frame collection into PPT metadata', () => {
    const first = {
      id: 'generic-1',
      type: 'frame',
      name: 'Frame 1',
      points: [
        [0, 0],
        [800, 600],
      ],
      children: [],
    };
    const second = {
      ...first,
      id: 'generic-2',
      name: 'Frame 2',
      points: [
        [860, 0],
        [1660, 600],
      ],
    };
    const board = createTestingBoard([], [first, second] as any);

    FrameTransforms.reorderPPTFrames(board, [second.id, first.id]);

    expect(board.children.map((element) => element.id)).toEqual([
      second.id,
      first.id,
    ]);
    expect(board.children.every((element) => !('pptMeta' in element))).toBe(
      true
    );
  });

  it('keeps one drag reorder in one undo history batch', () => {
    const first = createFrame('frame-1', 1);
    const second = createFrame('frame-2', 2);
    const third = createFrame('frame-3', 3);
    const board = createTestingBoard(
      [withHistory],
      [first, second, third] as any
    );

    FrameTransforms.reorderPPTFrames(board, [third.id, first.id, second.id]);
    board.undo();

    const frames = board.children as typeof first[];
    expect(frames.map((frame) => frame.id)).toEqual([
      first.id,
      second.id,
      third.id,
    ]);
    expect(frames.map((frame) => frame.pptMeta.pageIndex)).toEqual([1, 2, 3]);
  });
});
