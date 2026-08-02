import { TaskStatus, TaskType, type Task } from '../types/task.types';

export interface ImageTaskRecoveryIdentity {
  readonly taskId: string;
  readonly remoteId: string;
  readonly startedAt?: number;
  readonly profileId: string | null;
  readonly modelId: string | null;
  readonly bindingId: string | null;
}

export interface ImageTaskRecoveryRuntimeOwnership {
  isTaskOwnedByCurrentSession(taskId: string): boolean;
}

export type ImageTaskHookAction =
  | 'not-image'
  | 'recover-query-only'
  | 'fail-interrupted'
  | 'ignore-owned-or-inactive';

/**
 * Only a processing task restored from an earlier page session may start the
 * query-only recovery executor. A live TaskQueue submission already owns its
 * poll loop, even after it persists and emits the remoteId.
 */
export function shouldStartImageTaskRecovery(
  task: Pick<Task, 'id' | 'type' | 'status' | 'remoteId'>,
  runtime: ImageTaskRecoveryRuntimeOwnership
): boolean {
  return (
    task.type === TaskType.IMAGE &&
    task.status === TaskStatus.PROCESSING &&
    Boolean(task.remoteId) &&
    !runtime.isTaskOwnedByCurrentSession(task.id)
  );
}

/**
 * Decide how the legacy React task observer may treat an image task.
 * It never grants submit authority: new work belongs to TaskQueueService,
 * while prior-session work may only resume a persisted remote operation.
 */
export function resolveImageTaskHookAction(
  task: Pick<Task, 'id' | 'type' | 'status' | 'remoteId'>,
  runtime: ImageTaskRecoveryRuntimeOwnership
): ImageTaskHookAction {
  if (task.type !== TaskType.IMAGE) {
    return 'not-image';
  }
  if (shouldStartImageTaskRecovery(task, runtime)) {
    return 'recover-query-only';
  }
  if (
    task.status === TaskStatus.PENDING &&
    !runtime.isTaskOwnedByCurrentSession(task.id)
  ) {
    return 'fail-interrupted';
  }
  return 'ignore-owned-or-inactive';
}

/** Current-session image requests own their timeout and AbortSignal lifecycle. */
export function shouldHookManageImageTaskTimeout(
  task: Pick<Task, 'id' | 'type'>,
  runtime: ImageTaskRecoveryRuntimeOwnership
): boolean {
  return (
    task.type !== TaskType.IMAGE ||
    !runtime.isTaskOwnedByCurrentSession(task.id)
  );
}

function normalizeIdentityPart(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

/** Capture the immutable identity of one query-only image recovery attempt. */
export function captureImageTaskRecoveryIdentity(
  task: Task
): ImageTaskRecoveryIdentity | null {
  const remoteId = normalizeIdentityPart(task.remoteId);
  if (
    task.type !== TaskType.IMAGE ||
    task.status !== TaskStatus.PROCESSING ||
    !remoteId
  ) {
    return null;
  }

  return Object.freeze({
    taskId: task.id,
    remoteId,
    startedAt: task.startedAt,
    profileId: normalizeIdentityPart(
      task.invocationRoute?.modelRef?.profileId ??
        task.params.modelRef?.profileId
    ),
    modelId: normalizeIdentityPart(
      task.invocationRoute?.modelRef?.modelId ??
        task.invocationRoute?.modelId ??
        task.params.modelRef?.modelId ??
        task.params.model
    ),
    bindingId: normalizeIdentityPart(task.invocationRoute?.binding?.id),
  });
}

/**
 * A late poll result may commit only while the exact persisted recovery
 * identity is still processing. Cancellation and retry both invalidate it.
 */
export function isCurrentImageTaskRecovery(
  task: Task | undefined,
  identity: ImageTaskRecoveryIdentity
): boolean {
  if (
    !task ||
    task.id !== identity.taskId ||
    task.type !== TaskType.IMAGE ||
    task.status !== TaskStatus.PROCESSING ||
    normalizeIdentityPart(task.remoteId) !== identity.remoteId ||
    task.startedAt !== identity.startedAt
  ) {
    return false;
  }

  return (
    normalizeIdentityPart(
      task.invocationRoute?.modelRef?.profileId ??
        task.params.modelRef?.profileId
    ) === identity.profileId &&
    normalizeIdentityPart(
      task.invocationRoute?.modelRef?.modelId ??
        task.invocationRoute?.modelId ??
        task.params.modelRef?.modelId ??
        task.params.model
    ) === identity.modelId &&
    normalizeIdentityPart(task.invocationRoute?.binding?.id) ===
      identity.bindingId
  );
}
