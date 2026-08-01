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

interface ControlledOpenRequest {
  request: IDBOpenDBRequest;
  database: IDBDatabase;
  close: ReturnType<typeof vi.fn>;
}

function createControlledOpenRequest(): ControlledOpenRequest {
  const close = vi.fn();
  const database = {
    close,
    onclose: null,
    onversionchange: null,
  } as unknown as IDBDatabase;
  const request = {
    error: new Error('late open failure'),
    result: database,
    onblocked: null,
    onerror: null,
    onsuccess: null,
    onupgradeneeded: null,
  } as unknown as IDBOpenDBRequest;

  return { request, database, close };
}

function createHangingTransactionDatabase(
  method: 'get' | 'put' | 'openCursor' | 'delete'
) {
  const request = {
    error: null,
    onerror: null,
    onsuccess: null,
  } as unknown as IDBRequest;
  const abort = vi.fn();
  const transaction = {
    abort,
    error: null,
    objectStore: () => ({
      [method]: () => request,
    }),
    onabort: null,
    oncomplete: null,
    onerror: null,
  } as unknown as IDBTransaction;
  const database = {
    transaction: vi.fn(() => transaction),
  } as unknown as IDBDatabase;

  return { abort, database };
}

describe('TaskStorageWriter persistence guards', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('bounds a task read when database acquisition never settles', async () => {
    vi.useFakeTimers();
    const { TASK_STORAGE_OPERATION_TIMEOUT_MS, taskStorageWriter } =
      await import('./task-storage-writer');
    const writerInternals = taskStorageWriter as unknown as {
      getDB(): Promise<IDBDatabase>;
    };
    vi.spyOn(writerInternals, 'getDB').mockReturnValue(
      new Promise<IDBDatabase>(() => undefined)
    );

    const read = taskStorageWriter.getTask('never-open-read');
    const rejection = expect(read).rejects.toMatchObject({
      name: 'TaskStorageOperationTimeoutError',
      code: 'TASK_STORAGE_TIMEOUT',
    });

    await vi.advanceTimersByTimeAsync(TASK_STORAGE_OPERATION_TIMEOUT_MS);
    await rejection;
  });

  it('bounds a task save when database acquisition never settles', async () => {
    vi.useFakeTimers();
    const { TASK_STORAGE_OPERATION_TIMEOUT_MS, taskStorageWriter } =
      await import('./task-storage-writer');
    const writerInternals = taskStorageWriter as unknown as {
      getDB(): Promise<IDBDatabase>;
    };
    vi.spyOn(writerInternals, 'getDB').mockReturnValue(
      new Promise<IDBDatabase>(() => undefined)
    );

    const save = taskStorageWriter.saveTask(
      imageTask('never-open-save', 'processing', 1)
    );
    const rejection = expect(save).rejects.toMatchObject({
      name: 'TaskStorageOperationTimeoutError',
      code: 'TASK_STORAGE_TIMEOUT',
    });

    // saveTask enters its per-task write lane on a promise microtask.
    await Promise.resolve();
    await vi.advanceTimersByTimeAsync(TASK_STORAGE_OPERATION_TIMEOUT_MS);
    await rejection;
  });

  it.each(['read', 'save'] as const)(
    'aborts a hanging task %s transaction at the storage deadline',
    async (operation) => {
      vi.useFakeTimers();
      const { TASK_STORAGE_OPERATION_TIMEOUT_MS, taskStorageWriter } =
        await import('./task-storage-writer');
      const { abort, database } = createHangingTransactionDatabase('get');
      const writerInternals = taskStorageWriter as unknown as {
        getDB(): Promise<IDBDatabase>;
        getTaskRecord(taskId: string): Promise<SWTask | null>;
      };
      vi.spyOn(writerInternals, 'getDB').mockResolvedValue(database);

      const pendingOperation =
        operation === 'read'
          ? writerInternals.getTaskRecord('hanging-read-transaction')
          : taskStorageWriter.saveTask(
              imageTask('hanging-save-transaction', 'processing', 1)
            );
      const rejection = expect(pendingOperation).rejects.toMatchObject({
        name: 'TaskStorageOperationTimeoutError',
        code: 'TASK_STORAGE_TIMEOUT',
      });

      await Promise.resolve();
      await vi.advanceTimersByTimeAsync(TASK_STORAGE_OPERATION_TIMEOUT_MS);
      await rejection;
      expect(abort).toHaveBeenCalledOnce();
    }
  );

  it.each(['repair', 'delete'] as const)(
    'bounds a hanging task %s transaction and aborts it',
    async (operation) => {
      vi.useFakeTimers();
      const { TASK_STORAGE_OPERATION_TIMEOUT_MS, taskStorageWriter } =
        await import('./task-storage-writer');
      const { abort, database } = createHangingTransactionDatabase(
        operation === 'repair' ? 'openCursor' : 'delete'
      );
      const writerInternals = taskStorageWriter as unknown as {
        getDB(): Promise<IDBDatabase>;
      };
      vi.spyOn(writerInternals, 'getDB').mockResolvedValue(database);

      const pendingOperation =
        operation === 'repair'
          ? taskStorageWriter.repairTerminalExecutionPhases()
          : taskStorageWriter.deleteTask('hanging-delete-transaction');
      const rejection = expect(pendingOperation).rejects.toMatchObject({
        name: 'TaskStorageOperationTimeoutError',
        code: 'TASK_STORAGE_TIMEOUT',
      });

      // deleteTask enters its per-task write lane on a promise microtask.
      await Promise.resolve();
      await vi.advanceTimersByTimeAsync(TASK_STORAGE_OPERATION_TIMEOUT_MS);
      await rejection;
      expect(abort).toHaveBeenCalledOnce();
    }
  );

  it.each(['success', 'error'] as const)(
    'does not let a late open %s clear or replace the active retry',
    async (lateEvent) => {
      vi.useFakeTimers();
      const controlledRequests: ControlledOpenRequest[] = [];
      const openSpy = vi.spyOn(indexedDB, 'open').mockImplementation(() => {
        const controlledRequest = createControlledOpenRequest();
        controlledRequests.push(controlledRequest);
        return controlledRequest.request;
      });
      const { TASK_STORAGE_OPERATION_TIMEOUT_MS, taskStorageWriter } =
        await import('./task-storage-writer');
      const writerInternals = taskStorageWriter as unknown as {
        getDB(): Promise<IDBDatabase>;
      };

      const firstOpen = writerInternals.getDB();
      const firstRejection = expect(firstOpen).rejects.toMatchObject({
        code: 'TASK_STORAGE_TIMEOUT',
      });
      await vi.advanceTimersByTimeAsync(TASK_STORAGE_OPERATION_TIMEOUT_MS);
      await firstRejection;

      const retryOpen = writerInternals.getDB();
      expect(openSpy).toHaveBeenCalledTimes(2);

      const staleRequest = controlledRequests[0];
      if (lateEvent === 'success') {
        staleRequest.request.onsuccess?.call(
          staleRequest.request,
          new Event('success')
        );
        expect(staleRequest.close).toHaveBeenCalledOnce();
      } else {
        staleRequest.request.onerror?.call(
          staleRequest.request,
          new Event('error')
        );
      }

      const sharedRetryOpen = writerInternals.getDB();
      expect(openSpy).toHaveBeenCalledTimes(2);

      const retryRequest = controlledRequests[1];
      retryRequest.request.onsuccess?.call(
        retryRequest.request,
        new Event('success')
      );
      await expect(Promise.all([retryOpen, sharedRetryOpen])).resolves.toEqual([
        retryRequest.database,
        retryRequest.database,
      ]);
    }
  );

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
    const writerInternals = taskStorageWriter as unknown as {
      getDB(): Promise<IDBDatabase>;
    };
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

    const storedTask = await taskStorageWriter.getTask(taskId);
    expect(storedTask).toMatchObject({
      status: 'completed',
      progress: 100,
      result: {
        url: '/__aitu_cache__/image/content-base64-race.png',
        format: 'png',
        size: 0,
      },
    });
    expect(storedTask?.executionPhase).toBeUndefined();
  });

  it('clears the active execution phase when a task reaches any terminal state', async () => {
    const { taskStorageWriter } = await import('./task-storage-writer');

    await taskStorageWriter.saveTask({
      ...imageTask('terminal-phase-completed', 'processing', 1),
      executionPhase: 'submitting',
    });
    await taskStorageWriter.completeTask('terminal-phase-completed', {
      url: '/__aitu_cache__/image/content-terminal-phase.png',
      format: 'png',
      size: 0,
    });

    await taskStorageWriter.saveTask({
      ...imageTask('terminal-phase-failed', 'processing', 1),
      executionPhase: 'polling',
    });
    await taskStorageWriter.failTask('terminal-phase-failed', {
      code: 'PROVIDER_ERROR',
      message: 'Provider failed',
    });

    await taskStorageWriter.saveTask({
      ...imageTask('terminal-phase-cancelled', 'processing', 1),
      status: 'cancelled',
      executionPhase: 'downloading',
    });

    const completedTask = await taskStorageWriter.getTask(
      'terminal-phase-completed'
    );
    const failedTask = await taskStorageWriter.getTask('terminal-phase-failed');
    const cancelledTask = await taskStorageWriter.getTask(
      'terminal-phase-cancelled'
    );
    expect(completedTask).toMatchObject({
      status: 'completed',
    });
    expect(completedTask?.executionPhase).toBeUndefined();
    expect(completedTask).not.toHaveProperty('executionPhase');
    expect(failedTask).toMatchObject({
      status: 'failed',
    });
    expect(failedTask?.executionPhase).toBeUndefined();
    expect(failedTask).not.toHaveProperty('executionPhase');
    expect(cancelledTask).toMatchObject({
      status: 'cancelled',
    });
    expect(cancelledTask?.executionPhase).toBeUndefined();
    expect(cancelledTask).not.toHaveProperty('executionPhase');
  });

  it('repairs legacy terminal rows that still contain an active execution phase', async () => {
    const { taskStorageWriter } = await import('./task-storage-writer');
    const writerInternals = taskStorageWriter as unknown as {
      getDB(): Promise<IDBDatabase>;
    };
    const staleTask = {
      ...imageTask('legacy-terminal-active-phase', 'completed', 10),
      executionPhase: 'submitting',
    };

    const database = await writerInternals.getDB();
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction('tasks', 'readwrite');
      transaction.objectStore('tasks').put(staleTask);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error);
    });

    await expect(
      taskStorageWriter.repairTerminalExecutionPhases()
    ).resolves.toBe(1);
    const repairedTask = await taskStorageWriter.getTask(
      'legacy-terminal-active-phase'
    );
    expect(repairedTask).toMatchObject({
      status: 'completed',
      updatedAt: 10,
    });
    expect(repairedTask?.executionPhase).toBeUndefined();
    expect(repairedTask).not.toHaveProperty('executionPhase');
  });

  it.each([false, true])(
    'normalizes terminal execution phase during task import (replaceExisting=%s)',
    async (replaceExisting) => {
      const { taskStorageWriter } = await import('./task-storage-writer');
      const taskId = `import-terminal-phase-${replaceExisting}`;
      if (replaceExisting) {
        await taskStorageWriter.saveTask(imageTask(taskId, 'processing', 1));
      }

      await expect(
        taskStorageWriter.importTasks(
          [
            {
              ...imageTask(taskId, 'completed', 2),
              executionPhase: 'submitting',
            },
          ],
          { replaceExisting }
        )
      ).resolves.toMatchObject({ imported: 1, skipped: 0 });

      const importedTask = await taskStorageWriter.getTask(taskId);
      expect(importedTask).toMatchObject({ status: 'completed' });
      expect(importedTask?.executionPhase).toBeUndefined();
      expect(importedTask).not.toHaveProperty('executionPhase');
    }
  );

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

  it('returns the terminal state that actually won a completion race', async () => {
    const { taskStorageWriter } = await import('./task-storage-writer');
    const taskId = 'cancelled-task-late-provider-success';
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    await taskStorageWriter.saveTask(imageTask(taskId, 'processing', 1));
    await taskStorageWriter.saveTask(imageTask(taskId, 'cancelled', 2));

    const winningTask = await taskStorageWriter.completeTask(taskId, {
      url: '/__aitu_cache__/image/content-late-provider-result.png',
      format: 'png',
      size: 0,
    });

    expect(winningTask).toMatchObject({
      id: taskId,
      status: 'cancelled',
    });
    expect(winningTask.result).toBeUndefined();
    await expect(taskStorageWriter.getTask(taskId)).resolves.toMatchObject({
      status: 'cancelled',
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

  it('preserves committed durable flags when a newer terminal snapshot is stale', async () => {
    const firstModule = await import('./task-storage-writer');
    const firstWriter = firstModule.taskStorageWriter;
    const taskId = 'completed-task-durable-flags';
    const initialTask: SWTask = {
      ...imageTask(taskId, 'completed', 1),
      insertedToCanvas: false,
      savedToLibrary: false,
      archived: false,
    };

    // A second module instance models a separate browser context with its own
    // process-local write queue but the same IndexedDB database.
    await firstWriter.saveTask(initialTask);
    vi.resetModules();
    const { taskStorageWriter: secondWriter } = await import(
      './task-storage-writer'
    );
    await Promise.all([
      firstWriter.markInserted(taskId),
      firstWriter.markSaved(taskId),
      firstWriter.archiveTask(taskId),
      secondWriter.saveTask({
        ...initialTask,
        updatedAt: 100,
      }),
    ]);

    await expect(secondWriter.getTask(taskId)).resolves.toMatchObject({
      status: 'completed',
      insertedToCanvas: true,
      savedToLibrary: true,
      archived: true,
    });

    firstWriter.close();
    secondWriter.close();
  });

  it('preserves durable flags through parameter-preserving snapshots', async () => {
    const { taskStorageWriter } = await import('./task-storage-writer');
    const taskId = 'completed-task-preserved-params-and-flags';
    const initialTask: SWTask = {
      ...imageTask(taskId, 'completed', 1),
      params: {
        prompt: 'Preserve reference image and durable flags',
        referenceImages: ['data:image/png;base64,source'],
      },
    };

    await taskStorageWriter.saveTask(initialTask);
    await taskStorageWriter.markInserted(taskId);
    await taskStorageWriter.markSaved(taskId);
    await taskStorageWriter.saveTaskPreservingParams(
      {
        ...initialTask,
        params: {
          prompt: initialTask.params.prompt,
          referenceImages: undefined,
        },
        updatedAt: 100,
      },
      ['referenceImages']
    );

    await expect(taskStorageWriter.getTask(taskId)).resolves.toMatchObject({
      insertedToCanvas: true,
      savedToLibrary: true,
      params: {
        referenceImages: ['data:image/png;base64,source'],
      },
    });
  });

  it('allows an explicit retry save to reopen a terminal task', async () => {
    const { taskStorageWriter } = await import('./task-storage-writer');
    const taskId = 'completed-task-explicit-retry';

    await taskStorageWriter.saveTask({
      ...imageTask(taskId, 'completed', 100),
      insertedToCanvas: true,
      savedToLibrary: true,
    });
    await expect(
      taskStorageWriter.saveTask(
        {
          ...imageTask(taskId, 'processing', 2),
          insertedToCanvas: false,
          savedToLibrary: false,
        },
        {
          allowTerminalReopen: true,
        }
      )
    ).resolves.toBe(true);

    await expect(taskStorageWriter.getTask(taskId)).resolves.toMatchObject({
      status: 'processing',
      insertedToCanvas: false,
      savedToLibrary: false,
    });
  });
});
