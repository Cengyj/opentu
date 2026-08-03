import { useEffect, useMemo, useRef, useState } from 'react';
import {
  loadImageGenerationAnchorTaskRuntime,
  type ImageGenerationAnchorTaskRuntime,
} from '../services/image-generation-anchor-task-runtime';
import {
  getImageGenerationAnchorControllerResult,
  type ImageGenerationAnchorControllerOptions as UseImageGenerationAnchorControllerOptions,
  type ImageGenerationAnchorControllerResult,
} from '../utils/image-generation-anchor-controller';
import {
  doesTaskBelongToImageGenerationAnchor,
  getTasksForImageGenerationAnchor,
  selectPrimaryImageGenerationAnchorTask,
} from '../utils/image-generation-anchor-task';
import { TaskStatus, type Task } from '../types/task.types';
import { useImageTaskProgress } from './useImageTaskProgress';
import { hasResolvedImageGenerationBatchCount } from '../utils/image-generation-anchor-batch';

export function useImageGenerationAnchorController(
  options: UseImageGenerationAnchorControllerOptions
): ImageGenerationAnchorControllerResult {
  const { anchor, task: providedTask } = options;
  const [taskRuntime, setTaskRuntime] =
    useState<ImageGenerationAnchorTaskRuntime | null>(null);
  const [runtimeTaskState, setRuntimeTaskState] = useState<{
    scopeKey: string;
    tasks: Task[];
  }>({ scopeKey: '', tasks: [] });
  const taskAnchorRef = useRef(anchor);
  taskAnchorRef.current = anchor;
  const taskScopeKey = JSON.stringify([
    anchor.id,
    anchor.anchorType,
    anchor.workflowId,
    anchor.primaryTaskId,
    anchor.batchId,
    anchor.batchIndex,
    anchor.taskIds,
  ]);
  const relatedTasks = useMemo(
    () =>
      providedTask
        ? [providedTask]
        : runtimeTaskState.scopeKey === taskScopeKey
        ? runtimeTaskState.tasks
        : [],
    [providedTask, runtimeTaskState, taskScopeKey]
  );

  useEffect(() => {
    if (providedTask) {
      return;
    }

    let disposed = false;
    let unsubscribe: (() => void) | undefined;

    void loadImageGenerationAnchorTaskRuntime()
      .then((runtime) => {
        if (disposed) {
          return;
        }

        const refreshRelatedTasks = () => {
          setRuntimeTaskState({
            scopeKey: taskScopeKey,
            tasks: getTasksForImageGenerationAnchor(
              taskAnchorRef.current,
              runtime.taskQueueService.getAllTasks()
            ),
          });
        };

        setTaskRuntime(runtime);
        refreshRelatedTasks();
        const subscription = runtime.taskQueueService
          .observeTaskUpdates()
          .subscribe((event) => {
            if (
              doesTaskBelongToImageGenerationAnchor(
                taskAnchorRef.current,
                event.task
              )
            ) {
              refreshRelatedTasks();
            }
          });
        unsubscribe = () => subscription.unsubscribe();
      })
      .catch((error: unknown) => {
        if (!disposed) {
          console.error(
            '[ImageGenerationAnchor] Failed to load task state runtime:',
            error
          );
        }
      });

    return () => {
      disposed = true;
      unsubscribe?.();
    };
  }, [providedTask, taskScopeKey]);

  const resolvedTask = useMemo(() => {
    if (providedTask) {
      return providedTask;
    }

    return selectPrimaryImageGenerationAnchorTask(anchor, relatedTasks);
  }, [anchor, providedTask, relatedTasks]);

  const { displayProgress } = useImageTaskProgress({
    taskType: resolvedTask?.type,
    fallbackProgress: resolvedTask?.progress ?? anchor.progress,
  });

  const derivedPostProcessingStatus = useMemo(() => {
    if (relatedTasks.length === 0 || !taskRuntime) {
      return options.postProcessingStatus;
    }

    const postProcessingResults = relatedTasks
      .map((relatedTask) =>
        taskRuntime.workflowCompletionService.getPostProcessingStatus(
          relatedTask.id
        )
      )
      .filter((result): result is NonNullable<typeof result> =>
        Boolean(result)
      );
    const hasFailure = postProcessingResults.some(
      (result) => result.status === 'failed'
    );
    const hasNonFailedTask = relatedTasks.some((relatedTask) => {
      const postProcessing =
        taskRuntime.workflowCompletionService.getPostProcessingStatus(
          relatedTask.id
        );

      return (
        relatedTask.status !== TaskStatus.FAILED &&
        postProcessing?.status !== 'failed'
      );
    });

    if (hasFailure && !hasNonFailedTask) {
      return 'failed' as const;
    }

    if (
      postProcessingResults.some((result) => result.status === 'processing')
    ) {
      return 'processing' as const;
    }

    const allInserted =
      hasResolvedImageGenerationBatchCount(anchor, relatedTasks) &&
      relatedTasks.every(
        (relatedTask) =>
          Boolean(relatedTask.insertedToCanvas) ||
          taskRuntime.workflowCompletionService.getPostProcessingStatus(
            relatedTask.id
          )?.status === 'completed'
      );

    if (allInserted) {
      return 'completed' as const;
    }

    return options.postProcessingStatus;
  }, [anchor, options.postProcessingStatus, relatedTasks, taskRuntime]);

  const derivedHasInserted = useMemo(() => {
    if (relatedTasks.length === 0 || !taskRuntime) {
      return options.hasInserted;
    }

    return (
      hasResolvedImageGenerationBatchCount(anchor, relatedTasks) &&
      relatedTasks.every(
        (relatedTask) =>
          Boolean(relatedTask.insertedToCanvas) ||
          taskRuntime.workflowCompletionService.getPostProcessingStatus(
            relatedTask.id
          )?.status === 'completed'
      )
    );
  }, [anchor, options.hasInserted, relatedTasks, taskRuntime]);

  return useMemo(
    () =>
      getImageGenerationAnchorControllerResult({
        ...options,
        task: resolvedTask ?? providedTask,
        tasks: relatedTasks,
        postProcessingStatus: derivedPostProcessingStatus,
        hasInserted: derivedHasInserted,
        taskDisplayProgress: displayProgress,
      }),
    [
      derivedHasInserted,
      derivedPostProcessingStatus,
      displayProgress,
      options,
      providedTask,
      relatedTasks,
      resolvedTask,
    ]
  );
}
