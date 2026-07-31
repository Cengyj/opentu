/**
 * Task Storage Writer
 *
 * 主线程直接写入 IndexedDB 中的任务数据。
 * 当前任务执行不经过 Service Worker，本模块是正常写入路径。
 */

import { normalizeImageDataUrl } from '@aitu/utils';
import { APP_DB_NAME, APP_DB_STORES } from '../app-database';
import type { TaskInvocationRouteSnapshot } from '../../types/task.types';

// 使用主线程专用数据库
const DB_NAME = APP_DB_NAME;
const TASKS_STORE = APP_DB_STORES.TASKS;

// 使用与 SW 端一致的字符串字面量类型
type SWTaskType =
  | 'image'
  | 'video'
  | 'audio'
  | 'character'
  | 'inspiration_board'
  | 'chat';
type SWTaskStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';

const TERMINAL_TASK_STATUSES = new Set<SWTaskStatus>([
  'completed',
  'failed',
  'cancelled',
]);

export interface TaskSaveOptions {
  allowTerminalReopen?: boolean;
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

    this.dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME);

      request.onerror = () => {
        this.dbPromise = null;
        reject(new Error('Failed to open database'));
      };

      request.onsuccess = () => {
        this.db = request.result;
        this.dbPromise = null;
        resolve(this.db);
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
    });

    return this.dbPromise;
  }

  /**
   * 保存任务
   */
  private async saveTaskRecord(task: SWTask): Promise<void> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(TASKS_STORE, 'readwrite');
      const store = transaction.objectStore(TASKS_STORE);
      const request = store.put(task);

      request.onerror = () => reject(request.error);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error || request.error);
      transaction.onabort = () => reject(transaction.error || request.error);
    });
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

  async saveTask(
    task: SWTask,
    options: TaskSaveOptions = {}
  ): Promise<boolean> {
    return this.enqueueTaskWrite(task.id, async () => {
      const storedTask = await this.getTaskRecord(task.id);
      if (storedTask && this.shouldKeepStoredTask(storedTask, task, options)) {
        return false;
      }
      await this.saveTaskRecord(task);
      return true;
    });
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
    return this.enqueueTaskWrite(task.id, async () => {
      const storedTask = await this.getTaskRecord(task.id);
      if (storedTask && this.shouldKeepStoredTask(storedTask, task, options)) {
        return false;
      }

      const params = { ...task.params };
      for (const key of preservedParamKeys) {
        if (params[key] === undefined && storedTask?.params[key] !== undefined) {
          params[key] = storedTask.params[key];
        }
      }

      await this.saveTaskRecord({
        ...task,
        params,
      });
      return true;
    });
  }

  async mergeTaskParams(
    taskId: string,
    params: Partial<SWTask['params']>
  ): Promise<void> {
    return this.enqueueTaskWrite(taskId, async () => {
      const task = await this.requireTaskRecord(taskId, 'merge task params');
      task.params = {
        ...task.params,
        ...params,
      };
      task.updatedAt = Date.now();
      await this.saveTaskRecord(task);
    });
  }

  /**
   * 获取任务
   */
  private async getTaskRecord(taskId: string): Promise<SWTask | null> {
    if (!taskId) {
      return null;
    }

    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(TASKS_STORE, 'readonly');
      const store = transaction.objectStore(TASKS_STORE);
      const request = store.get(taskId);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result || null);
    });
  }

  async getTask(taskId: string): Promise<SWTask | null> {
    if (!taskId) {
      return null;
    }

    await this.waitForTaskWrites(taskId);
    return this.getTaskRecord(taskId);
  }

  private async requireTaskRecord(
    taskId: string,
    operation: string
  ): Promise<SWTask> {
    const task = await this.getTaskRecord(taskId);
    if (!task) {
      throw new TaskStorageTaskNotFoundError(taskId, operation);
    }
    return task;
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
  async updateStatus(taskId: string, status: SWTaskStatus): Promise<void> {
    return this.enqueueTaskWrite(taskId, async () => {
      const task = await this.requireTaskRecord(taskId, 'update status');
      if (this.shouldIgnoreLateTerminalMutation(task, status, 'status update')) {
        return;
      }
      task.status = status;
      task.updatedAt = Date.now();
      if (status === 'processing' && !task.startedAt) {
        task.startedAt = Date.now();
      }
      await this.saveTaskRecord(task);
    });
  }

  /**
   * 更新任务进度
   */
  async updateProgress(
    taskId: string,
    progress: number,
    phase?: string
  ): Promise<void> {
    return this.enqueueTaskWrite(taskId, async () => {
      const task = await this.requireTaskRecord(taskId, 'update progress');
      if (TERMINAL_TASK_STATUSES.has(task.status)) {
        console.warn(
          `[TaskStorageWriter] Ignoring progress update for terminal task ${task.id} (${task.status})`
        );
        return;
      }
      task.progress = progress;
      task.updatedAt = Date.now();
      if (phase) {
        task.executionPhase = phase;
      }
      await this.saveTaskRecord(task);
    });
  }

  /**
   * 完成任务
   */
  async completeTask(taskId: string, result: SWTask['result']): Promise<void> {
    return this.enqueueTaskWrite(taskId, async () => {
      const task = await this.requireTaskRecord(taskId, 'complete task');
      if (
        this.shouldIgnoreLateTerminalMutation(task, 'completed', 'completion')
      ) {
        return;
      }
      const normalizedResult =
        task.type === 'image' && result
          ? {
              ...result,
              url: normalizeImageDataUrl(result.url),
              urls: result.urls?.map((url) => normalizeImageDataUrl(url)),
              thumbnailUrl: result.thumbnailUrl
                ? normalizeImageDataUrl(result.thumbnailUrl)
                : result.thumbnailUrl,
              thumbnailUrls: result.thumbnailUrls?.map((url) =>
                normalizeImageDataUrl(url)
              ),
            }
          : result;

      task.status = 'completed';
      task.result = normalizedResult;
      task.completedAt = Date.now();
      task.updatedAt = Date.now();
      task.progress = 100;
      await this.saveTaskRecord(task);
    });
  }

  /**
   * 任务失败
   */
  async failTask(taskId: string, error: SWTask['error']): Promise<void> {
    return this.enqueueTaskWrite(taskId, async () => {
      const task = await this.requireTaskRecord(taskId, 'fail task');
      if (this.shouldIgnoreLateTerminalMutation(task, 'failed', 'failure')) {
        return;
      }
      task.status = 'failed';
      task.error = error;
      task.updatedAt = Date.now();
      await this.saveTaskRecord(task);
    });
  }

  /**
   * 更新任务的 remoteId（用于异步任务恢复）
   */
  async updateRemoteId(
    taskId: string,
    remoteId: string,
    invocationRoute?: TaskInvocationRouteSnapshot
  ): Promise<void> {
    return this.enqueueTaskWrite(taskId, async () => {
      const task = await this.requireTaskRecord(taskId, 'update remote ID');
      if (TERMINAL_TASK_STATUSES.has(task.status)) {
        console.warn(
          `[TaskStorageWriter] Ignoring remote ID update for terminal task ${task.id} (${task.status})`
        );
        return;
      }
      task.remoteId = remoteId;
      if (invocationRoute) {
        task.invocationRoute = invocationRoute;
      }
      task.updatedAt = Date.now();
      task.executionPhase = 'polling';
      await this.saveTaskRecord(task);
    });
  }

  /**
   * 删除任务
   */
  async deleteTask(taskId: string): Promise<void> {
    if (!taskId) {
      return;
    }

    return this.enqueueTaskWrite(taskId, async () => {
      const db = await this.getDB();
      await new Promise<void>((resolve, reject) => {
        const transaction = db.transaction(TASKS_STORE, 'readwrite');
        const store = transaction.objectStore(TASKS_STORE);
        const request = store.delete(taskId);

        request.onerror = () => reject(request.error);
        transaction.oncomplete = () => resolve();
        transaction.onerror = () =>
          reject(transaction.error || request.error);
        transaction.onabort = () => reject(transaction.error || request.error);
      });
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
      const result = await new Promise<{ imported: number; skipped: number }>((resolve, reject) => {
        const transaction = db.transaction(TASKS_STORE, 'readwrite');
        const store = transaction.objectStore(TASKS_STORE);

        let imported = 0;
        let skipped = 0;
        let completed = 0;

        // 处理每个任务
        for (const task of batch) {
          if (options.replaceExisting) {
            const putRequest = store.put(task);
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
              const putRequest = store.put(task);
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
      });
      totalImported += result.imported;
      totalSkipped += result.skipped;
      await new Promise(resolve => setTimeout(resolve, 0));
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
    return this.enqueueTaskWrite(taskId, async () => {
      const task = await this.getTaskRecord(taskId);
      if (!task) return;
      task.archived = true;
      task.updatedAt = Date.now();
      await this.saveTaskRecord(task);
    });
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
    return this.enqueueTaskWrite(taskId, async () => {
      const task = await this.requireTaskRecord(taskId, 'mark inserted');
      task.insertedToCanvas = true;
      task.updatedAt = Date.now();
      await this.saveTaskRecord(task);
    });
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
