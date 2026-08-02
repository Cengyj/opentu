import type { ImageExecutionOutcome } from './types';
import { taskStorageWriter, type SWTask } from './task-storage-writer';

const TERMINAL_IMAGE_STATUSES = new Set<SWTask['status']>([
  'completed',
  'failed',
  'cancelled',
]);

function toImageExecutionOutcome(
  task: SWTask,
  attemptStartedAt?: number
): ImageExecutionOutcome {
  if (
    attemptStartedAt !== undefined &&
    task.type === 'image' &&
    task.startedAt !== attemptStartedAt
  ) {
    return {
      taskId: task.id,
      status: 'stale',
      attemptStartedAt,
      updatedAt: task.updatedAt,
    };
  }

  if (!TERMINAL_IMAGE_STATUSES.has(task.status)) {
    throw new Error(
      `[ImageExecution] Task ${task.id} did not reach a terminal state`
    );
  }

  if (task.status === 'completed' && !task.result?.url) {
    throw new Error(
      `[ImageExecution] Completed task ${task.id} has no image result`
    );
  }

  return {
    taskId: task.id,
    status: task.status as ImageExecutionOutcome['status'],
    ...(attemptStartedAt !== undefined ? { attemptStartedAt } : {}),
    progress: task.progress,
    result: task.result,
    error: task.error,
    completedAt: task.completedAt,
    updatedAt: task.updatedAt,
  };
}

/** Commit a successful image result and return the actual winning terminal row. */
export async function completeImageExecution(
  taskId: string,
  result: NonNullable<SWTask['result']>,
  attemptStartedAt?: number
): Promise<ImageExecutionOutcome> {
  const task =
    attemptStartedAt === undefined
      ? await taskStorageWriter.completeTask(taskId, result)
      : await taskStorageWriter.completeTask(taskId, result, {
          expectedStartedAt: attemptStartedAt,
        });
  return toImageExecutionOutcome(task, attemptStartedAt);
}

/** Commit an image failure and return the actual winning terminal row. */
export async function failImageExecution(
  taskId: string,
  error: NonNullable<SWTask['error']>,
  attemptStartedAt?: number
): Promise<ImageExecutionOutcome> {
  const task =
    attemptStartedAt === undefined
      ? await taskStorageWriter.failTask(taskId, error)
      : await taskStorageWriter.failTask(taskId, error, {
          expectedStartedAt: attemptStartedAt,
        });
  return toImageExecutionOutcome(task, attemptStartedAt);
}
