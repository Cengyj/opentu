import type { Task } from '../types/task.types';
import {
  completeImageExecution,
  failImageExecution,
} from './media-executor/image-execution-outcome';
import type { ImageExecutionOutcome } from './media-executor/types';
import type { ImageTaskRecoveryIdentity } from './image-task-recovery-guard';

/**
 * Commit a query-only recovery through the same durable terminal boundary used
 * by normal image execution. The captured startedAt value is the attempt
 * identity, so a cancelled or retried task wins over a late poll result.
 */
export function completeImageTaskRecovery(
  identity: ImageTaskRecoveryIdentity,
  result: NonNullable<Task['result']>
): Promise<ImageExecutionOutcome> {
  return completeImageExecution(identity.taskId, result, identity.startedAt);
}

/** Commit a recovery failure without bypassing image terminal-state guards. */
export function failImageTaskRecovery(
  identity: ImageTaskRecoveryIdentity,
  error: Parameters<typeof failImageExecution>[1]
): Promise<ImageExecutionOutcome> {
  return failImageExecution(identity.taskId, error, identity.startedAt);
}
