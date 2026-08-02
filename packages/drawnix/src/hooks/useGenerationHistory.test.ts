import { describe, expect, it } from 'vitest';
import { TaskStatus, TaskType, type Task } from '../types/task.types';
import { buildImageGenerationHistory } from './generation-history-mapper';

function createImageTask(overrides: Partial<Task> = {}): Task {
  return {
    id: 'image-task-1',
    type: TaskType.IMAGE,
    status: TaskStatus.COMPLETED,
    params: {
      prompt: 'history prompt',
      uploadedImages: [{ url: '/reference.png', name: 'reference' }],
    },
    createdAt: 1,
    updatedAt: 1,
    completedAt: 2,
    result: {
      url: '/cache/image-1.png',
      format: 'png',
      size: 0,
      width: 640,
      height: 480,
    },
    ...overrides,
  };
}

describe('buildImageGenerationHistory', () => {
  it('creates one ordered history entry for every unique task artifact', () => {
    const olderMultiResult = createImageTask({
      result: {
        url: '/cache/image-1.png',
        urls: [
          '/cache/image-1.png',
          '/cache/image-2.png',
          '/cache/image-1.png',
        ],
        format: 'png',
        size: 0,
        width: 640,
        height: 480,
      },
    });
    const newerSingleResult = createImageTask({
      id: 'image-task-2',
      createdAt: 3,
      completedAt: 4,
      result: {
        url: '/cache/newest.png',
        format: 'png',
        size: 0,
      },
    });

    const history = buildImageGenerationHistory([
      olderMultiResult,
      newerSingleResult,
    ]);

    expect(history.map(({ id, imageUrl }) => [id, imageUrl])).toEqual([
      ['image-task-2', '/cache/newest.png'],
      ['image-task-1', '/cache/image-1.png'],
      ['image-task-1::image:1', '/cache/image-2.png'],
    ]);
    expect(history[1]).toMatchObject({
      prompt: 'history prompt',
      width: 640,
      height: 480,
      uploadedImages: [{ url: '/reference.png', name: 'reference' }],
    });
  });

  it('preserves the existing single-image history identity', () => {
    expect(buildImageGenerationHistory([createImageTask()])).toMatchObject([
      {
        id: 'image-task-1',
        imageUrl: '/cache/image-1.png',
      },
    ]);
  });
});
