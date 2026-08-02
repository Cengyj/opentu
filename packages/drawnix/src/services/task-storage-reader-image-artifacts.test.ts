/**
 * @vitest-environment node
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import 'fake-indexeddb/auto';
import { TaskStatus, TaskType } from '../types/task.types';
import type { SWTask } from './media-executor/task-storage-writer';

describe('TaskStorageReader canonical image artifact projection', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('repairs conflicting legacy URL projections on every image read path', async () => {
    const { taskStorageWriter } = await import(
      './media-executor/task-storage-writer'
    );
    const { taskStorageReader } = await import('./task-storage-reader');
    const writerInternals = taskStorageWriter as unknown as {
      getDB(): Promise<IDBDatabase>;
    };
    const taskId = 'reader-canonical-artifact-projection';
    const rawTask: SWTask = {
      id: taskId,
      type: 'image',
      status: 'completed',
      params: { prompt: 'Canonical reader projection' },
      createdAt: 10,
      updatedAt: 20,
      completedAt: 20,
      progress: 100,
      result: {
        url: '/__aitu_cache__/image/stale-primary.png',
        urls: ['/__aitu_cache__/image/stale-primary.png'],
        imageArtifacts: [
          {
            url: '/__aitu_cache__/image/canonical-first.webp',
            source: 'url',
            mimeType: 'image/webp',
            format: 'webp',
          },
          {
            url: '/__aitu_cache__/image/canonical-second.jpg',
            source: 'url',
            mimeType: 'image/jpeg',
            format: 'jpg',
          },
        ],
        format: 'png',
        size: 0,
      },
    };
    const database = await writerInternals.getDB();
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction('tasks', 'readwrite');
      transaction.objectStore('tasks').put(rawTask);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error);
    });
    taskStorageReader.invalidateCache();

    const fullTasks = await taskStorageReader.getAllTasks({
      type: TaskType.IMAGE,
      includeArchived: true,
    });
    const assetTasks = await taskStorageReader.getAssetTasks({
      includeArchived: true,
    });
    const historyPage = await taskStorageReader.getPromptHistoryTaskSummaries({
      types: [TaskType.IMAGE],
      statuses: [TaskStatus.COMPLETED],
      includeArchived: true,
    });
    const expectedUrls = [
      '/__aitu_cache__/image/canonical-first.webp',
      '/__aitu_cache__/image/canonical-second.jpg',
    ];

    for (const result of [
      fullTasks.find((task) => task.id === taskId)?.result,
      assetTasks.find((task) => task.id === taskId)?.result,
      historyPage.items.find((task) => task.id === taskId)?.result,
    ]) {
      expect(result).toMatchObject({
        url: expectedUrls[0],
        urls: expectedUrls,
        imageArtifacts: [
          expect.objectContaining({ url: expectedUrls[0] }),
          expect.objectContaining({ url: expectedUrls[1] }),
        ],
      });
    }

    await expect(
      taskStorageReader.findImageTaskIdByResultUrl(expectedUrls[1])
    ).resolves.toBe(taskId);
    await expect(
      taskStorageReader.findImageTaskIdByResultUrl(
        '/__aitu_cache__/image/stale-primary.png'
      )
    ).resolves.toBeNull();
  });
});
