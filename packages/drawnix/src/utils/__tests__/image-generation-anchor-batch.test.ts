import { describe, expect, it } from 'vitest';
import { TaskStatus, TaskType, type Task } from '../../types/task.types';
import {
  getCompletedImageTaskResults,
  getTaskResultArtifactUrls,
  getTaskResultImageArtifacts,
} from '../image-generation-anchor-batch';

function createTask(overrides: Partial<Task> = {}): Task {
  return {
    id: 'image-task-1',
    type: TaskType.IMAGE,
    status: TaskStatus.COMPLETED,
    params: { prompt: 'multi image' },
    createdAt: 1,
    updatedAt: 1,
    completedAt: 2,
    result: {
      url: '/cache/image-1.png',
      format: 'png',
      size: 0,
    },
    ...overrides,
  };
}

describe('image generation task result projection', () => {
  it('preserves provider artifact order and removes duplicate URLs once', () => {
    const task = createTask({
      result: {
        url: '/cache/image-1.png',
        urls: [
          '/cache/image-1.png',
          '/cache/image-2.png',
          '/cache/image-1.png',
        ],
        format: 'png',
        size: 0,
      },
    });

    expect(getTaskResultArtifactUrls(task)).toEqual([
      '/cache/image-1.png',
      '/cache/image-2.png',
    ]);
  });

  it('does not expose an auxiliary preview as a generated artifact', () => {
    const task = createTask({
      result: {
        url: '/cache/image-1.png',
        previewImageUrl: '/cache/preview.png',
        format: 'png',
        size: 0,
      },
    });

    expect(getTaskResultArtifactUrls(task)).toEqual([
      '/cache/image-1.png',
    ]);
  });

  it('prefers persisted canonical artifacts and preserves per-image metadata', () => {
    const task = createTask({
      result: {
        url: '/legacy/ignored.png',
        urls: ['/legacy/ignored.png'],
        imageArtifacts: [
          {
            url: '/cache/first.webp',
            source: 'url',
            mimeType: 'image/webp',
            format: 'webp',
            width: 1200,
            height: 800,
          },
          {
            url: '/cache/second.jpg',
            source: 'url',
            mimeType: 'image/jpeg',
            format: 'jpg',
            width: 640,
            height: 640,
          },
        ],
        format: 'png',
        size: 0,
      },
    });

    expect(getTaskResultImageArtifacts(task)).toEqual(
      task.result?.imageArtifacts
    );
    expect(getTaskResultArtifactUrls(task)).toEqual([
      '/cache/first.webp',
      '/cache/second.jpg',
    ]);
  });

  it('keeps task order and artifact order without mixing non-image tasks', () => {
    const first = createTask({
      id: 'image-task-1',
      result: {
        url: '/cache/first-1.png',
        urls: ['/cache/first-1.png', '/cache/first-2.png'],
        format: 'png',
        size: 0,
      },
    });
    const ignoredPending = createTask({
      id: 'image-task-pending',
      status: TaskStatus.PENDING,
    });
    const ignoredVideo = createTask({
      id: 'video-task',
      type: TaskType.VIDEO,
      result: {
        url: '/cache/video.mp4',
        format: 'mp4',
        size: 0,
      },
    });
    const second = createTask({
      id: 'image-task-2',
      result: {
        url: '/cache/second.png',
        format: 'png',
        size: 0,
      },
    });

    const results = getCompletedImageTaskResults([
      first,
      ignoredPending,
      ignoredVideo,
      second,
    ]);

    expect(results.map(({ task, url }) => [task.id, url])).toEqual([
      ['image-task-1', '/cache/first-1.png'],
      ['image-task-1', '/cache/first-2.png'],
      ['image-task-2', '/cache/second.png'],
    ]);
    expect(
      results.map(({ resultIndex, resultCount }) => [resultIndex, resultCount])
    ).toEqual([
      [0, 2],
      [1, 2],
      [0, 1],
    ]);
  });
});
