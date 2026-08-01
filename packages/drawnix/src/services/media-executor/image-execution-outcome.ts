import type { ImageExecutionOutcome } from './types';
import { taskStorageWriter, type SWTask } from './task-storage-writer';

const TERMINAL_IMAGE_STATUSES = new Set<SWTask['status']>([
  'completed',
  'failed',
  'cancelled',
]);

function toImageExecutionOutcome(task: SWTask): ImageExecutionOutcome {
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
  result: NonNullable<SWTask['result']>
): Promise<ImageExecutionOutcome> {
  const task = await taskStorageWriter.completeTask(taskId, result);
  return toImageExecutionOutcome(task);
}

/** Commit an image failure and return the actual winning terminal row. */
export async function failImageExecution(
  taskId: string,
  error: NonNullable<SWTask['error']>
): Promise<ImageExecutionOutcome> {
  const task = await taskStorageWriter.failTask(taskId, error);
  return toImageExecutionOutcome(task);
}
