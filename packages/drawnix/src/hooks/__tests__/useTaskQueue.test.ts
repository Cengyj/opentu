import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { TaskType } from '../../types/task.types';
import { useTaskActions } from '../useTaskQueue';

const mocks = vi.hoisted(() => ({
  createTask: vi.fn(),
  getAllTasks: vi.fn(() => []),
}));

vi.mock('../../services/task-queue', () => ({
  taskQueueService: {
    createTask: mocks.createTask,
    getAllTasks: mocks.getAllTasks,
  },
}));

vi.mock('../../services/task-storage-reader', () => ({
  taskStorageReader: {},
}));

describe('useTaskActions', () => {
  beforeEach(() => {
    mocks.createTask.mockReset();
    mocks.getAllTasks.mockReset();
    mocks.getAllTasks.mockReturnValue([]);
  });

  it('returns null when the task service rejects invalid generation parameters', () => {
    mocks.createTask.mockImplementation(() => {
      throw new Error(
        'Invalid parameters: Width must not exceed 4096 pixels'
      );
    });

    const { result } = renderHook(() => useTaskActions());
    let createdTask: ReturnType<typeof result.current.createTask> = null;

    act(() => {
      createdTask = result.current.createTask(
        {
          prompt: 'Create an image',
          width: 5000,
        },
        TaskType.IMAGE
      );
    });

    expect(createdTask).toBeNull();
    expect(mocks.createTask).toHaveBeenCalledWith(
      {
        prompt: 'Create an image',
        width: 5000,
      },
      TaskType.IMAGE
    );
  });
});
