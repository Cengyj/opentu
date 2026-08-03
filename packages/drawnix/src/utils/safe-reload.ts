/**
 * Safely reload the page without making the lightweight runtime entry depend
 * on the task queue and generation graph at module evaluation time.
 */
export async function safeReload(): Promise<boolean> {
  let hasActiveTasks: boolean;

  try {
    const { hasActiveLLMTasks } = await import('./active-tasks');
    hasActiveTasks = await hasActiveLLMTasks();
  } catch {
    const confirmed = window.confirm(
      '无法确认当前是否有正在进行的 AI 生成任务。继续刷新可能会中断任务，确定要刷新吗？'
    );
    if (!confirmed) return false;

    window.location.reload();
    return true;
  }

  if (hasActiveTasks) {
    const confirmed = window.confirm(
      '当前有正在进行的 AI 生成任务，刷新页面会中断这些任务。确定要刷新吗？'
    );
    if (!confirmed) return false;
  }

  window.location.reload();
  return true;
}
