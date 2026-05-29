import { describe, expect, it } from 'vitest';
import {
  TaskStatus,
  TaskType,
  type Task,
} from '../../types/task.types';
import { IMAGE_GENERATION_TIMEOUT_MS } from '../../constants/TASK_CONSTANTS';
import {
  getTaskTimeout,
  isResumableAsyncImageTask,
  isTaskTimeout,
} from '../task-utils';

function createImageTask(overrides: Partial<Task> = {}): Task {
  const now = Date.now();
  return {
    id: 'task-1',
    type: TaskType.IMAGE,
    status: TaskStatus.PROCESSING,
    params: {
      prompt: 'draw a cat',
      model: 'custom-dynamic-image-model',
    },
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

describe('task-utils', () => {
  describe('getTaskTimeout', () => {
    it('uses a 35 minute timeout for image tasks', () => {
      expect(getTaskTimeout(TaskType.IMAGE)).toBe(35 * 60 * 1000);
      expect(getTaskTimeout(TaskType.IMAGE)).toBe(IMAGE_GENERATION_TIMEOUT_MS);
    });
  });

  describe('isTaskTimeout', () => {
    it('does not time out image tasks before 35 minutes', () => {
      const task = createImageTask({
        startedAt: Date.now() - (35 * 60 * 1000 - 1000),
      });

      expect(isTaskTimeout(task)).toBe(false);
    });

    it('times out image tasks after 35 minutes', () => {
      const task = createImageTask({
        startedAt: Date.now() - (35 * 60 * 1000 + 1000),
      });

      expect(isTaskTimeout(task)).toBe(true);
    });
  });

  describe('isResumableAsyncImageTask', () => {
    it('uses persisted async image binding as resumable source of truth', () => {
      const task = createImageTask({
        remoteId: 'remote-task-1',
        invocationRoute: {
          operation: 'image',
          modelId: 'custom-dynamic-image-model',
          binding: {
            protocol: 'openai.async.media',
            requestSchema: 'openai.async.image.form',
            pollPathTemplate: '/videos/{taskId}',
          },
        },
      });

      expect(isResumableAsyncImageTask(task)).toBe(true);
    });

    it('does not resume ordinary image tasks without a remote task id', () => {
      const task = createImageTask({
        invocationRoute: {
          operation: 'image',
          binding: {
            protocol: 'openai.async.media',
            requestSchema: 'openai.async.image.form',
          },
        },
      });

      expect(isResumableAsyncImageTask(task)).toBe(false);
    });

    it('does not treat sync image bindings as resumable async work', () => {
      const task = createImageTask({
        remoteId: 'remote-task-1',
        invocationRoute: {
          operation: 'image',
          binding: {
            protocol: 'openai.images.generations',
            requestSchema: 'openai.image.basic-json',
          },
        },
      });

      expect(isResumableAsyncImageTask(task)).toBe(false);
    });
  });
});
