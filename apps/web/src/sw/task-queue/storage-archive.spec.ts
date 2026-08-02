import 'fake-indexeddb/auto';

import { describe, expect, it } from 'vitest';

import { archiveTerminalTaskCandidates } from './storage';

const openDatabase = (name: string): Promise<IDBDatabase> =>
  new Promise((resolve, reject) => {
    const request = indexedDB.open(name, 1);
    request.onupgradeneeded = () => {
      request.result.createObjectStore('tasks', { keyPath: 'id' });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });

const putTask = (db: IDBDatabase, task: object): Promise<void> =>
  new Promise((resolve, reject) => {
    const transaction = db.transaction('tasks', 'readwrite');
    transaction.objectStore('tasks').put(task);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });

const getTask = (
  db: IDBDatabase,
  id: string
): Promise<Record<string, unknown>> =>
  new Promise((resolve, reject) => {
    const transaction = db.transaction('tasks', 'readonly');
    const request = transaction.objectStore('tasks').get(id);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });

describe('Service Worker task archival transaction', () => {
  it('does not archive a stale candidate that has entered a new attempt', async () => {
    const db = await openDatabase('storage-archive-retry-spec');
    await putTask(db, {
      id: 'task-1',
      status: 'processing',
      archived: false,
      attemptId: 'attempt-2',
      updatedAt: 200,
    });

    await expect(
      archiveTerminalTaskCandidates(db, ['task-1'], 300)
    ).resolves.toBe(0);
    await expect(getTask(db, 'task-1')).resolves.toMatchObject({
      status: 'processing',
      archived: false,
      attemptId: 'attempt-2',
      updatedAt: 200,
    });
    db.close();
  });

  it('archives the current terminal record without replacing newer fields', async () => {
    const db = await openDatabase('storage-archive-current-spec');
    await putTask(db, {
      id: 'task-1',
      status: 'completed',
      archived: false,
      result: { url: 'cache://new-result' },
      updatedAt: 200,
    });

    await expect(
      archiveTerminalTaskCandidates(db, ['task-1'], 300)
    ).resolves.toBe(1);
    await expect(getTask(db, 'task-1')).resolves.toMatchObject({
      status: 'completed',
      archived: true,
      result: { url: 'cache://new-result' },
      updatedAt: 300,
    });
    db.close();
  });
});
