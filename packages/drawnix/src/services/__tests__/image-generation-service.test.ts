import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TaskType } from '../../types/shared/core.types';
import { TaskExecutionPhase, TaskStatus } from '../../types/task.types';
import type { Task } from '../../types/shared/core.types';
import type {
  ExecutionOptions,
  ImageExecutionOutcome,
  ImageGenerationParams,
} from '../media-executor/types';

const createTaskMock = vi.fn(async () => undefined);
const claimTaskForCurrentSessionMock = vi.fn();
const trackExternalTaskMock = vi.fn();
const syncTaskFromStorageMock = vi.fn();
const applyImageExecutionOutcomeMock = vi.fn();
const getTaskMock = vi.fn();
const updateTaskStatusMock = vi.fn();
const generateImageMock = vi.fn(
  async (
    _params: ImageGenerationParams,
    _options?: ExecutionOptions
  ): Promise<ImageExecutionOutcome> => {
    throw new Error('generateImage mock was not configured');
  }
);
const waitForTaskCompletionMock = vi.fn();
const waitForInitializationMock = vi.fn(async () => undefined);
const hasInvocationRouteCredentialsMock = vi.fn(() => true);
const resolveInvocationPlanFromRouteMock = vi.fn(() => null);
const imageAdapter = {
  id: 'gpt-image-adapter',
  kind: 'image' as const,
};
const defaultPlan = {
  provider: {
    profileId: 'legacy-default',
    profileName: 'default',
    providerType: 'openai-compatible' as const,
    baseUrl: 'https://gateway.example.com/v1',
    apiKey: 'test-key',
    authType: 'bearer' as const,
  },
  modelRef: {
    profileId: 'legacy-default',
    modelId: 'gpt-image-2',
  },
  binding: {
    id: 'default-gpt-generation',
    profileId: 'legacy-default',
    modelId: 'gpt-image-2',
    operation: 'image' as const,
    protocol: 'openai.images.generations',
    requestSchema: 'openai.image.gpt-generation-json',
    responseSchema: 'openai.image.data',
    submitPath: '/images/generations',
    priority: 400,
    confidence: 'high' as const,
    source: 'template' as const,
  },
};
const getFallbackExecutorMock = vi.fn(() => ({
  generateImage: generateImageMock,
}));
const getExecutorMock = vi.fn();

vi.mock('../media-executor/task-storage-writer', () => ({
  taskStorageWriter: {
    createTask: createTaskMock,
  },
}));

vi.mock('../media-executor', () => ({
  executorFactory: {
    getFallbackExecutor: getFallbackExecutorMock,
    getExecutor: getExecutorMock,
  },
  waitForTaskCompletion: waitForTaskCompletionMock,
}));

vi.mock('../../utils/settings-manager', () => ({
  settingsManager: {
    waitForInitialization: waitForInitializationMock,
  },
  hasInvocationRouteCredentials: hasInvocationRouteCredentialsMock,
  createModelRef: (profileId?: string | null, modelId?: string | null) =>
    profileId || modelId
      ? { profileId: profileId || null, modelId: modelId || null }
      : null,
  resolveInvocationRoute: (_operation: string, requestedModel?: string) => ({
    profileId: 'legacy-default',
    providerType: 'openai-compatible',
    modelId: requestedModel || 'gpt-image-2',
  }),
  providerProfilesSettings: {
    get: () => [],
  },
}));

vi.mock('../provider-routing', () => ({
  resolveInvocationPlanFromRoute: resolveInvocationPlanFromRouteMock,
}));

vi.mock('../model-adapters/registry', () => ({
  resolveAdapterForPlan: vi.fn(() => imageAdapter),
}));

vi.mock('../model-adapters/context', () => ({
  getAdapterContextFromPlan: vi.fn((plan) => ({
    baseUrl: plan.provider.baseUrl,
    apiKey: plan.provider.apiKey,
    authType: plan.provider.authType,
    binding: plan.binding,
    provider: plan.provider,
  })),
}));

vi.mock('../task-queue-service', () => ({
  taskQueueService: {
    claimTaskForCurrentSession: claimTaskForCurrentSessionMock,
    trackExternalTask: trackExternalTaskMock,
    syncTaskFromStorage: syncTaskFromStorageMock,
    applyImageExecutionOutcome: applyImageExecutionOutcomeMock,
    getTask: getTaskMock,
    updateTaskStatus: updateTaskStatusMock,
  },
}));

vi.mock('../../utils/task-utils', () => ({
  generateTaskId: () => 'task-image-1',
}));

describe('image-generation-service', () => {
  let memoryTask: Task | undefined;

  beforeEach(() => {
    vi.clearAllMocks();
    resolveInvocationPlanFromRouteMock.mockReturnValue(defaultPlan);
    memoryTask = undefined;
    trackExternalTaskMock.mockImplementation((task: Task) => {
      memoryTask = task;
    });
    getTaskMock.mockImplementation(() => memoryTask);
    updateTaskStatusMock.mockImplementation(
      (taskId: string, status: TaskStatus, updates?: Partial<Task>) => {
        if (!memoryTask || memoryTask.id !== taskId) return;
        const now = Date.now();
        memoryTask = {
          ...memoryTask,
          ...updates,
          status,
          updatedAt: now,
          completedAt: now,
          executionPhase: undefined,
        };
      }
    );

    const completedTask = {
      id: 'task-image-1',
      type: TaskType.IMAGE,
      status: TaskStatus.COMPLETED,
      params: { prompt: 'Edit this' },
      createdAt: 1,
      updatedAt: 2,
      completedAt: 2,
      progress: 100,
      result: {
        url: 'https://example.com/out.png',
        format: 'png',
        size: 1,
      },
    } satisfies Task;
    generateImageMock.mockResolvedValue({
      taskId: completedTask.id,
      status: 'completed',
      progress: 100,
      result: completedTask.result,
      completedAt: completedTask.completedAt,
      updatedAt: completedTask.updatedAt,
    });
    applyImageExecutionOutcomeMock.mockReturnValue(completedTask);
    getExecutorMock.mockResolvedValue({ generateImage: generateImageMock });
  });

  it('persists the full image contract for edit-capable GPT requests', async () => {
    resolveInvocationPlanFromRouteMock.mockReturnValueOnce({
      provider: {
        profileId: 'auto-profile',
        profileName: 'default',
        providerType: 'auto',
        baseUrl: 'https://gateway.example.com/v1',
        apiKey: 'test-key',
        authType: 'bearer',
      },
      modelRef: {
        profileId: 'auto-profile',
        modelId: 'gpt-image-2',
      },
      binding: {
        id: 'auto-gpt-edit',
        profileId: 'auto-profile',
        modelId: 'gpt-image-2',
        operation: 'image',
        protocol: 'openai.images.edits',
        requestSchema: 'openai.image.gpt-edit-form',
        responseSchema: 'openai.image.data',
        submitPath: '/images/edits',
        priority: 499,
        confidence: 'high',
        source: 'template',
      },
    });
    const { generateImage } = await import(
      '../media-generation/image-generation-service'
    );

    await generateImage('Edit this', {
      forceMainThread: true,
      model: 'gpt-image-2',
      size: '16x9',
      resolution: '2k',
      quality: 'high',
      generationMode: 'image_to_image',
      referenceImages: ['https://example.com/reference.png'],
      maskImage: 'https://example.com/mask.png',
      inputFidelity: 'high',
      background: 'transparent',
      outputFormat: 'png',
      outputCompression: 80,
      uploadedImages: [{ url: 'https://example.com/reference.png' }],
      count: 2,
      params: { n: 9 },
    });

    expect(claimTaskForCurrentSessionMock).toHaveBeenCalledWith('task-image-1');
    expect(
      claimTaskForCurrentSessionMock.mock.invocationCallOrder[0]
    ).toBeLessThan(createTaskMock.mock.invocationCallOrder[0]);

    expect(createTaskMock).toHaveBeenCalledWith(
      'task-image-1',
      'image',
      expect.objectContaining({
        prompt: 'Edit this',
        model: 'gpt-image-2',
        modelRef: {
          profileId: 'auto-profile',
          modelId: 'gpt-image-2',
        },
        size: '16x9',
        resolution: '2k',
        quality: 'high',
        generationMode: 'image_to_image',
        referenceImages: ['https://example.com/reference.png'],
        maskImage: 'https://example.com/mask.png',
        inputFidelity: 'high',
        background: 'transparent',
        outputFormat: 'png',
        outputCompression: 80,
        count: 2,
      }),
      expect.objectContaining({
        operation: 'image',
        providerProfileId: 'auto-profile',
        providerType: 'auto',
        modelId: 'gpt-image-2',
        binding: expect.objectContaining({
          id: 'auto-gpt-edit',
          protocol: 'openai.images.edits',
          requestSchema: 'openai.image.gpt-edit-form',
          submitPath: '/images/edits',
        }),
      })
    );
    expect(resolveInvocationPlanFromRouteMock).toHaveBeenCalledWith(
      'image',
      'gpt-image-2',
      expect.objectContaining({
        preferredRequestSchema: ['openai.image.gpt-edit-form'],
      })
    );

    expect(trackExternalTaskMock).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'task-image-1',
        type: TaskType.IMAGE,
        status: TaskStatus.PROCESSING,
        executionPhase: TaskExecutionPhase.SUBMITTING,
        params: expect.objectContaining({
          resolution: '2k',
          quality: 'high',
          generationMode: 'image_to_image',
          referenceImages: ['https://example.com/reference.png'],
          maskImage: 'https://example.com/mask.png',
        }),
      })
    );

    expect(generateImageMock).toHaveBeenCalledWith(
      expect.objectContaining({
        taskId: 'task-image-1',
        request: expect.objectContaining({
          resolution: '2k',
          quality: 'high',
          count: 2,
          params: {},
        }),
        resolvedInvocation: expect.objectContaining({
          plan: expect.objectContaining({
            binding: expect.objectContaining({ id: 'auto-gpt-edit' }),
          }),
        }),
      }),
      expect.objectContaining({
        signal: undefined,
      })
    );
  });

  it('returns a synchronous executor completion without waiting for IndexedDB polling', async () => {
    const completedTask = {
      id: 'task-image-1',
      type: TaskType.IMAGE,
      status: TaskStatus.COMPLETED,
      params: { prompt: 'Generate this' },
      createdAt: 1,
      updatedAt: 3,
      completedAt: 3,
      progress: 100,
      result: {
        url: 'https://example.com/generated.png',
        format: 'png',
        size: 1,
      },
    } satisfies Task;

    generateImageMock.mockResolvedValueOnce({
      taskId: completedTask.id,
      status: 'completed',
      result: completedTask.result,
      completedAt: completedTask.completedAt,
      updatedAt: completedTask.updatedAt,
    });
    applyImageExecutionOutcomeMock.mockReturnValue(completedTask);
    waitForTaskCompletionMock.mockImplementationOnce(
      () => new Promise(() => undefined)
    );

    const { generateImage } = await import(
      '../media-generation/image-generation-service'
    );

    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    const outcome = await Promise.race([
      generateImage('Generate this', { forceMainThread: true }),
      new Promise<'poll-timeout'>((resolve) => {
        timeoutId = setTimeout(() => resolve('poll-timeout'), 50);
      }),
    ]);
    if (timeoutId) {
      clearTimeout(timeoutId);
    }

    expect(outcome).toEqual({
      task: completedTask,
      url: completedTask.result.url,
    });
    expect(applyImageExecutionOutcomeMock).toHaveBeenCalledWith({
      taskId: 'task-image-1',
      status: 'completed',
      result: completedTask.result,
      completedAt: completedTask.completedAt,
      updatedAt: completedTask.updatedAt,
    });
    expect(syncTaskFromStorageMock).not.toHaveBeenCalled();
    expect(waitForTaskCompletionMock).not.toHaveBeenCalled();
  });

  it('converges the in-memory task to failed when execution cannot return an outcome', async () => {
    generateImageMock.mockRejectedValueOnce(
      new Error('Simulated terminal storage timeout')
    );

    const { generateImage } = await import(
      '../media-generation/image-generation-service'
    );
    const result = await generateImage('Do not leave this processing', {
      forceMainThread: true,
    });

    expect(result.task).toMatchObject({
      id: 'task-image-1',
      status: TaskStatus.FAILED,
      error: {
        code: 'IMAGE_EXECUTION_ERROR',
        message: 'Simulated terminal storage timeout',
      },
    });
    expect(result.task.executionPhase).toBeUndefined();
    expect(updateTaskStatusMock).toHaveBeenCalledWith(
      'task-image-1',
      TaskStatus.FAILED,
      {
        error: {
          code: 'IMAGE_EXECUTION_ERROR',
          message: 'Simulated terminal storage timeout',
        },
      }
    );
    expect(waitForTaskCompletionMock).not.toHaveBeenCalled();
  });

  it('converges to failed when executor acquisition fails after task creation', async () => {
    getExecutorMock.mockRejectedValueOnce(
      new Error('Simulated executor acquisition failure')
    );

    const { generateImage } = await import(
      '../media-generation/image-generation-service'
    );
    const result = await generateImage('Executor factory failure');

    expect(generateImageMock).not.toHaveBeenCalled();
    expect(result.task).toMatchObject({
      status: TaskStatus.FAILED,
      error: {
        code: 'IMAGE_EXECUTION_ERROR',
        message: 'Simulated executor acquisition failure',
      },
    });
    expect(result.task.executionPhase).toBeUndefined();
  });

  it('converges to failed when the task-created callback throws before submission', async () => {
    const { generateImage } = await import(
      '../media-generation/image-generation-service'
    );
    const result = await generateImage('Callback failure', {
      forceMainThread: true,
      onTaskCreated: () => {
        throw new Error('Simulated task-created callback failure');
      },
    });

    expect(generateImageMock).not.toHaveBeenCalled();
    expect(result.task).toMatchObject({
      status: TaskStatus.FAILED,
      error: {
        code: 'IMAGE_EXECUTION_ERROR',
        message: 'Simulated task-created callback failure',
      },
    });
  });
});
