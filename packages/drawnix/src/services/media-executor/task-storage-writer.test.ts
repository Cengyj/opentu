/**
 * @vitest-environment node
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import 'fake-indexeddb/auto';
import type { SWTask } from './task-storage-writer';

function imageTask(
  id: string,
  status: SWTask['status'],
  updatedAt: number
): SWTask {
  return {
    id,
    type: 'image',
    status,
    params: { prompt: 'Task storage regression fixture' },
    createdAt: 1,
    updatedAt,
    ...(status === 'completed' && {
      completedAt: updatedAt,
      progress: 100,
      result: {
        url: '/__aitu_cache__/image/content-terminal.png',
        format: 'png',
        size: 0,
      },
    }),
  };
}

describe('TaskStorageWriter persistence guards', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('rejects updateStatus when the task record has not been persisted', async () => {
    const { taskStorageWriter } = await import('./task-storage-writer');

    await expect(
      taskStorageWriter.updateStatus(
        'missing-before-initial-persist',
        'processing'
      )
    ).rejects.toMatchObject({
      name: 'TaskStorageTaskNotFoundError',
      code: 'TASK_NOT_FOUND',
    });
  });

  it('rejects completeTask when the task record has not been persisted', async () => {
    const { taskStorageWriter } = await import('./task-storage-writer');

    await expect(
      taskStorageWriter.completeTask('missing-before-completion', {
        url: '/__aitu_cache__/image/content-test.png',
        format: 'png',
        size: 1,
      })
    ).rejects.toMatchObject({
      name: 'TaskStorageTaskNotFoundError',
      code: 'TASK_NOT_FOUND',
    });
  });

  it('preserves completion when it arrives before the initial task save finishes', async () => {
    const { taskStorageWriter } = await import('./task-storage-writer');
    const writerInternals = taskStorageWriter as any;
    const database = await writerInternals.getDB();
    let releaseInitialSave!: () => void;
    let firstDatabaseAccess = true;
    const initialSaveBlocked = new Promise<void>((resolve) => {
      releaseInitialSave = resolve;
    });
    let notifyInitialSaveBlocked!: () => void;
    const initialSaveReachedDatabase = new Promise<void>((resolve) => {
      notifyInitialSaveBlocked = resolve;
    });

    vi.spyOn(writerInternals, 'getDB').mockImplementation(async () => {
      if (firstDatabaseAccess) {
        firstDatabaseAccess = false;
        notifyInitialSaveBlocked();
        await initialSaveBlocked;
      }
      return database;
    });

    const taskId = 'delayed-initial-save-fast-base64-completion';
    const initialSave = taskStorageWriter.saveTask({
      id: taskId,
      type: 'image',
      status: 'processing',
      params: { prompt: 'Fast base64 response' },
      createdAt: 1,
      updatedAt: 1,
      startedAt: 1,
    });

    await initialSaveReachedDatabase;

    const completion = taskStorageWriter.completeTask(taskId, {
      url: '/__aitu_cache__/image/content-base64-race.png',
      format: 'png',
      size: 0,
    });

    releaseInitialSave();
    await Promise.all([initialSave, completion]);

    await expect(taskStorageWriter.getTask(taskId)).resolves.toMatchObject({
      status: 'completed',
      progress: 100,
      result: {
        url: '/__aitu_cache__/image/content-base64-race.png',
        format: 'png',
        size: 0,
      },
    });
  });

  it('does not reopen a completed task when a late processing status arrives', async () => {
    const { taskStorageWriter } = await import('./task-storage-writer');
    const taskId = 'completed-task-late-processing-status';
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    await taskStorageWriter.saveTask(imageTask(taskId, 'processing', 1));
    await taskStorageWriter.completeTask(taskId, {
      url: '/__aitu_cache__/image/content-terminal.png',
      format: 'png',
      size: 0,
    });
    await taskStorageWriter.updateStatus(taskId, 'processing');

    await expect(taskStorageWriter.getTask(taskId)).resolves.toMatchObject({
      status: 'completed',
      progress: 100,
      result: {
        url: '/__aitu_cache__/image/content-terminal.png',
      },
    });
  });

  it('does not let an ordinary saveTask overwrite a terminal task', async () => {
    const { taskStorageWriter } = await import('./task-storage-writer');
    const taskId = 'completed-task-ordinary-save';

    await taskStorageWriter.saveTask(imageTask(taskId, 'completed', 1));
    await expect(
      taskStorageWriter.saveTask(imageTask(taskId, 'processing', 2))
    ).resolves.toBe(false);

    await expect(taskStorageWriter.getTask(taskId)).resolves.toMatchObject({
      status: 'completed',
      result: {
        url: '/__aitu_cache__/image/content-terminal.png',
      },
    });
  });

  it('allows an explicit retry save to reopen a terminal task', async () => {
    const { taskStorageWriter } = await import('./task-storage-writer');
    const taskId = 'completed-task-explicit-retry';

    await taskStorageWriter.saveTask(imageTask(taskId, 'completed', 100));
    await expect(
      taskStorageWriter.saveTask(imageTask(taskId, 'processing', 2), {
        allowTerminalReopen: true,
      })
    ).resolves.toBe(true);

    await expect(taskStorageWriter.getTask(taskId)).resolves.toMatchObject({
      status: 'processing',
    });
  });
});
