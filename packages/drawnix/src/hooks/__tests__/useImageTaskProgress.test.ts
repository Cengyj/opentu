import { renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useImageTaskProgress } from '../useImageTaskProgress';
import { TaskType } from '../../types/task.types';

describe('useImageTaskProgress', () => {
  it('keeps factual image progress stable as wall-clock time passes', () => {
    const { result } = renderHook(() =>
      useImageTaskProgress({
        taskType: TaskType.IMAGE,
        fallbackProgress: 37,
      })
    );

    expect(result.current.displayProgress).toBe(37);
  });

  it('uses provider progress when no persisted fallback is supplied', () => {
    const { result } = renderHook(() =>
      useImageTaskProgress({
        taskType: TaskType.IMAGE,
        realProgress: 64,
      })
    );

    expect(result.current.displayProgress).toBe(64);
  });
});
