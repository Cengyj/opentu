import type { Task } from '../types/task.types';
import { TaskStatus } from '../types/task.types';

export type TaskInterruptionSkipReason =
  | 'current-session'
  | 'newer-runtime-state';

export interface TaskRecoveryRuntime {
  getTask(taskId: string): Task | undefined;
  isTaskOwnedByCurrentSession(taskId: string): boolean;
}

/**
 * Decide whether a persisted `processing` snapshot must not be marked as an
 * interrupted task during startup restoration.
 *
 * IndexedDB loading races with task creation. The snapshot may therefore
 * contain a task that this page has just started, or an older state than the
 * one already held in memory. Neither case represents a page-refresh
 * interruption.
 */
export function getTaskInterruptionSkipReason(
  storedTask: Task,
  runtime: TaskRecoveryRuntime
): TaskInterruptionSkipReason | null {
  if (runtime.isTaskOwnedByCurrentSession(storedTask.id)) {
    return 'current-session';
  }

  const runtimeTask = runtime.getTask(storedTask.id);
  if (
    runtimeTask &&
    (runtimeTask.status !== TaskStatus.PROCESSING ||
      runtimeTask.updatedAt > storedTask.updatedAt)
  ) {
    return 'newer-runtime-state';
  }

  return null;
}
