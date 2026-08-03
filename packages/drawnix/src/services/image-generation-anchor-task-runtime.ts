import { createRetriableModuleLoader } from '../utils/retriable-module-loader';

export interface ImageGenerationAnchorTaskRuntime {
  taskQueueService: typeof import('./task-queue')['taskQueueService'];
  workflowCompletionService: typeof import('./workflow-completion-service')['workflowCompletionService'];
}

export const loadImageGenerationAnchorTaskRuntime =
  createRetriableModuleLoader<ImageGenerationAnchorTaskRuntime>(async () => {
    const [taskQueue, workflowCompletion] = await Promise.all([
      import('./task-queue'),
      import('./workflow-completion-service'),
    ]);

    return {
      taskQueueService: taskQueue.taskQueueService,
      workflowCompletionService:
        workflowCompletion.workflowCompletionService,
    };
  });
