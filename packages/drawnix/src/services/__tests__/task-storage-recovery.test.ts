import { describe, expect, it } from 'vitest';
import {
  TaskExecutionPhase,
  TaskStatus,
  TaskType,
  type Task,
} from '../../types/task.types';
import {
  getTaskInterruptionSkipReason,
  type TaskRecoveryRuntime,
} from '../task-storage-recovery';

function createProcessingTask(overrides: Partial<Task> = {}): Task {
  return {
    id: 'task-1',
    type: TaskType.CHAT,
    status: TaskStatus.PROCESSING,
    params: { prompt: 'hello' },
    createdAt: 100,
    updatedAt: 100,
    executionPhase: TaskExecutionPhase.SUBMITTING,
    ...overrides,
  };
}

function createRuntime(
  runtimeTask: Task | undefined,
  currentSession = false
): TaskRecoveryRuntime {
  return {
    getTask: () => runtimeTask,
    isTaskOwnedByCurrentSession: () => currentSession,
  };
}

describe('task storage interruption recovery', () => {
  it('protects a task created by the current page while IndexedDB is loading', () => {
    const storedTask = createProcessingTask();

    expect(
      getTaskInterruptionSkipReason(storedTask, createRuntime(storedTask, true))
    ).toBe('current-session');
  });

  it('protects a newer in-memory state from a stale processing snapshot', () => {
    const storedTask = createProcessingTask();
    const completedRuntimeTask = createProcessingTask({
      status: TaskStatus.COMPLETED,
      updatedAt: 101,
    });

    expect(
      getTaskInterruptionSkipReason(
        storedTask,
        createRuntime(completedRuntimeTask)
      )
    ).toBe('newer-runtime-state');
  });

  it('still treats an unchanged processing task restored from a previous page as interrupted', () => {
    const storedTask = createProcessingTask();

    expect(
      getTaskInterruptionSkipReason(
        storedTask,
        createRuntime({ ...storedTask })
      )
    ).toBeNull();
  });
});
