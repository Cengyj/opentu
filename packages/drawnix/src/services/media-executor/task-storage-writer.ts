/**
 * Task Storage Writer
 *
 * 主线程直接写入 IndexedDB 中的任务数据。
 * 当前任务执行不经过 Service Worker，本模块是正常写入路径。
 */

import { normalizeImageDataUrl } from '@aitu/utils';
import { APP_DB_NAME, APP_DB_STORES } from '../app-database';
import type { TaskInvocationRouteSnapshot } from '../../types/task.types';
import type { ImageArtifact } from '../../types/image-artifact.types';
import { normalizeImageTaskResultArtifactProjection } from '../image-invocation/task-result-artifacts';
import {
  hasTerminalExecutionPhaseField,
  normalizeTerminalTaskExecutionPhase,
} from '../task-lifecycle-invariants';

// 使用主线程专用数据库
const DB_NAME = APP_DB_NAME;
const TASKS_STORE = APP_DB_STORES.TASKS;
export const TASK_STORAGE_OPERATION_TIMEOUT_MS = 10_000;

// 使用与 SW 端一致的字符串字面量类型
type SWTaskType =
  | 'image'
  | 'video'
  | 'audio'
  | 'character'
  | 'inspiration_board'
  | 'chat';
type SWTaskStatus =
  | 'pending'
  | 'processing'
  | 'completed'
  | 'failed'
  | 'cancelled';

const TERMINAL_TASK_STATUSES = new Set<SWTaskStatus>([
  'completed',
  'failed',
  'cancelled',
]);

const MONOTONIC_TASK_FLAGS = [
  'savedToLibrary',
  'insertedToCanvas',
  'archived',
] as const satisfies readonly (keyof SWTask)[];

export interface TaskSaveOptions {
  allowTerminalReopen?: boolean;
}

/**
 * Guards one image-attempt mutation with the `startedAt` value captured when
 * that attempt was submitted. The option is deliberately ignored for other
 * task types so their lifecycle semantics remain unchanged.
 */
export interface ImageTaskAttemptWriteOptions {
  expectedStartedAt?: number;
}

/**
 * SW 端的任务结构（与 SWTask 保持一致）
 * 使用字符串字面量类型以确保与 IndexedDB 存储的数据兼容
 */
export interface SWTask {
  id: string;
  type: SWTaskType;
  status: SWTaskStatus;
  params: {
    prompt: string;
    [key: string]: unknown;
  };
  createdAt: number;
  updatedAt: number;
  startedAt?: number;
  completedAt?: number;
  result?: {
    url: string;
    urls?: string[];
    imageArtifacts?: ImageArtifact[];
    thumbnailUrls?: string[];
    format: string;
    size: number;
    resultKind?: 'image' | 'video' | 'audio' | 'lyrics' | 'character' | 'chat';
    width?: number;
    height?: number;
    duration?: number;
    thumbnailUrl?: string;
    previewImageUrl?: string;
    title?: string;
    lyricsText?: string;
    lyricsTitle?: string;
    lyricsTags?: string[];
    providerTaskId?: string;
    primaryClipId?: string;
    clipIds?: string[];
    clips?: Array<{
      id?: string;
      clipId?: string;
      title?: string;
      status?: string;
      audioUrl: string;
      imageUrl?: string;
      imageLargeUrl?: string;
      duration?: number | null;
      modelName?: string;
      majorModelVersion?: string;
    }>;
    chatResponse?: string;
    analysisData?: unknown;
    toolCalls?: any[];
  };
  error?: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
  progress?: number;
  remoteId?: string;
  invocationRoute?: TaskInvocationRouteSnapshot;
  executionPhase?: string;
  savedToLibrary?: boolean;
  insertedToCanvas?: boolean;
  /** 是否从远程同步（不应被恢复执行） */
  syncedFromRemote?: boolean;
  /** 是否已归档（不参与活跃加载） */
  archived?: boolean;
  /** 任务配置（可选，导入时可能没有） */
  config?: {
    apiKey: string;
    baseUrl: string;
    modelName?: string;
    textModelName?: string;
  };
}

export class TaskStorageTaskNotFoundError extends Error {
  readonly code = 'TASK_NOT_FOUND';

  constructor(taskId: string, operation: string) {
    super(
      `[TaskStorageWriter] Task ${taskId} not found while trying to ${operation}`
    );
    this.name = 'TaskStorageTaskNotFoundError';
  }
}

export class TaskStorageOperationTimeoutError extends Error {
  readonly code = 'TASK_STORAGE_TIMEOUT';

  constructor(operation: string) {
    super(
      `[TaskStorageWriter] ${operation} did not settle within ${TASK_STORAGE_OPERATION_TIMEOUT_MS}ms`
    );
    this.name = 'TaskStorageOperationTimeoutError';
  }
}

async function withTaskStorageDeadline<T>(
  operation: string,
  run: () => Promise<T>,
  onTimeout?: () => void
): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  const operationPromise = run();
  const timeout = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      try {
        onTimeout?.();
      } finally {
        reject(new TaskStorageOperationTimeoutError(operation));
      }
    }, TASK_STORAGE_OPERATION_TIMEOUT_MS);
  });

  try {
    return await Promise.race([operationPromise, timeout]);
  } finally {
    if (timeoutId !== undefined) {
      clearTimeout(timeoutId);
    }
  }
}

/**
 * 任务存储写入器
 *
 * 提供直接写入 IndexedDB 的能力，用于降级模式。
 */
class TaskStorageWriter {
  private db: IDBDatabase | null = null;
  private dbPromise: Promise<IDBDatabase> | null = null;
  private taskWriteQueues = new Map<string, Promise<void>>();

  /**
   * Serialize writes for the same task. A failed write must not poison later
   * recovery writes, so the queue tail always settles successfully while the
   * caller still receives the original rejection.
   */
  private enqueueTaskWrite<T>(
    taskId: string,
    operation: () => Promise<T>
  ): Promise<T> {
    const previous = this.taskWriteQueues.get(taskId) || Promise.resolve();
    const operationPromise = previous.catch(() => undefined).then(operation);
    const queueTail = operationPromise.then(
      () => undefined,
      () => undefined
    );

    this.taskWriteQueues.set(taskId, queueTail);

    return operationPromise.finally(() => {
      if (this.taskWriteQueues.get(taskId) === queueTail) {
        this.taskWriteQueues.delete(taskId);
      }
    });
  }

  private async waitForTaskWrites(taskId: string): Promise<void> {
    await this.taskWriteQueues.get(taskId);
  }

  /**
   * 获取数据库连接
   */
  private async getDB(): Promise<IDBDatabase> {
    if (this.db) {
      return this.db;
    }

    if (this.dbPromise) {
      return this.dbPromise;
    }

    let resolveOpen!: (database: IDBDatabase) => void;
    let rejectOpen!: (reason: unknown) => void;
    const openPromise = new Promise<IDBDatabase>((resolve, reject) => {
      resolveOpen = resolve;
      rejectOpen = reject;
    });
    this.dbPromise = openPromise;

    const request = (() => {
      try {
        return indexedDB.open(DB_NAME);
      } catch (error) {
        if (this.dbPromise === openPromise) {
          this.dbPromise = null;
        }
        rejectOpen(error);
        return null;
      }
    })();
    if (!request) {
      return openPromise;
    }

    let settled = false;

    const releaseOpenAttempt = () => {
      clearTimeout(timeoutId);
      if (this.dbPromise === openPromise) {
        this.dbPromise = null;
      }
    };

    const rejectOnce = (error: unknown) => {
      if (settled) {
        return;
      }
      settled = true;
      releaseOpenAttempt();
      rejectOpen(error);
    };

    const timeoutId = setTimeout(() => {
      rejectOnce(new TaskStorageOperationTimeoutError('open task database'));
    }, TASK_STORAGE_OPERATION_TIMEOUT_MS);

    request.onerror = () => {
      rejectOnce(request.error || new Error('Failed to open database'));
    };

    request.onsuccess = () => {
      const database = request.result;
      if (settled || this.dbPromise !== openPromise) {
        // IDB open requests cannot be aborted. If this request settled after
        // its caller timed out (or after a retry took ownership), close the
        // stale connection instead of leaking it or replacing the retry.
        database.close();
        return;
      }

      settled = true;
      releaseOpenAttempt();
      this.db = database;
      database.onclose = () => {
        if (this.db === database) {
          this.db = null;
        }
      };
      database.onversionchange = () => {
        database.close();
        if (this.db === database) {
          this.db = null;
        }
      };
      resolveOpen(database);
    };

    request.onblocked = () => {
      rejectOnce(new Error('[TaskStorageWriter] Task database open blocked'));
    };

    request.onupgradeneeded = () => {
      // 如果数据库不存在，创建必要的 object store
      const db = request.result;
      if (!db.objectStoreNames.contains(TASKS_STORE)) {
        const store = db.createObjectStore(TASKS_STORE, { keyPath: 'id' });
        store.createIndex('status', 'status', { unique: false });
        store.createIndex('type', 'type', { unique: false });
        store.createIndex('createdAt', 'createdAt', { unique: false });
      }
    };

    return openPromise;
  }

  /**
   * Read, decide, and write one task row in the same IndexedDB transaction.
   * The process-local queue preserves call order in this tab; the readwrite
   * transaction is the serialization boundary shared by tabs and workers.
   */
  private async mutateTaskRecord<T>(
    taskId: string,
    operation: string,
    mutate: (storedTask: SWTask | null) => { task?: SWTask; result: T }
  ): Promise<T> {
    const db = await withTaskStorageDeadline('open task database', () =>
      this.getDB()
    );
    let transaction: IDBTransaction | undefined;

    return withTaskStorageDeadline(
      operation,
      () =>
        new Promise<T>((resolve, reject) => {
          transaction = db.transaction(TASKS_STORE, 'readwrite');
          const store = transaction.objectStore(TASKS_STORE);
          const readRequest = store.get(taskId);
          let mutationResult: T;
          let hasMutationResult = false;
          let mutationError: unknown;

          readRequest.onsuccess = () => {
            try {
              const mutation = mutate(
                (readRequest.result as SWTask | undefined) || null
              );
              mutationResult = mutation.result;
              hasMutationResult = true;
              if (mutation.task) {
                store.put(normalizeTerminalTaskExecutionPhase(mutation.task));
              }
            } catch (error) {
              mutationError = error;
              try {
                transaction?.abort();
              } catch {
                reject(error);
              }
            }
          };
          readRequest.onerror = () => {
            mutationError = readRequest.error;
          };
          transaction.oncomplete = () => {
            if (!hasMutationResult) {
              reject(
                mutationError ||
                  new Error(
                    `[TaskStorageWriter] ${operation} completed without a result`
                  )
              );
              return;
            }
            resolve(mutationResult!);
          };
          transaction.onerror = () =>
            reject(mutationError || transaction?.error || readRequest.error);
          transaction.onabort = () =>
            reject(mutationError || transaction?.error || readRequest.error);
        }),
      () => {
        try {
          transaction?.abort();
        } catch {
          // The transaction may already have completed between timer ticks.
        }
      }
    );
  }

  /**
   * Lazily repairs rows written by older builds that combined a terminal
   * status with an active execution phase. Timestamps are intentionally kept
   * unchanged because this is metadata normalization, not a new task event.
   */
  async repairTerminalExecutionPhases(): Promise<number> {
    const db = await withTaskStorageDeadline('open task database', () =>
      this.getDB()
    );
    let transaction: IDBTransaction | undefined;
    return withTaskStorageDeadline(
      'repair terminal task execution phases',
      () =>
        new Promise<number>((resolve, reject) => {
          transaction = db.transaction(TASKS_STORE, 'readwrite');
          const store = transaction.objectStore(TASKS_STORE);
          const request = store.openCursor();
          let repairedCount = 0;

          request.onsuccess = () => {
            const cursor = request.result;
            if (!cursor) {
              return;
            }

            const task = cursor.value as SWTask;
            if (hasTerminalExecutionPhaseField(task)) {
              cursor.update(normalizeTerminalTaskExecutionPhase(task));
              repairedCount += 1;
            }
            cursor.continue();
          };
          request.onerror = () => reject(request.error);
          transaction.oncomplete = () => resolve(repairedCount);
          transaction.onerror = () =>
            reject(transaction?.error || request.error);
          transaction.onabort = () =>
            reject(transaction?.error || request.error);
        }),
      () => {
        try {
          transaction?.abort();
        } catch {
          // The transaction may already have completed between timer ticks.
        }
      }
    );
  }

  private shouldKeepStoredTask(
    storedTask: SWTask,
    nextTask: SWTask,
    options: TaskSaveOptions
  ): boolean {
    // An explicit user retry owns the transition from a terminal record back
    // to an active state. Persist it even if the stored timestamp came from a
    // clock-skewed/imported record in the future.
    if (
      options.allowTerminalReopen &&
      TERMINAL_TASK_STATUSES.has(storedTask.status) &&
      !TERMINAL_TASK_STATUSES.has(nextTask.status)
    ) {
      return false;
    }

    if (
      TERMINAL_TASK_STATUSES.has(storedTask.status) &&
      !TERMINAL_TASK_STATUSES.has(nextTask.status) &&
      !options.allowTerminalReopen
    ) {
      return true;
    }

    if (
      TERMINAL_TASK_STATUSES.has(storedTask.status) &&
      TERMINAL_TASK_STATUSES.has(nextTask.status) &&
      storedTask.status !== nextTask.status
    ) {
      return true;
    }

    if (storedTask.updatedAt > nextTask.updatedAt) {
      return true;
    }

    return (
      storedTask.updatedAt === nextTask.updatedAt &&
      TERMINAL_TASK_STATUSES.has(storedTask.status) &&
      !TERMINAL_TASK_STATUSES.has(nextTask.status) &&
      !options.allowTerminalReopen
    );
  }

  /**
   * User-visible durable facts are monotonic for one execution. A normal
   * lifecycle snapshot must never erase a fact already committed by another
   * callback or browser context. An explicit terminal reopen is the only
   * operation allowed to start a fresh execution with reset flags.
   */
  private mergeMonotonicTaskFlags(
    storedTask: SWTask | null,
    nextTask: SWTask,
    options: TaskSaveOptions
  ): SWTask {
    if (!storedTask) {
      return nextTask;
    }

    const explicitlyReopensTerminal =
      options.allowTerminalReopen === true &&
      TERMINAL_TASK_STATUSES.has(storedTask.status) &&
      !TERMINAL_TASK_STATUSES.has(nextTask.status);
    if (explicitlyReopensTerminal) {
      return nextTask;
    }

    let mergedTask = nextTask;
    for (const flag of MONOTONIC_TASK_FLAGS) {
      if (storedTask[flag] === true && nextTask[flag] !== true) {
        if (mergedTask === nextTask) {
          mergedTask = { ...nextTask };
        }
        mergedTask[flag] = true;
      }
    }
    return mergedTask;
  }

  async saveTask(
    task: SWTask,
    options: TaskSaveOptions = {}
  ): Promise<boolean> {
    return this.enqueueTaskWrite(task.id, () =>
      this.mutateTaskRecord(task.id, `save task ${task.id}`, (storedTask) => {
        if (
          storedTask &&
          this.shouldKeepStoredTask(storedTask, task, options)
        ) {
          return { result: false };
        }
        return {
          task: this.mergeMonotonicTaskFlags(storedTask, task, options),
          result: true,
        };
      })
    );
  }

  /**
   * Persist an in-memory task whose large parameters were stripped after
   * execution started. The write lane is reserved before IndexedDB is read,
   * and the original large fields are merged back atomically.
   */
  async saveTaskPreservingParams(
    task: SWTask,
    preservedParamKeys: readonly string[],
    options: TaskSaveOptions = {}
  ): Promise<boolean> {
    return this.enqueueTaskWrite(task.id, () =>
      this.mutateTaskRecord(
        task.id,
        `save task ${task.id} while preserving parameters`,
        (storedTask) => {
          if (
            storedTask &&
            this.shouldKeepStoredTask(storedTask, task, options)
          ) {
            return { result: false };
          }

          const params = { ...task.params };
          for (const key of preservedParamKeys) {
            if (
              params[key] === undefined &&
              storedTask?.params[key] !== undefined
            ) {
              params[key] = storedTask.params[key];
            }
          }

          return {
            task: this.mergeMonotonicTaskFlags(
              storedTask,
              { ...task, params },
              options
            ),
            result: true,
          };
        }
      )
    );
  }

  async mergeTaskParams(
    taskId: string,
    params: Partial<SWTask['params']>
  ): Promise<void> {
    return this.enqueueTaskWrite(taskId, () =>
      this.mutateTaskRecord(
        taskId,
        `merge task ${taskId} parameters`,
        (task) => {
          if (!task) {
            throw new TaskStorageTaskNotFoundError(taskId, 'merge task params');
          }
          return {
            task: {
              ...task,
              params: {
                ...task.params,
                ...params,
              },
              updatedAt: Date.now(),
            },
            result: undefined,
          };
        }
      )
    );
  }

  /**
   * 获取任务
   */
  private async getTaskRecord(taskId: string): Promise<SWTask | null> {
    if (!taskId) {
      return null;
    }

    const db = await withTaskStorageDeadline('open task database', () =>
      this.getDB()
    );
    let transaction: IDBTransaction | undefined;
    return withTaskStorageDeadline(
      `read task ${taskId}`,
      () =>
        new Promise((resolve, reject) => {
          transaction = db.transaction(TASKS_STORE, 'readonly');
          const store = transaction.objectStore(TASKS_STORE);
          const request = store.get(taskId);

          request.onerror = () => reject(request.error);
          request.onsuccess = () => resolve(request.result || null);
          transaction.onerror = () =>
            reject(transaction?.error || request.error);
          transaction.onabort = () =>
            reject(transaction?.error || request.error);
        }),
      () => {
        try {
          transaction?.abort();
        } catch {
          // The transaction may already have completed between timer ticks.
        }
      }
    );
  }

  async getTask(taskId: string): Promise<SWTask | null> {
    if (!taskId) {
      return null;
    }

    await this.waitForTaskWrites(taskId);
    return this.getTaskRecord(taskId);
  }

  private shouldIgnoreLateTerminalMutation(
    task: SWTask,
    nextStatus: SWTaskStatus,
    operation: string
  ): boolean {
    if (
      !TERMINAL_TASK_STATUSES.has(task.status) ||
      task.status === nextStatus
    ) {
      return false;
    }

    console.warn(
      `[TaskStorageWriter] Ignoring ${operation} for terminal task ${task.id} (${task.status} -> ${nextStatus})`
    );
    return true;
  }

  private isStaleImageAttempt(
    task: SWTask,
    options?: ImageTaskAttemptWriteOptions
  ): boolean {
    return (
      task.type === 'image' &&
      options?.expectedStartedAt !== undefined &&
      task.startedAt !== options.expectedStartedAt
    );
  }

  /**
   * 创建新任务
   */
  async createTask(
    taskId: string,
    type: SWTaskType,
    params: SWTask['params'],
    invocationRoute?: TaskInvocationRouteSnapshot
  ): Promise<SWTask> {
    const now = Date.now();
    const task: SWTask = {
      id: taskId,
      type,
      status: 'pending',
      params,
      invocationRoute,
      createdAt: now,
      updatedAt: now,
    };
    await this.saveTask(task);
    return task;
  }

  /**
   * 更新任务状态
   */
  async updateStatus(
    taskId: string,
    status: SWTaskStatus,
    options?: ImageTaskAttemptWriteOptions
  ): Promise<boolean> {
    return this.enqueueTaskWrite(taskId, () =>
      this.mutateTaskRecord(taskId, `update task ${taskId} status`, (task) => {
        if (!task) {
          throw new TaskStorageTaskNotFoundError(taskId, 'update status');
        }
        if (this.isStaleImageAttempt(task, options)) {
          return { result: false };
        }
        if (
          this.shouldIgnoreLateTerminalMutation(task, status, 'status update')
        ) {
          return { result: false };
        }

        const now = Date.now();
        return {
          task: {
            ...task,
            status,
            updatedAt: now,
            ...(status === 'processing' && !task.startedAt
              ? { startedAt: now }
              : {}),
          },
          result: true,
        };
      })
    );
  }

  /**
   * 更新任务进度
   */
  async updateProgress(
    taskId: string,
    progress: number,
    phase?: string,
    options?: ImageTaskAttemptWriteOptions
  ): Promise<boolean> {
    return this.enqueueTaskWrite(taskId, () =>
      this.mutateTaskRecord(
        taskId,
        `update task ${taskId} progress`,
        (task) => {
          if (!task) {
            throw new TaskStorageTaskNotFoundError(taskId, 'update progress');
          }
          if (this.isStaleImageAttempt(task, options)) {
            return { result: false };
          }
          if (TERMINAL_TASK_STATUSES.has(task.status)) {
            console.warn(
              `[TaskStorageWriter] Ignoring progress update for terminal task ${task.id} (${task.status})`
            );
            return { result: false };
          }
          return {
            task: {
              ...task,
              progress,
              updatedAt: Date.now(),
              ...(phase ? { executionPhase: phase } : {}),
            },
            result: true,
          };
        }
      )
    );
  }

  /**
   * 完成任务
   */
  async completeTask(
    taskId: string,
    result: SWTask['result'],
    options?: ImageTaskAttemptWriteOptions
  ): Promise<SWTask> {
    return this.enqueueTaskWrite(taskId, () =>
      this.mutateTaskRecord(taskId, `complete task ${taskId}`, (task) => {
        if (!task) {
          throw new TaskStorageTaskNotFoundError(taskId, 'complete task');
        }
        if (this.isStaleImageAttempt(task, options)) {
          return { result: task };
        }
        if (
          this.shouldIgnoreLateTerminalMutation(task, 'completed', 'completion')
        ) {
          return {
            result: normalizeTerminalTaskExecutionPhase(task),
          };
        }
        const normalizedResult =
          task.type === 'image' && result
            ? {
                ...normalizeImageTaskResultArtifactProjection(
                  result,
                  normalizeImageDataUrl
                ),
                thumbnailUrl: result.thumbnailUrl
                  ? normalizeImageDataUrl(result.thumbnailUrl)
                  : result.thumbnailUrl,
                thumbnailUrls: result.thumbnailUrls?.map((url) =>
                  normalizeImageDataUrl(url)
                ),
              }
            : result;
        const now = Date.now();
        const completedTask: SWTask = normalizeTerminalTaskExecutionPhase({
          ...task,
          status: 'completed',
          result: normalizedResult,
          completedAt: now,
          updatedAt: now,
          progress: 100,
        });
        return { task: completedTask, result: completedTask };
      })
    );
  }

  /**
   * 任务失败
   */
  async failTask(
    taskId: string,
    error: SWTask['error'],
    options?: ImageTaskAttemptWriteOptions
  ): Promise<SWTask> {
    return this.enqueueTaskWrite(taskId, () =>
      this.mutateTaskRecord(taskId, `fail task ${taskId}`, (task) => {
        if (!task) {
          throw new TaskStorageTaskNotFoundError(taskId, 'fail task');
        }
        if (this.isStaleImageAttempt(task, options)) {
          return { result: task };
        }
        if (this.shouldIgnoreLateTerminalMutation(task, 'failed', 'failure')) {
          return {
            result: normalizeTerminalTaskExecutionPhase(task),
          };
        }
        const failedTask: SWTask = normalizeTerminalTaskExecutionPhase({
          ...task,
          status: 'failed',
          error,
          updatedAt: Date.now(),
        });
        return { task: failedTask, result: failedTask };
      })
    );
  }

  /**
   * 更新任务的 remoteId（用于异步任务恢复）
   */
  async updateRemoteId(
    taskId: string,
    remoteId: string,
    invocationRoute?: TaskInvocationRouteSnapshot,
    options?: ImageTaskAttemptWriteOptions
  ): Promise<boolean> {
    return this.enqueueTaskWrite(taskId, () =>
      this.mutateTaskRecord(
        taskId,
        `update task ${taskId} remote ID`,
        (task) => {
          if (!task) {
            throw new TaskStorageTaskNotFoundError(taskId, 'update remote ID');
          }
          if (this.isStaleImageAttempt(task, options)) {
            return { result: false };
          }
          if (TERMINAL_TASK_STATUSES.has(task.status)) {
            console.warn(
              `[TaskStorageWriter] Ignoring remote ID update for terminal task ${task.id} (${task.status})`
            );
            return { result: false };
          }
          return {
            task: {
              ...task,
              remoteId,
              ...(invocationRoute ? { invocationRoute } : {}),
              updatedAt: Date.now(),
              executionPhase: 'polling',
            },
            result: true,
          };
        }
      )
    );
  }

  /**
   * 删除任务
   */
  async deleteTask(taskId: string): Promise<void> {
    if (!taskId) {
      return;
    }

    return this.enqueueTaskWrite(taskId, async () => {
      const db = await withTaskStorageDeadline('open task database', () =>
        this.getDB()
      );
      let transaction: IDBTransaction | undefined;
      await withTaskStorageDeadline(
        `delete task ${taskId}`,
        () =>
          new Promise<void>((resolve, reject) => {
            transaction = db.transaction(TASKS_STORE, 'readwrite');
            const store = transaction.objectStore(TASKS_STORE);
            const request = store.delete(taskId);

            request.onerror = () => reject(request.error);
            transaction.oncomplete = () => resolve();
            transaction.onerror = () =>
              reject(transaction?.error || request.error);
            transaction.onabort = () =>
              reject(transaction?.error || request.error);
          }),
        () => {
          try {
            transaction?.abort();
          } catch {
            // The transaction may already have committed between timer ticks.
          }
        }
      );
    });
  }

  /**
   * 批量导入任务（用于云同步恢复）
   * 只导入不存在的任务，已存在的跳过
   *
   * @returns 成功导入的任务数量
   */
  async importTasks(
    tasks: SWTask[],
    options: { replaceExisting?: boolean; batchSize?: number } = {}
  ): Promise<{ imported: number; skipped: number }> {
    if (tasks.length === 0) {
      return { imported: 0, skipped: 0 };
    }

    const db = await this.getDB();
    const batchSize = Math.max(1, options.batchSize ?? 200);
    let totalImported = 0;
    let totalSkipped = 0;

    for (let i = 0; i < tasks.length; i += batchSize) {
      const batch = tasks.slice(i, i + batchSize);
      const result = await new Promise<{ imported: number; skipped: number }>(
        (resolve, reject) => {
          const transaction = db.transaction(TASKS_STORE, 'readwrite');
          const store = transaction.objectStore(TASKS_STORE);

          let imported = 0;
          let skipped = 0;
          let completed = 0;

          // 处理每个任务
          for (const task of batch) {
            const normalizedTask = normalizeTerminalTaskExecutionPhase(task);
            if (options.replaceExisting) {
              const putRequest = store.put(normalizedTask);
              putRequest.onsuccess = () => {
                imported++;
                completed++;
                if (completed === batch.length) {
                  resolve({ imported, skipped });
                }
              };
              putRequest.onerror = () => {
                // 单个任务失败不影响其他任务
                skipped++;
                completed++;
                if (completed === batch.length) {
                  resolve({ imported, skipped });
                }
              };
              continue;
            }

            // 先检查是否存在
            const getRequest = store.get(task.id);

            getRequest.onsuccess = () => {
              if (getRequest.result) {
                // 任务已存在，跳过
                skipped++;
                completed++;
                if (completed === batch.length) {
                  resolve({ imported, skipped });
                }
              } else {
                // 任务不存在，插入
                const putRequest = store.put(normalizedTask);
                putRequest.onsuccess = () => {
                  imported++;
                  completed++;
                  if (completed === batch.length) {
                    resolve({ imported, skipped });
                  }
                };
                putRequest.onerror = () => {
                  // 单个任务失败不影响其他任务
                  skipped++;
                  completed++;
                  if (completed === batch.length) {
                    resolve({ imported, skipped });
                  }
                };
              }
            };

            getRequest.onerror = () => {
              skipped++;
              completed++;
              if (completed === batch.length) {
                resolve({ imported, skipped });
              }
            };
          }

          transaction.onerror = () => reject(transaction.error);
        }
      );
      totalImported += result.imported;
      totalSkipped += result.skipped;
      await new Promise((resolve) => setTimeout(resolve, 0));
    }

    return { imported: totalImported, skipped: totalSkipped };
  }

  /**
   * 清空任务表（用于完整覆盖恢复）
   */
  async clearAllTasks(): Promise<void> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(TASKS_STORE, 'readwrite');
      const store = transaction.objectStore(TASKS_STORE);
      const request = store.clear();

      request.onerror = () => reject(request.error);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
  }

  /**
   * 归档任务（标记 archived=true，不删除数据）
   */
  async archiveTask(taskId: string): Promise<void> {
    return this.enqueueTaskWrite(taskId, () =>
      this.mutateTaskRecord(taskId, `archive task ${taskId}`, (task) => ({
        ...(task && !task.archived
          ? {
              task: {
                ...task,
                archived: true,
                updatedAt: Date.now(),
              },
            }
          : {}),
        result: undefined,
      }))
    );
  }

  /**
   * 批量归档任务
   */
  async archiveTasks(taskIds: string[]): Promise<void> {
    if (taskIds.length === 0) return;
    await Promise.all(taskIds.map((taskId) => this.archiveTask(taskId)));
  }

  /**
   * 标记任务已插入画布
   */
  async markInserted(taskId: string): Promise<void> {
    return this.markMonotonicFlag(taskId, 'insertedToCanvas', 'mark inserted');
  }

  /**
   * 标记任务结果已保存到媒体库
   */
  async markSaved(taskId: string): Promise<void> {
    return this.markMonotonicFlag(taskId, 'savedToLibrary', 'mark saved');
  }

  private async markMonotonicFlag(
    taskId: string,
    flag: 'insertedToCanvas' | 'savedToLibrary',
    operation: string
  ): Promise<void> {
    return this.enqueueTaskWrite(taskId, () =>
      this.mutateTaskRecord(
        taskId,
        `${operation} for task ${taskId}`,
        (task) => {
          if (!task) {
            throw new TaskStorageTaskNotFoundError(taskId, operation);
          }
          if (task[flag] === true) {
            return { result: undefined };
          }
          return {
            task: {
              ...task,
              [flag]: true,
              updatedAt: Date.now(),
            },
            result: undefined,
          };
        }
      )
    );
  }

  /**
   * 关闭数据库连接
   */
  close(): void {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
  }
}

/**
 * 任务存储写入器单例
 */
export const taskStorageWriter = new TaskStorageWriter();
