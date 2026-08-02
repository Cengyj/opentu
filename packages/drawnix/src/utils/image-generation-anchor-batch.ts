import type { PlaitImageGenerationAnchor } from '../types/image-generation-anchor.types';
import { TaskStatus, TaskType, type Task } from '../types/task.types';
import type {
  ImageArtifact,
  ImageArtifactResultLike,
} from '../types/image-artifact.types';
import { resolveImageArtifactsFromTaskResult } from '../types/image-artifact.types';
import { resolveImageTaskDisplayProgress } from './image-task-progress';

function clampProgress(value: number): number {
  if (Number.isNaN(value)) {
    return 0;
  }

  return Math.max(0, Math.min(100, Math.round(value)));
}

export function getTaskResultPreviewUrls(task: Pick<Task, 'result'>): string[] {
  const result = task.result as
    | {
        previewImageUrl?: string;
        url?: string;
        urls?: string[];
      }
    | undefined;

  const candidates = result?.urls?.length
    ? result.urls
    : [result?.previewImageUrl, result?.url];

  return Array.from(
    new Set(
      candidates.filter(
        (candidate): candidate is string =>
          typeof candidate === 'string' && candidate.length > 0
      )
    )
  );
}

/**
 * Returns only generated image artifacts. Preview/cover fields are excluded so
 * material libraries and downloads cannot mistake auxiliary media for output.
 */
export function getTaskResultArtifactUrls(
  task: { readonly result?: ImageArtifactResultLike }
): string[] {
  return getTaskResultImageArtifacts(task).map((artifact) => artifact.url);
}

/**
 * Read the canonical task artifact contract. Historical url/urls records are
 * upgraded once at this read boundary and never reinterpreted by consumers.
 */
export function getTaskResultImageArtifacts(
  task: { readonly result?: ImageArtifactResultLike }
): ImageArtifact[] {
  return resolveImageArtifactsFromTaskResult(task.result);
}

export interface CompletedImageTaskResult {
  readonly task: Task;
  readonly taskIndex: number;
  readonly resultIndex: number;
  readonly resultCount: number;
  readonly url: string;
  readonly artifact: ImageArtifact;
}

/**
 * Projects completed image tasks into their ordered, provider-independent
 * result URLs. A task remains the paid-attempt boundary while every artifact
 * returned by that attempt remains visible to downstream UI consumers.
 */
export function getCompletedImageTaskResults(
  tasks: readonly Task[]
): CompletedImageTaskResult[] {
  return tasks.flatMap((task, taskIndex) => {
    if (task.type !== TaskType.IMAGE || task.status !== TaskStatus.COMPLETED) {
      return [];
    }

    const artifacts = getTaskResultImageArtifacts(task);
    return artifacts.map((artifact, resultIndex) => ({
      task,
      taskIndex,
      resultIndex,
      resultCount: artifacts.length,
      url: artifact.url,
      artifact,
    }));
  });
}

export function getImageGenerationBatchExpectedCount(
  anchor: Pick<PlaitImageGenerationAnchor, 'requestedCount' | 'taskIds'>
): number {
  return Math.max(anchor.requestedCount ?? 0, anchor.taskIds.length, 1);
}

export function getImageGenerationTaskObservedSlotCount(task: Task): number {
  const previewUrls = getTaskResultPreviewUrls(task);
  return previewUrls.length > 0 ? previewUrls.length : 1;
}

export function getImageGenerationBatchObservedSlotCount(
  tasks: Task[]
): number {
  return tasks.reduce(
    (count, task) => count + getImageGenerationTaskObservedSlotCount(task),
    0
  );
}

export function hasResolvedImageGenerationBatchCount(
  anchor: Pick<
    PlaitImageGenerationAnchor,
    'anchorType' | 'requestedCount' | 'taskIds'
  >,
  tasks: Task[]
): boolean {
  if (anchor.anchorType !== 'stack') {
    return tasks.length > 0;
  }

  return (
    getImageGenerationBatchObservedSlotCount(tasks) >=
    getImageGenerationBatchExpectedCount(anchor)
  );
}

function resolveTaskDisplayProgress(task: Task): number | null {
  if (task.insertedToCanvas || task.status === TaskStatus.COMPLETED) {
    return 100;
  }

  if (task.status === TaskStatus.FAILED) {
    return 100;
  }

  if (task.type !== TaskType.IMAGE) {
    return typeof task.progress === 'number' ? clampProgress(task.progress) : 0;
  }

  if (task.status === TaskStatus.PROCESSING) {
    return resolveImageTaskDisplayProgress({
      fallbackProgress: task.progress,
    });
  }

  if (typeof task.progress === 'number') {
    return clampProgress(task.progress);
  }

  return 0;
}

export function resolveImageGenerationBatchDisplayProgress(
  anchor: Pick<PlaitImageGenerationAnchor, 'requestedCount' | 'taskIds'>,
  tasks: Task[],
  fallbackProgress?: number | null
): number | null {
  if (tasks.length === 0) {
    return typeof fallbackProgress === 'number'
      ? clampProgress(fallbackProgress)
      : null;
  }

  const progressSamples = tasks
    .map((task) => resolveTaskDisplayProgress(task))
    .filter((progress): progress is number => typeof progress === 'number');

  if (progressSamples.length === 0) {
    return typeof fallbackProgress === 'number'
      ? clampProgress(fallbackProgress)
      : null;
  }

  const expectedCount = getImageGenerationBatchExpectedCount(anchor);
  const terminalCoverage = tasks.reduce((count, task) => {
    if (
      task.insertedToCanvas ||
      task.status === TaskStatus.COMPLETED ||
      task.status === TaskStatus.FAILED
    ) {
      return count + getImageGenerationTaskObservedSlotCount(task);
    }

    return count;
  }, 0);
  const settledFloor = Math.floor((terminalCoverage / expectedCount) * 100);
  const averageProgress =
    progressSamples.reduce((sum, progress) => sum + progress, 0) /
    progressSamples.length;

  return clampProgress(
    Math.max(
      averageProgress,
      settledFloor,
      typeof fallbackProgress === 'number' ? fallbackProgress : 0
    )
  );
}
