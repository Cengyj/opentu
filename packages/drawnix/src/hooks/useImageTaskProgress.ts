import { useMemo } from 'react';
import { TaskType } from '../types/task.types';
import { resolveImageTaskDisplayProgress } from '../utils/image-task-progress';

export interface UseImageTaskProgressOptions {
  taskType?: TaskType | null;
  fallbackProgress?: number | null;
  realProgress?: number;
}

export interface UseImageTaskProgressResult {
  displayProgress: number | null;
}

export function useImageTaskProgress({
  taskType,
  fallbackProgress,
  realProgress,
}: UseImageTaskProgressOptions): UseImageTaskProgressResult {
  const displayProgress = useMemo(() => {
    if (taskType === TaskType.VIDEO || taskType === TaskType.AUDIO) {
      return realProgress ?? 0;
    }

    if (taskType !== TaskType.IMAGE) {
      return fallbackProgress ?? null;
    }

    return resolveImageTaskDisplayProgress({
      fallbackProgress: fallbackProgress ?? realProgress,
    });
  }, [fallbackProgress, realProgress, taskType]);

  return { displayProgress };
}
