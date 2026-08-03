/**
 * 活跃 LLM 任务检测工具。
 *
 * 该模块会加载任务队列，因此启动时轻量入口不得静态引用它。
 */

import { taskQueueService } from '../services/task-queue';
import { TaskStatus } from '../types/task.types';

type WorkflowSubmissionServiceLike = {
  getRunningWorkflows: () => Array<unknown>;
};

let cachedWorkflowSubmissionService: WorkflowSubmissionServiceLike | null =
  null;

/**
 * 检查是否有活跃的 LLM 任务（正在执行的任务或工作流）
 */
export async function hasActiveLLMTasks(): Promise<boolean> {
  const tasks = taskQueueService.getAllTasks();
  const hasActiveTasks = tasks.some(
    (t) => t.status === TaskStatus.PENDING || t.status === TaskStatus.PROCESSING
  );
  if (hasActiveTasks) return true;

  const { workflowSubmissionService } = await import(
    '../services/workflow-submission-service'
  );
  cachedWorkflowSubmissionService = workflowSubmissionService;
  const runningWorkflows = workflowSubmissionService.getRunningWorkflows();
  return runningWorkflows.length > 0;
}

export function hasActiveLLMTasksSync(): boolean {
  const tasks = taskQueueService.getAllTasks();
  const hasActiveTasks = tasks.some(
    (t) => t.status === TaskStatus.PENDING || t.status === TaskStatus.PROCESSING
  );
  if (hasActiveTasks) return true;

  return (
    (cachedWorkflowSubmissionService?.getRunningWorkflows().length || 0) > 0
  );
}
