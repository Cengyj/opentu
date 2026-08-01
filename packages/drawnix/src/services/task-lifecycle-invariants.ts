const TERMINAL_TASK_STATUS_VALUES = new Set([
  'completed',
  'failed',
  'cancelled',
]);

type TaskLifecycleProjection = {
  status: string;
  executionPhase?: unknown;
};

export function hasTerminalExecutionPhaseField(
  task: TaskLifecycleProjection
): boolean {
  return (
    TERMINAL_TASK_STATUS_VALUES.has(task.status) &&
    Object.prototype.hasOwnProperty.call(task, 'executionPhase')
  );
}

/**
 * executionPhase describes active provider work only. Terminal task snapshots
 * must not retain submitting/polling/downloading because recovery and UI code
 * use that field as evidence that execution is still active.
 */
export function normalizeTerminalTaskExecutionPhase<
  T extends TaskLifecycleProjection
>(task: T): T {
  if (!hasTerminalExecutionPhaseField(task)) {
    return task;
  }

  const normalizedTask = { ...task };
  delete normalizedTask.executionPhase;
  return normalizedTask;
}
