import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ImageGenerationAnchorTaskRuntime } from '../../services/image-generation-anchor-task-runtime';
import type { PlaitImageGenerationAnchor } from '../../types/image-generation-anchor.types';
import {
  TaskStatus,
  TaskType,
  type Task,
} from '../../types/task.types';
import { useImageGenerationAnchorController } from '../useImageGenerationAnchorController';

const runtimeLoader = vi.hoisted(() => ({
  load: vi.fn(),
}));

vi.mock('../../services/image-generation-anchor-task-runtime', () => ({
  loadImageGenerationAnchorTaskRuntime: runtimeLoader.load,
}));

interface Deferred<T> {
  promise: Promise<T>;
  resolve: (value: T) => void;
}

function createDeferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });

  return { promise, resolve };
}

function createAnchor(
  overrides: Partial<PlaitImageGenerationAnchor> = {}
): PlaitImageGenerationAnchor {
  return {
    id: 'anchor-1',
    type: 'generation-anchor',
    points: [
      [10, 20],
      [330, 200],
    ],
    angle: 0,
    anchorType: 'ratio',
    phase: 'submitted',
    title: '图片生成',
    subtitle: '已提交，等待执行',
    progress: null,
    transitionMode: 'hold',
    createdAt: 1,
    workflowId: 'workflow-1',
    taskIds: ['task-1'],
    primaryTaskId: 'task-1',
    requestedCount: 1,
    zoom: 1,
    children: [],
    ...overrides,
  };
}

function createTask(overrides: Partial<Task> = {}): Task {
  return {
    id: 'task-1',
    type: TaskType.IMAGE,
    status: TaskStatus.PENDING,
    params: {
      prompt: '生成图片',
      workflowId: 'workflow-1',
    },
    createdAt: 1,
    updatedAt: 1,
    insertedToCanvas: false,
    ...overrides,
  };
}

function createTaskRuntime(taskState: { tasks: Task[] }) {
  const listeners = new Set<(event: { task: Task }) => void>();
  const unsubscribe = vi.fn<(listener: (event: { task: Task }) => void) => void>(
    (listener) => {
      listeners.delete(listener);
    }
  );
  const subscribe = vi.fn((listener: (event: { task: Task }) => void) => {
    listeners.add(listener);
    return {
      unsubscribe: () => unsubscribe(listener),
    };
  });
  const runtime = {
    taskQueueService: {
      getAllTasks: () => taskState.tasks,
      observeTaskUpdates: () => ({ subscribe }),
    },
    workflowCompletionService: {
      getPostProcessingStatus: () => undefined,
    },
  } as unknown as ImageGenerationAnchorTaskRuntime;

  return {
    runtime,
    subscribe,
    unsubscribe,
    emit(task: Task) {
      listeners.forEach((listener) => listener({ task }));
    },
  };
}

afterEach(cleanup);

describe('useImageGenerationAnchorController task runtime boundary', () => {
  beforeEach(() => {
    runtimeLoader.load.mockReset();
  });

  it('does not load TaskQueue when a task instance is provided', () => {
    const task = createTask();
    const { result } = renderHook(() =>
      useImageGenerationAnchorController({
        anchor: createAnchor(),
        task,
      })
    );

    expect(runtimeLoader.load).not.toHaveBeenCalled();
    expect(result.current.phase).toBe('submitted');
  });

  it('loads once, subscribes after resolution, and reflects relevant task updates', async () => {
    const taskState = {
      tasks: [createTask({ status: TaskStatus.PROCESSING })],
    };
    const taskRuntime = createTaskRuntime(taskState);
    runtimeLoader.load.mockResolvedValue(taskRuntime.runtime);

    const { result } = renderHook(() =>
      useImageGenerationAnchorController({ anchor: createAnchor() })
    );

    await waitFor(() => {
      expect(taskRuntime.subscribe).toHaveBeenCalledTimes(1);
      expect(result.current.phase).toBe('generating');
    });
    expect(runtimeLoader.load).toHaveBeenCalledTimes(1);

    const failedTask = createTask({
      status: TaskStatus.FAILED,
      updatedAt: 2,
      error: {
        code: 'PROVIDER_FAILURE',
        message: '供应商拒绝请求',
      },
    });
    taskState.tasks = [failedTask];

    act(() => {
      taskRuntime.emit(failedTask);
    });

    expect(result.current.phase).toBe('failed');
  });

  it('does not subscribe or update after unmount while the runtime is loading', async () => {
    const deferred = createDeferred<ImageGenerationAnchorTaskRuntime>();
    const taskState = { tasks: [createTask()] };
    const taskRuntime = createTaskRuntime(taskState);
    runtimeLoader.load.mockReturnValue(deferred.promise);

    const view = renderHook(() =>
      useImageGenerationAnchorController({ anchor: createAnchor() })
    );
    expect(runtimeLoader.load).toHaveBeenCalledTimes(1);

    view.unmount();
    await act(async () => {
      deferred.resolve(taskRuntime.runtime);
      await deferred.promise;
    });

    expect(taskRuntime.subscribe).not.toHaveBeenCalled();
  });

  it('unsubscribes the active task observer on unmount', async () => {
    const taskState = { tasks: [createTask()] };
    const taskRuntime = createTaskRuntime(taskState);
    runtimeLoader.load.mockResolvedValue(taskRuntime.runtime);

    const view = renderHook(() =>
      useImageGenerationAnchorController({ anchor: createAnchor() })
    );
    await waitFor(() => {
      expect(taskRuntime.subscribe).toHaveBeenCalledTimes(1);
    });

    view.unmount();

    expect(taskRuntime.unsubscribe).toHaveBeenCalledTimes(1);
  });
});
