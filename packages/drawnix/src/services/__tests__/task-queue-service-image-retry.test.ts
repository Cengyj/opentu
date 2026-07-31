import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  TaskExecutionPhase,
  TaskStatus,
  TaskType,
} from '../../types/task.types';
import type { Task } from '../../types/task.types';

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

const TINY_PNG_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
const CACHED_BASE64_RESULT_URL =
  '/__aitu_cache__/image/content-regression-base64.png';

async function flushAsyncWork(turns = 6): Promise<void> {
  for (let index = 0; index < turns; index += 1) {
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
}

async function setupTaskQueueServiceHarness(
  statusSequence: TaskStatus[],
  options: {
    delayInitialImagePersistenceMs?: number;
    rejectInitialImagePersistence?: boolean;
    blockTerminalReopenPersistence?: boolean;
    completeImageFromBase64?: boolean;
    passThroughTaskCompletion?: boolean;
  } = {}
) {
  const storedTasks = new Map<string, any>();
  let delayedInitialImagePersistence = false;
  let rejectedInitialImagePersistence = false;
  let blockedTerminalReopenPersistence = false;
  let releaseTerminalReopenPersistence!: () => void;
  let notifyTerminalReopenPersistence!: () => void;
  const terminalReopenPersistenceReleased = new Promise<void>((resolve) => {
    releaseTerminalReopenPersistence = resolve;
  });
  const terminalReopenPersistenceReached = new Promise<void>((resolve) => {
    notifyTerminalReopenPersistence = resolve;
  });
  const saveTask = vi.fn(async (task: any, saveOptions?: any) => {
    if (
      options.rejectInitialImagePersistence &&
      !rejectedInitialImagePersistence &&
      task.type === TaskType.IMAGE &&
      task.status === TaskStatus.PROCESSING
    ) {
      rejectedInitialImagePersistence = true;
      throw new Error('Simulated initial IndexedDB write failure');
    }
    if (
      options.delayInitialImagePersistenceMs &&
      !delayedInitialImagePersistence &&
      task.type === TaskType.IMAGE &&
      task.status === TaskStatus.PROCESSING
    ) {
      delayedInitialImagePersistence = true;
      await new Promise((resolve) =>
        setTimeout(resolve, options.delayInitialImagePersistenceMs)
      );
    }
    if (
      options.blockTerminalReopenPersistence &&
      !blockedTerminalReopenPersistence &&
      saveOptions?.allowTerminalReopen &&
      task.type === TaskType.IMAGE &&
      task.status === TaskStatus.PROCESSING
    ) {
      blockedTerminalReopenPersistence = true;
      notifyTerminalReopenPersistence();
      await terminalReopenPersistenceReleased;
    }
    storedTasks.set(task.id, clone(task));
    return true;
  });
  const saveTaskPreservingParams = vi.fn(
    async (
      task: any,
      preservedParamKeys: readonly string[],
      saveOptions?: any
    ) => {
      const persistedTask = clone(task);
      const storedTask = storedTasks.get(task.id);

      for (const key of preservedParamKeys) {
        if (
          persistedTask.params[key] === undefined &&
          storedTask?.params?.[key] !== undefined
        ) {
          persistedTask.params[key] = clone(storedTask.params[key]);
        }
      }

      return saveTask(persistedTask, saveOptions);
    }
  );

  const mocks = {
    saveTask,
    saveTaskPreservingParams,
    getStoredTask: vi.fn(async (taskId: string) => {
      const task = storedTasks.get(taskId);
      return task ? clone(task) : null;
    }),
    deleteTask: vi.fn(async (taskId: string) => {
      storedTasks.delete(taskId);
    }),
    archiveTasks: vi.fn(async () => undefined),
    invalidateCache: vi.fn(),
    generateImage: vi.fn(async (_params?: any, _options?: any) => undefined),
    updateStatus: vi.fn(async (taskId: string, status: TaskStatus) => {
      const task = storedTasks.get(taskId);
      if (!task) return;
      storedTasks.set(taskId, {
        ...task,
        status,
        startedAt: task.startedAt || Date.now(),
        updatedAt: Date.now(),
      });
    }),
    completeTask: vi.fn(async (taskId: string, result: any) => {
      const task = storedTasks.get(taskId);
      if (!task) return;
      storedTasks.set(taskId, {
        ...task,
        status: TaskStatus.COMPLETED,
        result: clone(result),
        progress: 100,
        completedAt: Date.now(),
        updatedAt: Date.now(),
      });
    }),
    cacheBase64ToLocalUrl: vi.fn(async (base64: string) => {
      if (base64 !== TINY_PNG_BASE64) {
        throw new Error('Unexpected base64 fixture');
      }
      return CACHED_BASE64_RESULT_URL;
    }),
  };

  if (options.completeImageFromBase64) {
    mocks.generateImage.mockImplementation(async (params: any) => {
      await mocks.updateStatus(params.taskId, TaskStatus.PROCESSING);
      const cachedUrl = await mocks.cacheBase64ToLocalUrl(TINY_PNG_BASE64);
      await mocks.completeTask(params.taskId, {
        url: cachedUrl,
        format: 'png',
        size: 0,
      });
    });
  }

  const waitForTaskCompletion = vi.fn(async (taskId: string, options?: any) => {
    const currentTask = storedTasks.get(taskId);
    if (!currentTask) {
      return { success: false, error: 'missing-task' };
    }

    if (options?.passThroughTaskCompletion) {
      options?.onProgress?.(clone(currentTask));
      return currentTask.status === TaskStatus.COMPLETED
        ? { success: true, task: clone(currentTask) }
        : { success: false, task: clone(currentTask), error: 'not-completed' };
    }

    const callIndex = waitForTaskCompletion.mock.calls.length - 1;
    const nextStatus =
      statusSequence[callIndex] || statusSequence[statusSequence.length - 1];
    const now = Date.now();
    const updatedTask =
      nextStatus === TaskStatus.COMPLETED
        ? {
            ...clone(currentTask),
            status: TaskStatus.COMPLETED,
            updatedAt: now,
            completedAt: now,
            progress: 100,
            result: {
              url: 'https://example.com/out.png',
              format: 'png',
              size: 1,
            },
          }
        : {
            ...clone(currentTask),
            status: TaskStatus.FAILED,
            updatedAt: now,
            completedAt: now,
            error: {
              code: 'EXECUTION_ERROR',
              message: 'Image generation failed',
            },
          };

    storedTasks.set(taskId, clone(updatedTask));
    options?.onProgress?.(clone(updatedTask));

    return nextStatus === TaskStatus.COMPLETED
      ? { success: true, task: clone(updatedTask) }
      : {
          success: false,
          task: clone(updatedTask),
          error: updatedTask.error?.message || 'failed',
        };
  });

  vi.doMock('../media-executor/task-storage-writer', () => ({
    taskStorageWriter: {
      saveTask: mocks.saveTask,
      saveTaskPreservingParams: mocks.saveTaskPreservingParams,
      getTask: mocks.getStoredTask,
      updateStatus: mocks.updateStatus,
      completeTask: mocks.completeTask,
      deleteTask: mocks.deleteTask,
      archiveTasks: mocks.archiveTasks,
    },
  }));

  vi.doMock('../task-storage-reader', () => ({
    taskStorageReader: {
      invalidateCache: mocks.invalidateCache,
      getTask: vi.fn(async (taskId: string) => {
        const task = storedTasks.get(taskId);
        return task ? clone(task) : null;
      }),
      getAllTasks: vi.fn(async () => []),
    },
  }));

  vi.doMock('../media-executor', () => ({
    executorFactory: {
      getExecutor: vi.fn(async () => ({
        generateImage: mocks.generateImage,
      })),
    },
    waitForTaskCompletion: (taskId: string, taskOptions?: any) =>
      waitForTaskCompletion(taskId, {
        ...taskOptions,
        passThroughTaskCompletion: options.passThroughTaskCompletion,
      }),
  }));

  vi.doMock('../../utils/settings-manager', () => ({
    hasInvocationRouteCredentials: vi.fn(() => true),
    createModelRef: (profileId?: string | null, modelId?: string | null) =>
      profileId || modelId
        ? {
            profileId: profileId || null,
            modelId: modelId || null,
          }
        : null,
    resolveInvocationRoute: vi.fn((operation: string, routeModel?: any) => ({
      routeType: operation,
      modelId:
        typeof routeModel === 'string'
          ? routeModel
          : routeModel?.modelId || 'default-model',
      profileId:
        typeof routeModel === 'object' ? routeModel?.profileId || null : null,
      profileName: null,
      providerType: null,
      baseUrl: 'https://api.example.com/v1',
      apiKey: 'test-key',
      source: 'legacy',
    })),
    providerProfilesSettings: {
      get: vi.fn(() => []),
    },
    providerPricingCacheSettings: {
      get: vi.fn(() => []),
      set: vi.fn(),
    },
  }));

  vi.doMock('../provider-routing', () => ({
    resolveInvocationPlanFromRoute: vi.fn(
      (operation: string, routeModel?: any) => {
        const profileId =
          typeof routeModel === 'object' ? routeModel?.profileId : null;
        if (!profileId) {
          return null;
        }

        const modelId =
          typeof routeModel === 'string'
            ? routeModel
            : routeModel?.modelId || 'default-model';
        return {
          provider: {
            profileId,
            profileName: profileId,
            providerType: 'custom',
            baseUrl: 'https://api.example.com/v1',
            apiKey: 'test-key',
            authType: 'bearer',
          },
          modelRef: {
            profileId,
            modelId,
          },
          binding: {
            id: `${profileId}:${modelId}:${operation}`,
            profileId,
            modelId,
            operation,
            protocol: 'openai.async.video',
            requestSchema: 'openai.video.form-input-reference',
            responseSchema: 'openai.async.task',
            submitPath: '/videos',
            pollPathTemplate: '/videos/{taskId}',
            priority: 100,
            confidence: 'high',
            source: 'template',
          },
        };
      }
    ),
  }));

  vi.doMock('../../utils/posthog-analytics', () => ({
    analytics: {
      track: vi.fn(),
      trackModelCall: vi.fn(),
      trackModelSuccess: vi.fn(),
      trackModelFailure: vi.fn(),
      trackTaskCancellation: vi.fn(),
    },
  }));

  vi.doMock('../model-adapters', () => ({
    getAdapterContextFromSettings: vi.fn(),
    resolveAdapterForInvocation: vi.fn(),
  }));

  vi.doMock('../unified-cache-service', () => ({
    unifiedCacheService: {
      getImageForAI: vi.fn(),
      isCached: vi.fn(async () => false),
      cacheMediaFromBlob: vi.fn(async () => undefined),
    },
  }));

  vi.doMock('../analysis-core', () => ({
    buildGenerateContentConfig: vi.fn(() => ({})),
  }));

  vi.doMock('../video-analysis-service', () => ({
    executeVideoAnalysis: vi.fn(),
  }));

  vi.doMock('../music-analysis-service', () => ({
    DEFAULT_MUSIC_ANALYSIS_PROMPT: 'default',
    executeMusicAnalysis: vi.fn(),
    MAX_AUDIO_ANALYZE_FILE_SIZE: 1024,
  }));

  vi.doMock('../../utils/gemini-api/services', () => ({
    sendChatWithGemini: vi.fn(),
  }));

  vi.doMock('../../utils/gemini-api/message-utils', () => ({
    buildInlineDataPart: vi.fn(),
  }));

  vi.doMock('../../utils/gemini-api/logged-calls', () => ({
    callGoogleGenerateContentWithLog: vi.fn(),
  }));

  vi.doMock('../../components/video-analyzer/storage', () => ({
    loadRecords: vi.fn(async () => []),
  }));

  vi.doMock('../../components/video-analyzer/utils', () => ({
    applyRewriteShotUpdates: vi.fn(),
    parseRewriteShotUpdates: vi.fn(),
  }));

  vi.doMock('../../components/music-analyzer/storage', () => ({
    loadRecords: vi.fn(async () => []),
  }));

  vi.doMock('../../components/music-analyzer/utils', () => ({
    parseLyricsRewriteResult: vi.fn(),
  }));

  vi.doMock('../../utils/task-utils', async (importOriginal) => {
    const actual = await importOriginal<
      typeof import('../../utils/task-utils')
    >();

    return {
      ...actual,
      generateTaskId: () => 'task-image-edit-1',
    };
  });

  const { taskQueueService } = await import('../task-queue-service');

  return {
    taskQueueService,
    storedTasks,
    mocks: {
      ...mocks,
      waitForTaskCompletion,
    },
    terminalReopenPersistenceReached,
    releaseTerminalReopenPersistence,
  };
}

describe('task-queue-service lifecycle integration', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.clearAllMocks();
  });

  it('keeps stripped image edit params in IndexedDB so retry can rehydrate them', async () => {
    const { taskQueueService, storedTasks, mocks } =
      await setupTaskQueueServiceHarness([
        TaskStatus.FAILED,
        TaskStatus.COMPLETED,
      ]);

    const task = taskQueueService.createTask(
      {
        prompt: 'Edit this image',
        model: 'gpt-image-2',
        size: '1x1',
        generationMode: 'image_to_image',
        referenceImages: ['data:image/png;base64,source'],
        maskImage: 'data:image/png;base64,mask',
        outputFormat: 'png',
      },
      TaskType.IMAGE
    );

    await flushAsyncWork();

    expect(mocks.generateImage).toHaveBeenCalledTimes(1);
    expect(
      taskQueueService.getTask(task.id)?.params.referenceImages
    ).toBeUndefined();
    expect(storedTasks.get(task.id)?.params.referenceImages).toEqual([
      'data:image/png;base64,source',
    ]);

    taskQueueService.retryTask(task.id);
    await flushAsyncWork();

    expect(mocks.generateImage).toHaveBeenCalledTimes(2);
    expect(mocks.generateImage.mock.calls[1]?.[0]).toMatchObject({
      generationMode: 'image_to_image',
      referenceImages: ['data:image/png;base64,source'],
      maskImage: 'data:image/png;base64,mask',
      outputFormat: 'png',
    });
    expect(storedTasks.get(task.id)?.params.referenceImages).toEqual([
      'data:image/png;base64,source',
    ]);
  });

  it('keeps a base64 image completion when the initial task persistence is delayed', async () => {
    const { taskQueueService, storedTasks, mocks } =
      await setupTaskQueueServiceHarness([TaskStatus.COMPLETED], {
        // This models a slow first IndexedDB write while the image adapter
        // immediately returns b64_json and finishes its cache conversion.
        delayInitialImagePersistenceMs: 30,
        completeImageFromBase64: true,
        passThroughTaskCompletion: true,
      });

    const task = taskQueueService.createTask(
      {
        prompt: 'Fast base64 response after a slow initial persistence',
        model: 'gpt-image-2',
        size: '1x1',
      },
      TaskType.IMAGE
    );

    await new Promise((resolve) => setTimeout(resolve, 60));
    await flushAsyncWork();

    expect(mocks.generateImage).toHaveBeenCalledTimes(1);
    expect(mocks.cacheBase64ToLocalUrl).toHaveBeenCalledWith(TINY_PNG_BASE64);
    expect(mocks.completeTask).toHaveBeenCalledWith(task.id, {
      url: CACHED_BASE64_RESULT_URL,
      format: 'png',
      size: 0,
    });
    expect(storedTasks.get(task.id)).toMatchObject({
      status: TaskStatus.COMPLETED,
      progress: 100,
      result: {
        url: CACHED_BASE64_RESULT_URL,
        format: 'png',
        size: 0,
      },
    });
  });

  it('does not execute when initial task persistence fails and records a retryable failure', async () => {
    const { taskQueueService, storedTasks, mocks } =
      await setupTaskQueueServiceHarness([TaskStatus.COMPLETED], {
        rejectInitialImagePersistence: true,
      });
    const persistenceFailure = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);

    const task = taskQueueService.createTask(
      {
        prompt: 'Initial persistence must succeed before an image request',
        model: 'gpt-image-2',
        size: '1x1',
      },
      TaskType.IMAGE
    );

    await flushAsyncWork();

    expect(mocks.generateImage).not.toHaveBeenCalled();
    expect(taskQueueService.getTask(task.id)).toMatchObject({
      status: TaskStatus.FAILED,
      error: { code: 'TASK_PERSISTENCE_FAILED' },
    });
    expect(storedTasks.get(task.id)).toMatchObject({
      status: TaskStatus.FAILED,
      error: { code: 'TASK_PERSISTENCE_FAILED' },
    });
    expect(persistenceFailure).toHaveBeenCalledWith(
      expect.stringContaining(
        `Failed to persist task ${task.id} before execution:`
      ),
      expect.any(Error)
    );
  });

  it('preserves the selected provider model reference when retrying a task', async () => {
    const { taskQueueService, mocks } = await setupTaskQueueServiceHarness([
      TaskStatus.FAILED,
      TaskStatus.COMPLETED,
    ]);
    const modelRef = {
      profileId: 'provider-a',
      modelId: 'shared-image-model',
    };

    const task = taskQueueService.createTask(
      {
        prompt: 'Retry with the original provider',
        model: modelRef.modelId,
        modelRef,
        size: '1x1',
      },
      TaskType.IMAGE
    );

    await flushAsyncWork();
    expect(taskQueueService.getTask(task.id)?.status).toBe(TaskStatus.FAILED);
    expect(taskQueueService.getTask(task.id)?.invocationRoute).toMatchObject({
      providerProfileId: 'provider-a',
      modelId: 'shared-image-model',
      binding: {
        id: 'provider-a:shared-image-model:image',
      },
    });

    taskQueueService.retryTask(task.id);
    await flushAsyncWork();

    expect(mocks.generateImage).toHaveBeenCalledTimes(2);
    expect(mocks.generateImage.mock.calls[0]?.[0]?.modelRef).toEqual(modelRef);
    expect(mocks.generateImage.mock.calls[1]?.[0]?.modelRef).toEqual(modelRef);
  });

  it('allows explicit manual retry for completed image tasks and clears stale results', async () => {
    const { taskQueueService, mocks } = await setupTaskQueueServiceHarness([
      TaskStatus.COMPLETED,
      TaskStatus.COMPLETED,
    ]);

    const task = taskQueueService.createTask(
      {
        prompt: 'Regenerate completed image',
        model: 'gpt-image-2',
        size: '1x1',
      },
      TaskType.IMAGE
    );

    await flushAsyncWork();

    expect(mocks.generateImage).toHaveBeenCalledTimes(1);
    expect(taskQueueService.getTask(task.id)?.status).toBe(
      TaskStatus.COMPLETED
    );
    expect(taskQueueService.getTask(task.id)?.result).toBeTruthy();

    taskQueueService.retryTask(task.id, { allowCompleted: true });

    expect(taskQueueService.getTask(task.id)?.status).toBe(
      TaskStatus.PROCESSING
    );
    expect(taskQueueService.getTask(task.id)?.result).toBeUndefined();
    expect(taskQueueService.getTask(task.id)?.insertedToCanvas).toBe(false);

    await flushAsyncWork();

    expect(mocks.generateImage).toHaveBeenCalledTimes(2);
    expect(mocks.generateImage.mock.calls[1]?.[0]).toMatchObject({
      prompt: 'Regenerate completed image',
      model: 'gpt-image-2',
      size: '1x1',
    });
  });

  it('waits for terminal-reopen persistence before executing an image retry', async () => {
    const {
      taskQueueService,
      mocks,
      terminalReopenPersistenceReached,
      releaseTerminalReopenPersistence,
    } = await setupTaskQueueServiceHarness(
      [TaskStatus.COMPLETED, TaskStatus.COMPLETED],
      { blockTerminalReopenPersistence: true }
    );

    const task = taskQueueService.createTask(
      {
        prompt: 'Do not submit a retry before its processing state commits',
        model: 'gpt-image-2',
        size: '1x1',
      },
      TaskType.IMAGE
    );

    await flushAsyncWork();
    expect(mocks.generateImage).toHaveBeenCalledTimes(1);
    expect(taskQueueService.getTask(task.id)?.status).toBe(
      TaskStatus.COMPLETED
    );

    taskQueueService.retryTask(task.id, { allowCompleted: true });
    await terminalReopenPersistenceReached;

    expect(mocks.generateImage).toHaveBeenCalledTimes(1);

    releaseTerminalReopenPersistence();
    await flushAsyncWork();

    expect(mocks.generateImage).toHaveBeenCalledTimes(2);
  });

  it('rehydrates stripped edit params after restoreTasks before retry execution', async () => {
    const { taskQueueService, storedTasks, mocks } =
      await setupTaskQueueServiceHarness([TaskStatus.COMPLETED]);

    const restoredTask: Task = {
      id: 'task-image-edit-1',
      type: TaskType.IMAGE,
      status: TaskStatus.FAILED,
      params: {
        prompt: 'Retry restored edit',
        model: 'gpt-image-2',
        size: '1x1',
        generationMode: 'image_to_image',
        referenceImages: ['data:image/png;base64,restored-source'],
        maskImage: 'data:image/png;base64,restored-mask',
      },
      createdAt: 1,
      updatedAt: 1,
      error: {
        code: 'EXECUTION_ERROR',
        message: 'Image generation failed',
      },
    };

    storedTasks.set(restoredTask.id, clone(restoredTask));

    taskQueueService.restoreTasks([clone(restoredTask)]);

    expect(
      taskQueueService.getTask(restoredTask.id)?.params.referenceImages
    ).toBeUndefined();

    taskQueueService.retryTask(restoredTask.id);
    await flushAsyncWork();

    expect(mocks.generateImage).toHaveBeenCalledTimes(1);
    expect(mocks.generateImage.mock.calls[0]?.[0]).toMatchObject({
      generationMode: 'image_to_image',
      referenceImages: ['data:image/png;base64,restored-source'],
      maskImage: 'data:image/png;base64,restored-mask',
    });
  });

  it('claims an external task before persistence so startup restoration cannot misclassify it', async () => {
    const { taskQueueService } = await setupTaskQueueServiceHarness([
      TaskStatus.COMPLETED,
    ]);
    const task: Task = {
      id: 'task-external-startup-race',
      type: TaskType.IMAGE,
      status: TaskStatus.PROCESSING,
      params: {
        prompt: 'First image after configuring a key',
        model: 'gpt-image-2',
      },
      createdAt: 1,
      updatedAt: 1,
      executionPhase: TaskExecutionPhase.SUBMITTING,
    };

    taskQueueService.claimTaskForCurrentSession(task.id);
    expect(taskQueueService.isTaskOwnedByCurrentSession(task.id)).toBe(true);

    taskQueueService.restoreTasks([clone(task)]);
    expect(taskQueueService.isTaskOwnedByCurrentSession(task.id)).toBe(true);

    taskQueueService.trackExternalTask(clone(task));

    expect(taskQueueService.isTaskOwnedByCurrentSession(task.id)).toBe(true);
  });

  it('defers character tasks to the dedicated task executor instead of failing them in the media executor', async () => {
    const { taskQueueService, mocks } = await setupTaskQueueServiceHarness([
      TaskStatus.COMPLETED,
    ]);
    const createdStatuses: TaskStatus[] = [];
    const updatedStatuses: TaskStatus[] = [];
    const subscription = taskQueueService
      .observeTaskUpdates()
      .subscribe((event) => {
        if (event.type === 'taskCreated') {
          createdStatuses.push(event.task.status);
        } else if (event.type === 'taskUpdated') {
          updatedStatuses.push(event.task.status);
        }
      });

    const task = taskQueueService.createTask(
      {
        prompt: 'Extract this character',
        model: 'sora-2-character',
        sourceVideoTaskId: 'remote-video-1',
        sourceLocalTaskId: 'local-video-1',
        characterTimestamps: '0,5',
      },
      TaskType.CHARACTER
    );

    expect(task.status).toBe(TaskStatus.PENDING);
    expect(task.startedAt).toBeUndefined();
    expect(task.executionPhase).toBeUndefined();
    expect(createdStatuses).toEqual([TaskStatus.PENDING]);

    await flushAsyncWork();

    expect(taskQueueService.getTask(task.id)?.status).toBe(TaskStatus.PENDING);
    expect(mocks.generateImage).not.toHaveBeenCalled();
    expect(mocks.waitForTaskCompletion).not.toHaveBeenCalled();

    taskQueueService.updateTaskStatus(task.id, TaskStatus.FAILED, {
      error: {
        code: 'CHARACTER_ERROR',
        message: 'Character extraction failed',
      },
    });
    taskQueueService.retryTask(task.id);

    expect(taskQueueService.getTask(task.id)?.status).toBe(TaskStatus.PENDING);
    expect(taskQueueService.getTask(task.id)?.startedAt).toBeUndefined();
    expect(taskQueueService.getTask(task.id)?.executionPhase).toBeUndefined();
    expect(updatedStatuses.at(-1)).toBe(TaskStatus.PENDING);

    await flushAsyncWork();

    expect(taskQueueService.getTask(task.id)?.status).toBe(TaskStatus.PENDING);
    expect(mocks.generateImage).not.toHaveBeenCalled();
    expect(mocks.waitForTaskCompletion).not.toHaveBeenCalled();

    subscription.unsubscribe();
  });

  it('keeps a cancelled active task from being overwritten by late executor completion', async () => {
    const { taskQueueService, storedTasks, mocks } =
      await setupTaskQueueServiceHarness([TaskStatus.COMPLETED]);
    let finishExecutor!: () => void;
    let capturedSignal: AbortSignal | undefined;

    mocks.generateImage.mockImplementationOnce(async (_params, options) => {
      capturedSignal = options?.signal;
      await new Promise<void>((resolve) => {
        finishExecutor = resolve;
      });

      const storedTask = storedTasks.get('task-image-edit-1');
      storedTasks.set('task-image-edit-1', {
        ...storedTask,
        status: TaskStatus.COMPLETED,
        progress: 100,
        result: {
          url: 'https://example.com/late.png',
          format: 'png',
          size: 1,
        },
        completedAt: Date.now(),
        updatedAt: Date.now(),
      });
    });

    const task = taskQueueService.createTask(
      {
        prompt: 'Cancel this image',
        model: 'gpt-image-2',
        size: '1x1',
      },
      TaskType.IMAGE
    );

    await flushAsyncWork();

    expect(mocks.generateImage).toHaveBeenCalledTimes(1);
    expect(capturedSignal?.aborted).toBe(false);

    taskQueueService.cancelTask(task.id);

    expect(capturedSignal?.aborted).toBe(true);
    expect(taskQueueService.getTask(task.id)?.status).toBe(
      TaskStatus.CANCELLED
    );

    finishExecutor();
    await flushAsyncWork();

    expect(mocks.waitForTaskCompletion).not.toHaveBeenCalled();
    expect(taskQueueService.getTask(task.id)?.status).toBe(
      TaskStatus.CANCELLED
    );
    expect(storedTasks.get(task.id)?.status).toBe(TaskStatus.CANCELLED);
  });

  it('emits storage sync updates when completed result or insertion flag changes without status progress changes', async () => {
    const { taskQueueService } = await setupTaskQueueServiceHarness([
      TaskStatus.COMPLETED,
    ]);
    const task: Task = {
      id: 'task-storage-sync-1',
      type: TaskType.IMAGE,
      status: TaskStatus.COMPLETED,
      progress: 100,
      params: {
        prompt: 'Sync completed storage task',
        autoInsertToCanvas: true,
      },
      createdAt: 1,
      updatedAt: 1,
    };
    const updatedTasks: Task[] = [];

    taskQueueService.trackExternalTask(clone(task));
    const subscription = taskQueueService
      .observeTaskUpdates()
      .subscribe((event) => {
        if (event.type === 'taskUpdated') {
          updatedTasks.push(event.task);
        }
      });

    taskQueueService.syncTaskFromStorage(task.id, {
      status: TaskStatus.COMPLETED,
      progress: 100,
      completedAt: 2,
      result: {
        url: 'https://example.com/storage-result.png',
        format: 'png',
        size: 1,
      },
    });
    taskQueueService.syncTaskFromStorage(task.id, {
      status: TaskStatus.COMPLETED,
      progress: 100,
      insertedToCanvas: true,
    });

    expect(updatedTasks).toHaveLength(2);
    expect(taskQueueService.getTask(task.id)?.result?.url).toBe(
      'https://example.com/storage-result.png'
    );
    expect(taskQueueService.getTask(task.id)?.insertedToCanvas).toBe(true);

    subscription.unsubscribe();
  });

  it('persists invocation route for externally tracked video tasks', async () => {
    const { taskQueueService, storedTasks } =
      await setupTaskQueueServiceHarness([TaskStatus.COMPLETED]);
    const task: Task = {
      id: 'task-video-route-1',
      type: TaskType.VIDEO,
      status: TaskStatus.PROCESSING,
      remoteId: 'remote-video-1',
      executionPhase: TaskExecutionPhase.POLLING,
      params: {
        prompt: 'Resume original provider',
        model: 'happyhorse-1.0-t2v',
        modelRef: {
          profileId: 'happyhorse-profile',
          modelId: 'happyhorse-1.0-t2v',
        },
      },
      createdAt: 1,
      updatedAt: 1,
    };

    taskQueueService.trackExternalTask(clone(task));
    await flushAsyncWork();

    const stored = storedTasks.get(task.id);
    expect(stored?.remoteId).toBe('remote-video-1');
    expect(stored?.executionPhase).toBe('polling');
    expect(stored?.params.modelRef).toEqual({
      profileId: 'happyhorse-profile',
      modelId: 'happyhorse-1.0-t2v',
    });
    expect(stored?.invocationRoute).toMatchObject({
      operation: 'video',
      providerProfileId: 'happyhorse-profile',
      modelId: 'happyhorse-1.0-t2v',
      binding: {
        id: 'happyhorse-profile:happyhorse-1.0-t2v:video',
        pollPathTemplate: '/videos/{taskId}',
      },
    });
  });

  it('emits storage sync updates when invocation route changes', async () => {
    const { taskQueueService } = await setupTaskQueueServiceHarness([
      TaskStatus.COMPLETED,
    ]);
    const task: Task = {
      id: 'task-video-route-sync-1',
      type: TaskType.VIDEO,
      status: TaskStatus.PROCESSING,
      params: {
        prompt: 'Sync route',
        model: 'happyhorse-1.0-t2v',
      },
      createdAt: 1,
      updatedAt: 1,
    };
    const updatedTasks: Task[] = [];

    taskQueueService.trackExternalTask(clone(task));
    const subscription = taskQueueService
      .observeTaskUpdates()
      .subscribe((event) => {
        if (event.type === 'taskUpdated') {
          updatedTasks.push(event.task);
        }
      });

    taskQueueService.syncTaskFromStorage(task.id, {
      invocationRoute: {
        operation: 'video',
        providerProfileId: 'happyhorse-profile',
        modelId: 'happyhorse-1.0-t2v',
        binding: {
          id: 'happyhorse-profile:happyhorse-1.0-t2v:video',
          pollPathTemplate: '/videos/{taskId}',
        },
      },
    });

    expect(updatedTasks).toHaveLength(1);
    expect(
      taskQueueService.getTask(task.id)?.invocationRoute?.providerProfileId
    ).toBe('happyhorse-profile');

    subscription.unsubscribe();
  });
});
