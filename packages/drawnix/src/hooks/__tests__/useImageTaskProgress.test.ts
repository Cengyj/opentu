import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useImageTaskProgress } from '../useImageTaskProgress';
import { getImageTaskProgressStatusText } from '../../utils/image-task-progress';
import { TaskStatus, TaskType } from '../../types/task.types';

describe('useImageTaskProgress', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('advances image generation progress over time for processing tasks', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-15T08:00:00.000Z'));

    const startedAt = Date.now();
    const { result } = renderHook(() =>
      useImageTaskProgress({
        taskType: TaskType.IMAGE,
        taskStatus: TaskStatus.PROCESSING,
        startedAt,
      })
    );

    const initialProgress = result.current.displayProgress ?? 0;
    expect(getImageTaskProgressStatusText(initialProgress)).toBe('分析提示词...');

    act(() => {
      vi.advanceTimersByTime(90_000);
    });

    const advancedProgress = result.current.displayProgress ?? 0;
    expect(advancedProgress).toBeGreaterThan(initialProgress);
    expect(advancedProgress).toBeGreaterThan(30);
    expect(getImageTaskProgressStatusText(advancedProgress)).toBe('生成中...');
  });
});
