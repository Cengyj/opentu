import { describe, expect, it } from 'vitest';
import type { PlaitImageGenerationAnchor } from '../../types/image-generation-anchor.types';
import {
  getAnchorCurrentPosition,
  isSamePoint,
  resolveImageAnchorInsertionPoint,
} from '../image-generation-anchor-insertion';

function createAnchor(
  overrides: Partial<PlaitImageGenerationAnchor> = {}
): PlaitImageGenerationAnchor {
  return {
    id: 'anchor-1',
    type: 'generation-anchor',
    points: [
      [120, 240],
      [440, 420],
    ],
    angle: 0,
    anchorType: 'ratio',
    phase: 'queued',
    title: '图片生成',
    transitionMode: 'hold',
    createdAt: 1,
    workflowId: 'wf-1',
    taskIds: ['task-1'],
    expectedInsertPosition: [80, 90],
    zoom: 1,
    children: [],
    requestedCount: 1,
    ...overrides,
  };
}

describe('image-generation-anchor-insertion', () => {
  it('prefers current anchor position over stale expected insert position', () => {
    const anchor = createAnchor();

    expect(
      resolveImageAnchorInsertionPoint({
        anchor,
        workzoneExpectedInsertPosition: [32, 64],
      })
    ).toEqual([120, 240]);
  });

  it('falls back to workzone position when anchor is unavailable', () => {
    expect(
      resolveImageAnchorInsertionPoint({
        anchor: null,
        workzoneExpectedInsertPosition: [32, 64],
      })
    ).toEqual([32, 64]);
  });

  it('returns current anchor start point when available', () => {
    expect(getAnchorCurrentPosition(createAnchor())).toEqual([120, 240]);
  });

  it('compares points safely', () => {
    expect(isSamePoint([1, 2], [1, 2])).toBe(true);
    expect(isSamePoint([1, 2], [2, 1])).toBe(false);
    expect(isSamePoint(undefined, undefined)).toBe(true);
  });
});
