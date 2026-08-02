import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  TaskExecutionPhase,
  TaskStatus,
  TaskType,
} from '../../types/task.types';
import type { Task } from '../../types/task.types';
import type {
  ExecutionOptions,
  ImageGenerationParams,
} from '../media-executor/types';
import type { ImageTaskAttemptWriteOptions } from '../media-executor/task-storage-writer';
import type { NormalizedImageRequest } from '../image-invocation';

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function deferred<T = void>(): {
  promise: Promise<T>;
  resolve: (value: T) => void;
} {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
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
    rejectCancelledAfterCompleted?: boolean;
    emitLateImageProgress?: boolean;
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
      options.rejectCancelledAfterCompleted &&
      task.status === TaskStatus.CANCELLED &&
      storedTasks.get(task.id)?.status === TaskStatus.COMPLETED
    ) {
      return false;
    }
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
  let imageExecutionCount = 0;

  const mocks = {
    analyticsTrack: vi.fn(),
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
    generateImage: vi.fn(async (params?: any, executionOptions?: any) => {
      const taskId = params?.taskId as string;
      const currentTask = storedTasks.get(taskId);
      const callIndex = imageExecutionCount;
      imageExecutionCount += 1;
      const status =
        statusSequence[callIndex] || statusSequence[statusSequence.length - 1];
      const now = Date.now();
      const terminalTask: any = {
        ...clone(currentTask),
        status,
        updatedAt: now,
      };
      if (status === TaskStatus.COMPLETED) {
        terminalTask.progress = 100;
        terminalTask.result = {
          url: 'https://example.com/out.png',
          format: 'png',
          size: 1,
        };
        terminalTask.completedAt = now;
      } else if (status === TaskStatus.FAILED) {
        terminalTask.error = {
          code: 'EXECUTION_ERROR',
          message: 'Image generation failed',
        };
        terminalTask.completedAt = now;
      }
      delete terminalTask.executionPhase;
      storedTasks.set(taskId, terminalTask);
      if (options.emitLateImageProgress) {
        setTimeout(
          () =>
            executionOptions?.onProgress?.({
              progress: 40,
              phase: TaskExecutionPhase.SUBMITTING,
            }),
          0
        );
      }
      return {
        taskId,
        status: terminalTask.status,
        attemptStartedAt: executionOptions?.imageAttemptStartedAt,
        progress: terminalTask.progress,
        result: terminalTask.result,
        error: terminalTask.error,
        completedAt: terminalTask.completedAt,
        updatedAt: terminalTask.updatedAt,
      };
    }),
    generateVideo: vi.fn(async () => undefined),
    updateStatus: vi.fn(
      async (
        taskId: string,
        status: TaskStatus,
        writeOptions?: ImageTaskAttemptWriteOptions
      ) => {
        const task = storedTasks.get(taskId);
        if (!task) return false;
        if (
          task.type === TaskType.IMAGE &&
          writeOptions?.expectedStartedAt !== undefined &&
          task.startedAt !== writeOptions.expectedStartedAt
        ) {
          return false;
        }
        storedTasks.set(taskId, {
          ...task,
          status,
          startedAt: task.startedAt || Date.now(),
          updatedAt: Date.now(),
        });
        return true;
      }
    ),
    completeTask: vi.fn(
      async (
        taskId: string,
        result: NonNullable<Task['result']>,
        writeOptions?: ImageTaskAttemptWriteOptions
      ) => {
        const task = storedTasks.get(taskId);
        if (!task) return;
        if (
          task.type === TaskType.IMAGE &&
          writeOptions?.expectedStartedAt !== undefined &&
          task.startedAt !== writeOptions.expectedStartedAt
        ) {
          return clone(task);
        }
        const completedTask = {
          ...task,
          status: TaskStatus.COMPLETED,
          result: clone(result),
          progress: 100,
          completedAt: Date.now(),
          updatedAt: Date.now(),
        };
        delete completedTask.executionPhase;
        storedTasks.set(taskId, completedTask);
        return clone(completedTask);
      }
    ),
    markInserted: vi.fn(async (taskId: string) => {
      const task = storedTasks.get(taskId);
      if (!task) return;
      storedTasks.set(taskId, {
        ...task,
        insertedToCanvas: true,
        updatedAt: Date.now(),
      });
    }),
    markSaved: vi.fn(async (taskId: string) => {
      const task = storedTasks.get(taskId);
      if (!task) return;
      storedTasks.set(taskId, {
        ...task,
        savedToLibrary: true,
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
      const completedTask = storedTasks.get(params.taskId);
      return {
        taskId: params.taskId,
        status: 'completed',
        progress: 100,
        result: clone(completedTask.result),
        completedAt: completedTask.completedAt,
        updatedAt: completedTask.updatedAt,
      };
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
      markInserted: mocks.markInserted,
      markSaved: mocks.markSaved,
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
        generateVideo: mocks.generateVideo,
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

  const resolveInvocationPlanFromRoute = vi.fn(
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
          submitMethod: 'POST',
          pollPathTemplate: '/videos/{taskId}',
          pollMethod: 'GET',
          priority: 100,
          confidence: 'high',
          source: 'template',
        },
      };
    }
  );

  vi.doMock('../provider-routing', () => ({
    resolveInvocationPlanFromRoute,
  }));

  const resolveNormalizedImageInvocation = vi.fn(
    (request: NormalizedImageRequest) => {
      const preferredRequestSchema = request.referenceImages.length
        ? ['openai.image.gpt-edit-form']
        : ['openai.image.gpt-generation-json'];
      const plan = resolveInvocationPlanFromRoute(
        'image',
        request.modelRef || request.model,
        {
          bindingId: request.bindingId,
          preferredRequestSchema,
        }
      );
      if (!plan) {
        throw new Error('Missing image invocation plan fixture');
      }
      return {
        request,
        intent: request.referenceImages.length ? 'edit' : 'generation',
        preferredRequestSchema,
        plan,
        modelRef: plan.modelRef,
        modelId: plan.modelRef.modelId,
        adapter: { id: 'test-image-adapter', kind: 'image' },
        adapterContext: { binding: plan.binding, provider: plan.provider },
        capabilities: {},
        telemetry: {},
      };
    }
  );

  vi.doMock('../image-invocation', async (importOriginal) => ({
    ...(await importOriginal<typeof import('../image-invocation')>()),
    resolveNormalizedImageInvocation,
  }));

  vi.doMock('../../utils/posthog-analytics', () => ({
    analytics: {
      track: mocks.analyticsTrack,
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
      resolveInvocationPlanFromRoute,
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
    expect(mocks.generateImage.mock.calls[1]?.[0]?.request).toMatchObject({
      generationMode: 'image_to_image',
      referenceImages: ['data:image/png;base64,source'],
      maskImage: 'data:image/png;base64,mask',
      outputFormat: 'png',
    });
    expect(storedTasks.get(task.id)?.params.referenceImages).toEqual([
      'data:image/png;base64,source',
    ]);
  });

  it('normalizes a legacy singular uploaded image before the snapshotted edit route executes', async () => {
    const { taskQueueService, mocks } = await setupTaskQueueServiceHarness([
      TaskStatus.COMPLETED,
    ]);
    const modelRef = {
      profileId: 'provider-edit',
      modelId: 'gpt-image-2',
    };
    const uploadedImage = {
      url: 'data:image/png;base64,source',
    };

    const task = taskQueueService.createTask(
      {
        prompt: 'Legacy singular image edit',
        model: modelRef.modelId,
        modelRef,
        uploadedImage,
      },
      TaskType.IMAGE
    );

    await flushAsyncWork();

    expect(task.invocationRoute).toMatchObject({
      providerProfileId: modelRef.profileId,
      modelId: modelRef.modelId,
    });
    expect(mocks.resolveInvocationPlanFromRoute).toHaveBeenCalledWith(
      'image',
      modelRef,
      expect.objectContaining({
        preferredRequestSchema: ['openai.image.gpt-edit-form'],
      })
    );
    expect(mocks.resolveInvocationPlanFromRoute).toHaveBeenCalledTimes(1);
    expect(
      mocks.generateImage.mock.calls[0]?.[0]?.resolvedInvocation
    ).toMatchObject({
      modelRef,
      plan: {
        binding: { id: 'provider-edit:gpt-image-2:image' },
      },
    });
    expect(mocks.generateImage).toHaveBeenCalledWith(
      expect.objectContaining({
        request: expect.objectContaining({
          model: modelRef.modelId,
          modelRef,
          referenceImages: [uploadedImage.url],
        }),
      }),
      expect.any(Object)
    );
  });

  it('reuses the resolved invocation after initial persistence without replanning', async () => {
    const { taskQueueService, mocks } = await setupTaskQueueServiceHarness(
      [TaskStatus.COMPLETED],
      { delayInitialImagePersistenceMs: 30 }
    );
    const modelRef = {
      profileId: 'provider-stable',
      modelId: 'stable-image-model',
    };

    const task = taskQueueService.createTask(
      {
        prompt: 'Keep the submitted endpoint contract',
        model: modelRef.modelId,
        modelRef,
      },
      TaskType.IMAGE
    );
    const plannedInvocation = task.invocationRoute;
    mocks.resolveInvocationPlanFromRoute.mockImplementation(() => {
      throw new Error('settings changed after planning');
    });

    await new Promise((resolve) => setTimeout(resolve, 60));
    await flushAsyncWork();

    expect(mocks.resolveInvocationPlanFromRoute).toHaveBeenCalledTimes(1);
    expect(mocks.generateImage).toHaveBeenCalledTimes(1);
    expect(
      mocks.generateImage.mock.calls[0]?.[0]?.resolvedInvocation?.plan.binding
        .id
    ).toBe(plannedInvocation?.binding?.id);
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
    expect(storedTasks.get(task.id)?.executionPhase).toBeUndefined();
    expect(taskQueueService.getTask(task.id)?.executionPhase).toBeUndefined();
    expect(mocks.waitForTaskCompletion).not.toHaveBeenCalled();

    taskQueueService.markAsInserted(task.id, 'auto_insert');
    await flushAsyncWork();

    expect(storedTasks.get(task.id)).toMatchObject({
      status: TaskStatus.COMPLETED,
      insertedToCanvas: true,
    });
    expect(storedTasks.get(task.id)?.executionPhase).toBeUndefined();
  });

  it('uses direct image outcomes for failures without entering the IndexedDB poller', async () => {
    const { taskQueueService, mocks } = await setupTaskQueueServiceHarness([
      TaskStatus.FAILED,
    ]);

    const task = taskQueueService.createTask(
      {
        prompt: 'Fail without a second completion channel',
        model: 'gpt-image-2',
        size: '1x1',
      },
      TaskType.IMAGE
    );

    await flushAsyncWork();

    expect(taskQueueService.getTask(task.id)).toMatchObject({
      status: TaskStatus.FAILED,
      error: { code: 'EXECUTION_ERROR' },
    });
    expect(mocks.waitForTaskCompletion).not.toHaveBeenCalled();
  });

  it('ignores an executor progress callback that arrives after image completion', async () => {
    const { taskQueueService } = await setupTaskQueueServiceHarness(
      [TaskStatus.COMPLETED],
      { emitLateImageProgress: true }
    );

    const task = taskQueueService.createTask(
      {
        prompt: 'Late image progress callback',
        model: 'gemini-3.1-flash-image-preview',
        size: '1x1',
      },
      TaskType.IMAGE
    );

    await flushAsyncWork();

    expect(taskQueueService.getTask(task.id)).toMatchObject({
      status: TaskStatus.COMPLETED,
      progress: 100,
      result: { url: 'https://example.com/out.png' },
    });
    expect(taskQueueService.getTask(task.id)?.executionPhase).toBeUndefined();
  });

  it('applies a cancelled executor outcome without result or IndexedDB polling', async () => {
    const { taskQueueService, mocks } = await setupTaskQueueServiceHarness([
      TaskStatus.CANCELLED,
    ]);

    const task = taskQueueService.createTask(
      {
        prompt: 'Executor observes cancellation before completion',
        model: 'gpt-image-2',
        size: '1x1',
      },
      TaskType.IMAGE
    );
    await flushAsyncWork();

    expect(taskQueueService.getTask(task.id)).toMatchObject({
      status: TaskStatus.CANCELLED,
    });
    expect(taskQueueService.getTask(task.id)?.result).toBeUndefined();
    expect(taskQueueService.getTask(task.id)?.executionPhase).toBeUndefined();
    expect(mocks.waitForTaskCompletion).not.toHaveBeenCalled();
    expect(
      mocks.analyticsTrack.mock.calls.filter(
        ([eventName]) => eventName === 'generation_task_cancelled'
      )
    ).toHaveLength(1);
  });

  it('keeps active image progress below 100 until the terminal outcome', async () => {
    const { taskQueueService, mocks } = await setupTaskQueueServiceHarness([
      TaskStatus.COMPLETED,
    ]);
    const activeProgress: number[] = [];
    const subscription = taskQueueService
      .observeTaskUpdates()
      .subscribe((event) => {
        if (
          event.type === 'taskUpdated' &&
          event.task.type === TaskType.IMAGE &&
          event.task.status === TaskStatus.PROCESSING &&
          typeof event.task.progress === 'number'
        ) {
          activeProgress.push(event.task.progress);
        }
      });
    mocks.generateImage.mockImplementationOnce(async (params, options) => {
      options?.onProgress?.({ progress: 100, phase: 'downloading' });
      const now = Date.now();
      return {
        taskId: params.taskId,
        status: 'completed',
        progress: 100,
        result: {
          url: 'https://example.com/terminal-progress.png',
          format: 'png',
          size: 1,
        },
        completedAt: now,
        updatedAt: now,
      };
    });

    const task = taskQueueService.createTask(
      {
        prompt: 'Only terminal state may expose 100 percent',
        model: 'gpt-image-2',
        size: '1x1',
      },
      TaskType.IMAGE
    );
    await flushAsyncWork();

    expect(activeProgress).toContain(95);
    expect(activeProgress.every((progress) => progress < 100)).toBe(true);
    expect(taskQueueService.getTask(task.id)).toMatchObject({
      status: TaskStatus.COMPLETED,
      progress: 100,
    });
    subscription.unsubscribe();
  });

  it('keeps the IndexedDB completion channel for non-image executors', async () => {
    const { taskQueueService, mocks } = await setupTaskQueueServiceHarness([
      TaskStatus.COMPLETED,
    ]);

    taskQueueService.createTask(
      {
        prompt: 'Video still uses the legacy result channel',
        model: 'video-model',
      },
      TaskType.VIDEO
    );

    await flushAsyncWork();

    expect(mocks.generateVideo).toHaveBeenCalledTimes(1);
    expect(mocks.waitForTaskCompletion).toHaveBeenCalledTimes(1);
  });

  it('waits on the in-memory task stream and closes the subscription race', async () => {
    const { taskQueueService } = await setupTaskQueueServiceHarness([
      TaskStatus.COMPLETED,
    ]);
    const activeTask: Task = {
      id: 'task-event-race',
      type: TaskType.IMAGE,
      status: TaskStatus.PROCESSING,
      params: { prompt: 'Complete between check and subscription' },
      createdAt: 1,
      updatedAt: 1,
    };
    const completedTask: Task = {
      ...activeTask,
      status: TaskStatus.COMPLETED,
      progress: 100,
      result: {
        url: 'https://example.com/event-result.png',
        format: 'png',
        size: 1,
      },
      completedAt: 2,
      updatedAt: 2,
    };
    taskQueueService.trackExternalTask(activeTask);

    const taskMap = (taskQueueService as any).tasks as Map<string, Task>;
    const originalGet = taskMap.get.bind(taskMap);
    let taskReads = 0;
    const getSpy = vi.spyOn(taskMap, 'get').mockImplementation((taskId) => {
      if (taskId === activeTask.id) {
        taskReads += 1;
        return taskReads === 1 ? activeTask : completedTask;
      }
      return originalGet(taskId);
    });

    await expect(
      taskQueueService.waitForTaskTerminalState(activeTask.id, { timeout: 50 })
    ).resolves.toEqual({ success: true, task: completedTask });
    expect(taskReads).toBe(2);

    getSpy.mockRestore();
  });

  it('removes the in-memory task subscription when waiting is aborted', async () => {
    const { taskQueueService } = await setupTaskQueueServiceHarness([
      TaskStatus.COMPLETED,
    ]);
    const activeTask: Task = {
      id: 'task-event-abort',
      type: TaskType.IMAGE,
      status: TaskStatus.PROCESSING,
      params: { prompt: 'Abort event wait' },
      createdAt: 1,
      updatedAt: 1,
    };
    taskQueueService.trackExternalTask(activeTask);

    const subject = (taskQueueService as any).taskUpdates$ as {
      observers: unknown[];
    };
    const observersBefore = subject.observers.length;
    const controller = new AbortController();
    const wait = taskQueueService.waitForTaskTerminalState(activeTask.id, {
      signal: controller.signal,
      timeout: 50,
    });
    expect(subject.observers).toHaveLength(observersBefore + 1);

    controller.abort();

    await expect(wait).resolves.toEqual({
      success: false,
      error: 'Task wait cancelled',
    });
    expect(subject.observers).toHaveLength(observersBefore);
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

    task.params.modelRef = {
      profileId: 'provider-b',
      modelId: 'shared-image-model',
    };

    taskQueueService.retryTask(task.id);
    await flushAsyncWork();

    expect(mocks.generateImage).toHaveBeenCalledTimes(2);
    expect(mocks.generateImage.mock.calls[0]?.[0]?.request.modelRef).toEqual(
      modelRef
    );
    expect(mocks.generateImage.mock.calls[1]?.[0]?.request.modelRef).toEqual(
      modelRef
    );
    expect(mocks.generateImage.mock.calls[0]?.[0]?.request.bindingId).toBe(
      'provider-a:shared-image-model:image'
    );
    expect(mocks.generateImage.mock.calls[1]?.[0]?.request.bindingId).toBe(
      'provider-a:shared-image-model:image'
    );
  });

  it('allows explicit manual retry for completed image tasks and clears stale results', async () => {
    const { taskQueueService, storedTasks, mocks } =
      await setupTaskQueueServiceHarness([
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

    taskQueueService.markAsInserted(task.id);
    taskQueueService.markAsSaved(task.id);
    await flushAsyncWork();
    expect(taskQueueService.getTask(task.id)).toMatchObject({
      insertedToCanvas: true,
      savedToLibrary: true,
    });

    taskQueueService.retryTask(task.id, { allowCompleted: true });

    expect(taskQueueService.getTask(task.id)?.status).toBe(
      TaskStatus.PROCESSING
    );
    expect(taskQueueService.getTask(task.id)?.result).toBeUndefined();
    expect(taskQueueService.getTask(task.id)?.insertedToCanvas).toBe(false);
    expect(taskQueueService.getTask(task.id)?.savedToLibrary).toBe(false);

    await flushAsyncWork();

    expect(mocks.generateImage).toHaveBeenCalledTimes(2);
    expect(storedTasks.get(task.id)).toMatchObject({
      insertedToCanvas: false,
      savedToLibrary: false,
    });
    expect(mocks.generateImage.mock.calls[1]?.[0]?.request).toMatchObject({
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
    expect(mocks.generateImage.mock.calls[0]?.[0]?.request).toMatchObject({
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

  it.each([TaskStatus.CANCELLED, TaskStatus.FAILED])(
    'keeps a retried processing image attempt isolated from a late %s attempt result',
    async (firstTerminalStatus) => {
      const { taskQueueService, storedTasks, mocks } =
        await setupTaskQueueServiceHarness([TaskStatus.COMPLETED]);
      const firstAttemptStarted = deferred<number>();
      const releaseFirstAttempt = deferred();
      const currentAttemptStarted = deferred<number>();
      const releaseCurrentAttempt = deferred();
      const currentAttemptCompleted = deferred();
      let executionCall = 0;

      mocks.generateImage.mockImplementation(
        async (
          params: ImageGenerationParams,
          executionOptions: ExecutionOptions
        ) => {
          const callIndex = executionCall;
          executionCall += 1;
          const attemptStartedAt =
            executionOptions.imageAttemptStartedAt as number;
          const result = {
            url:
              callIndex === 0
                ? 'https://example.com/stale-attempt.png'
                : 'https://example.com/current-attempt.png',
            format: 'png',
            size: 1,
          };

          if (callIndex === 0) {
            firstAttemptStarted.resolve(attemptStartedAt);
            await releaseFirstAttempt.promise;
            executionOptions.onProgress?.({
              progress: 88,
              phase: TaskExecutionPhase.DOWNLOADING,
            });
          } else {
            currentAttemptStarted.resolve(attemptStartedAt);
            await releaseCurrentAttempt.promise;
          }

          const storedTask = await mocks.completeTask(params.taskId, result, {
            expectedStartedAt: attemptStartedAt,
          });
          if (storedTask.startedAt !== attemptStartedAt) {
            return {
              taskId: params.taskId,
              status: 'stale',
              attemptStartedAt,
              updatedAt: storedTask.updatedAt,
            };
          }

          if (callIndex === 1) {
            currentAttemptCompleted.resolve();
          }
          return {
            taskId: params.taskId,
            status: 'completed',
            attemptStartedAt,
            progress: 100,
            result: clone(storedTask.result),
            completedAt: storedTask.completedAt,
            updatedAt: storedTask.updatedAt,
          };
        }
      );

      const task = taskQueueService.createTask(
        {
          prompt: 'Retry while an old provider promise is still pending',
          model: 'gpt-image-2',
          size: '1x1',
        },
        TaskType.IMAGE
      );
      const firstStartedAt = await firstAttemptStarted.promise;

      if (firstTerminalStatus === TaskStatus.CANCELLED) {
        taskQueueService.cancelTask(task.id);
        await flushAsyncWork();
      } else {
        await taskQueueService.updateTaskStatus(task.id, TaskStatus.FAILED, {
          error: {
            code: 'FIRST_ATTEMPT_FAILED',
            message: 'Retryable first attempt failure',
          },
        });
      }
      expect(taskQueueService.getTask(task.id)?.status).toBe(
        firstTerminalStatus
      );

      taskQueueService.retryTask(task.id);
      const currentStartedAt = await currentAttemptStarted.promise;
      expect(currentStartedAt).toBeGreaterThan(firstStartedAt);
      expect(taskQueueService.getTask(task.id)).toMatchObject({
        status: TaskStatus.PROCESSING,
        startedAt: currentStartedAt,
      });

      releaseFirstAttempt.resolve();
      await flushAsyncWork();

      expect(taskQueueService.getTask(task.id)).toMatchObject({
        status: TaskStatus.PROCESSING,
        startedAt: currentStartedAt,
      });
      expect(taskQueueService.getTask(task.id)?.progress).not.toBe(88);
      expect(storedTasks.get(task.id)).toMatchObject({
        status: TaskStatus.PROCESSING,
        startedAt: currentStartedAt,
      });
      expect(storedTasks.get(task.id)?.result).toBeUndefined();

      releaseCurrentAttempt.resolve();
      await currentAttemptCompleted.promise;
      await flushAsyncWork();

      expect(mocks.generateImage).toHaveBeenCalledTimes(2);
      expect(mocks.generateImage.mock.calls[0]?.[1]).toMatchObject({
        imageAttemptStartedAt: firstStartedAt,
      });
      expect(mocks.generateImage.mock.calls[1]?.[1]).toMatchObject({
        imageAttemptStartedAt: currentStartedAt,
      });
      expect(taskQueueService.getTask(task.id)).toMatchObject({
        status: TaskStatus.COMPLETED,
        startedAt: currentStartedAt,
        result: { url: 'https://example.com/current-attempt.png' },
      });

      expect(storedTasks.get(task.id)).toMatchObject({
        status: TaskStatus.COMPLETED,
        startedAt: currentStartedAt,
        result: { url: 'https://example.com/current-attempt.png' },
      });
      expect(taskQueueService.getTask(task.id)).toMatchObject({
        status: TaskStatus.COMPLETED,
        startedAt: currentStartedAt,
        result: { url: 'https://example.com/current-attempt.png' },
      });
      expect(
        mocks.completeTask.mock.calls.some(
          ([, result, writeOptions]) =>
            result.url === 'https://example.com/stale-attempt.png' &&
            writeOptions.expectedStartedAt === firstStartedAt
        )
      ).toBe(true);
    }
  );

  it('rejects a late external image outcome after in-memory cancellation', async () => {
    const { taskQueueService } = await setupTaskQueueServiceHarness([
      TaskStatus.COMPLETED,
    ]);
    const task: Task = {
      id: 'task-external-cancel-race',
      type: TaskType.IMAGE,
      status: TaskStatus.PROCESSING,
      params: { prompt: 'Cancel before an external executor returns' },
      createdAt: 1,
      updatedAt: 1,
    };
    taskQueueService.trackExternalTask(task);
    taskQueueService.cancelTask(task.id);

    const applied = taskQueueService.applyImageExecutionOutcome({
      taskId: task.id,
      status: 'completed',
      progress: 100,
      result: {
        url: 'https://example.com/late-external.png',
        format: 'png',
        size: 1,
      },
      completedAt: 3,
      updatedAt: 3,
    });

    expect(applied?.status).toBe(TaskStatus.CANCELLED);
    expect(applied?.result).toBeUndefined();
    expect(taskQueueService.getTask(task.id)?.status).toBe(
      TaskStatus.CANCELLED
    );
  });

  it('applies each terminal image outcome idempotently with one event and one analytic', async () => {
    const { taskQueueService, mocks } = await setupTaskQueueServiceHarness([
      TaskStatus.COMPLETED,
    ]);
    const updatedTaskIds: string[] = [];
    const subscription = taskQueueService
      .observeTaskUpdates()
      .subscribe((event) => {
        if (event.type === 'taskUpdated') {
          updatedTaskIds.push(event.task.id);
        }
      });
    const cases = [
      {
        status: 'completed' as const,
        eventName: 'generation_task_completed',
        result: {
          url: 'https://example.com/idempotent.png',
          format: 'png',
          size: 1,
        },
      },
      {
        status: 'failed' as const,
        eventName: 'generation_task_failed',
        error: { code: 'IMAGE_FAILED', message: 'expected failure' },
      },
      {
        status: 'cancelled' as const,
        eventName: 'generation_task_cancelled',
      },
    ];

    for (const [index, terminalCase] of cases.entries()) {
      const task: Task = {
        id: `task-idempotent-${terminalCase.status}`,
        type: TaskType.IMAGE,
        status: TaskStatus.PROCESSING,
        params: { prompt: `Terminal case ${terminalCase.status}` },
        createdAt: 1,
        updatedAt: 1,
      };
      taskQueueService.trackExternalTask(task);
      const outcome = {
        taskId: task.id,
        status: terminalCase.status,
        progress: terminalCase.status === 'completed' ? 100 : undefined,
        result: terminalCase.result,
        error: terminalCase.error,
        completedAt: index + 2,
        updatedAt: index + 2,
      };

      taskQueueService.applyImageExecutionOutcome(outcome);
      taskQueueService.applyImageExecutionOutcome(outcome);

      expect(
        updatedTaskIds.filter((updatedTaskId) => updatedTaskId === task.id)
      ).toHaveLength(1);
      expect(
        mocks.analyticsTrack.mock.calls.filter(
          ([eventName]) => eventName === terminalCase.eventName
        )
      ).toHaveLength(1);
    }

    subscription.unsubscribe();
  });

  it('reconciles memory when completion commits before cancellation persistence', async () => {
    const { taskQueueService, storedTasks, mocks } =
      await setupTaskQueueServiceHarness([TaskStatus.COMPLETED], {
        rejectCancelledAfterCompleted: true,
      });
    const task: Task = {
      id: 'task-completion-wins-cancel-race',
      type: TaskType.IMAGE,
      status: TaskStatus.PROCESSING,
      params: { prompt: 'Completion already committed' },
      createdAt: 1,
      updatedAt: 1,
    };
    taskQueueService.trackExternalTask(task);
    await flushAsyncWork();

    const completedTask: Task = {
      ...task,
      status: TaskStatus.COMPLETED,
      progress: 100,
      result: {
        url: 'https://example.com/already-committed.png',
        format: 'png',
        size: 1,
      },
      completedAt: 2,
      updatedAt: 2,
    };
    storedTasks.set(task.id, clone(completedTask));

    taskQueueService.cancelTask(task.id);
    expect(taskQueueService.getTask(task.id)?.status).toBe(
      TaskStatus.CANCELLED
    );

    await flushAsyncWork();

    expect(taskQueueService.getTask(task.id)).toMatchObject({
      status: TaskStatus.COMPLETED,
      result: { url: 'https://example.com/already-committed.png' },
    });
    expect(storedTasks.get(task.id)?.status).toBe(TaskStatus.COMPLETED);
    expect(
      mocks.analyticsTrack.mock.calls.filter(
        ([eventName]) => eventName === 'generation_task_completed'
      )
    ).toHaveLength(1);
    expect(
      mocks.analyticsTrack.mock.calls.filter(
        ([eventName]) => eventName === 'generation_task_cancelled'
      )
    ).toHaveLength(0);
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

  it('does not regress durable flags from a stale storage snapshot', async () => {
    const { taskQueueService } = await setupTaskQueueServiceHarness([
      TaskStatus.COMPLETED,
    ]);
    const task: Task = {
      id: 'task-storage-sync-monotonic-flags',
      type: TaskType.IMAGE,
      status: TaskStatus.COMPLETED,
      progress: 100,
      insertedToCanvas: true,
      savedToLibrary: true,
      params: { prompt: 'Keep committed durable flags' },
      result: {
        url: 'https://example.com/inserted-and-saved.png',
        format: 'png',
        size: 1,
      },
      createdAt: 1,
      completedAt: 2,
      updatedAt: 2,
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
      insertedToCanvas: false,
      savedToLibrary: false,
    });

    expect(taskQueueService.getTask(task.id)).toMatchObject({
      insertedToCanvas: true,
      savedToLibrary: true,
    });
    expect(updatedTasks).toHaveLength(0);

    subscription.unsubscribe();
  });

  it('does not reopen a terminal in-memory task from a stale storage sync', async () => {
    const { taskQueueService } = await setupTaskQueueServiceHarness([
      TaskStatus.COMPLETED,
    ]);
    const task: Task = {
      id: 'task-storage-sync-terminal-regression',
      type: TaskType.IMAGE,
      status: TaskStatus.COMPLETED,
      progress: 100,
      params: { prompt: 'Keep terminal state irreversible' },
      result: {
        url: 'https://example.com/terminal.png',
        format: 'png',
        size: 1,
      },
      createdAt: 1,
      completedAt: 2,
      updatedAt: 2,
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
      status: TaskStatus.PROCESSING,
      progress: 40,
      executionPhase: TaskExecutionPhase.SUBMITTING,
    });

    expect(taskQueueService.getTask(task.id)).toMatchObject({
      status: TaskStatus.COMPLETED,
      progress: 100,
      result: { url: 'https://example.com/terminal.png' },
    });
    expect(taskQueueService.getTask(task.id)?.executionPhase).toBeUndefined();
    expect(updatedTasks).toHaveLength(0);

    subscription.unsubscribe();
  });

  it('ignores late progress and active status callbacks after completion', async () => {
    const { taskQueueService, mocks, storedTasks } =
      await setupTaskQueueServiceHarness([TaskStatus.COMPLETED]);
    const task: Task = {
      id: 'task-late-active-callbacks-after-completion',
      type: TaskType.IMAGE,
      status: TaskStatus.COMPLETED,
      progress: 100,
      params: { prompt: 'Ignore late callbacks' },
      result: {
        url: 'https://example.com/completed.png',
        format: 'png',
        size: 1,
      },
      createdAt: 1,
      completedAt: 2,
      updatedAt: 2,
    };

    taskQueueService.trackExternalTask(clone(task));
    await flushAsyncWork();
    const saveCountBeforeLateCallbacks = mocks.saveTask.mock.calls.length;
    const updatedTasks: Task[] = [];
    const subscription = taskQueueService
      .observeTaskUpdates()
      .subscribe((event) => {
        if (event.type === 'taskUpdated') {
          updatedTasks.push(event.task);
        }
      });

    taskQueueService.updateTaskProgress(task.id, 40);
    taskQueueService.updateTaskStatus(task.id, TaskStatus.PROCESSING, {
      executionPhase: TaskExecutionPhase.SUBMITTING,
    });
    await flushAsyncWork();

    expect(taskQueueService.getTask(task.id)).toMatchObject({
      status: TaskStatus.COMPLETED,
      progress: 100,
      result: { url: 'https://example.com/completed.png' },
    });
    expect(taskQueueService.getTask(task.id)?.executionPhase).toBeUndefined();
    expect(storedTasks.get(task.id)).toMatchObject({
      status: TaskStatus.COMPLETED,
      progress: 100,
    });
    expect(mocks.saveTask).toHaveBeenCalledTimes(saveCountBeforeLateCallbacks);
    expect(updatedTasks).toHaveLength(0);

    subscription.unsubscribe();
  });

  it('preserves durable flags while restoring a newer same-state snapshot', async () => {
    const { taskQueueService } = await setupTaskQueueServiceHarness([
      TaskStatus.COMPLETED,
    ]);
    const task: Task = {
      id: 'task-restore-monotonic-flags',
      type: TaskType.IMAGE,
      status: TaskStatus.COMPLETED,
      progress: 100,
      insertedToCanvas: true,
      savedToLibrary: true,
      params: { prompt: 'Restore without losing durable facts' },
      result: {
        url: 'https://example.com/original.png',
        format: 'png',
        size: 1,
      },
      createdAt: 1,
      completedAt: 1,
      updatedAt: 1,
    };

    taskQueueService.trackExternalTask(clone(task));
    taskQueueService.restoreTasks([
      {
        ...clone(task),
        insertedToCanvas: false,
        savedToLibrary: false,
        result: {
          url: 'https://example.com/newer.png',
          format: 'png',
          size: 1,
        },
        completedAt: 2,
        updatedAt: 2,
      },
    ]);

    expect(taskQueueService.getTask(task.id)).toMatchObject({
      insertedToCanvas: true,
      savedToLibrary: true,
      result: { url: 'https://example.com/newer.png' },
      updatedAt: 2,
    });
  });

  it('does not reopen a terminal task from a newer ordinary restore snapshot', async () => {
    const { taskQueueService } = await setupTaskQueueServiceHarness([
      TaskStatus.COMPLETED,
    ]);
    const completedTask: Task = {
      id: 'task-restore-terminal-regression',
      type: TaskType.IMAGE,
      status: TaskStatus.COMPLETED,
      progress: 100,
      params: { prompt: 'Restore keeps terminal state' },
      result: {
        url: 'https://example.com/completed-before-restore.png',
        format: 'png',
        size: 1,
      },
      createdAt: 1,
      completedAt: 1,
      updatedAt: 1,
    };

    taskQueueService.trackExternalTask(clone(completedTask));
    taskQueueService.restoreTasks([
      {
        ...clone(completedTask),
        status: TaskStatus.PROCESSING,
        progress: 40,
        result: undefined,
        completedAt: undefined,
        executionPhase: TaskExecutionPhase.SUBMITTING,
        updatedAt: 2,
      },
    ]);

    expect(taskQueueService.getTask(completedTask.id)).toMatchObject({
      status: TaskStatus.COMPLETED,
      progress: 100,
      result: {
        url: 'https://example.com/completed-before-restore.png',
      },
      updatedAt: 1,
    });
    expect(
      taskQueueService.getTask(completedTask.id)?.executionPhase
    ).toBeUndefined();
  });

  it('allows an explicit replace restore to reconcile terminal status', async () => {
    const { taskQueueService } = await setupTaskQueueServiceHarness([
      TaskStatus.COMPLETED,
    ]);
    const completedTask: Task = {
      id: 'task-explicit-replace-restore',
      type: TaskType.IMAGE,
      status: TaskStatus.COMPLETED,
      progress: 100,
      params: { prompt: 'Explicit replacement owns imported history' },
      result: {
        url: 'https://example.com/before-replace.png',
        format: 'png',
        size: 1,
      },
      createdAt: 1,
      completedAt: 1,
      updatedAt: 1,
    };

    taskQueueService.trackExternalTask(clone(completedTask));
    taskQueueService.restoreTasks(
      [
        {
          ...clone(completedTask),
          status: TaskStatus.PROCESSING,
          progress: 40,
          result: undefined,
          completedAt: undefined,
          executionPhase: TaskExecutionPhase.SUBMITTING,
          updatedAt: 2,
        },
      ],
      { allowTerminalStatusReconciliation: true }
    );

    expect(taskQueueService.getTask(completedTask.id)).toMatchObject({
      status: TaskStatus.PROCESSING,
      progress: 40,
      executionPhase: TaskExecutionPhase.SUBMITTING,
      updatedAt: 2,
    });
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
