import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TaskType } from '../../types/task.types';

const mocks = vi.hoisted(() => ({
  adapterGenerateImage: vi.fn(),
  artifactsToLegacyImageResult: vi.fn(),
  cacheImageArtifacts: vi.fn(),
  createImageAdapterRequest: vi.fn(),
  createTaskInvocationRouteSnapshotFromPlan: vi.fn(),
  getTask: vi.fn(),
  resolveImageInvocation: vi.fn(),
  resolveInvocationRoute: vi.fn(),
  resolveTaskInvocationPlanFromSnapshot: vi.fn(),
  resumeAsyncImagePolling: vi.fn(),
  resumeImageInvocationPolling: vi.fn(),
  shouldUseStrictTaskInvocationRoute: vi.fn(),
  trackModelCall: vi.fn(),
  trackModelSuccess: vi.fn(),
  updateTaskStatus: vi.fn(),
}));

vi.mock('../../utils/settings-manager', () => ({
  resolveInvocationRoute: mocks.resolveInvocationRoute,
}));

vi.mock('../model-adapters', () => ({
  getAdapterContextFromSettings: vi.fn(),
  resolveAdapterForInvocation: vi.fn(),
}));

vi.mock('../image-invocation', () => ({
  artifactsToLegacyImageResult: mocks.artifactsToLegacyImageResult,
  ImageInvocationError: class ImageInvocationError extends Error {
    readonly code: string;
    readonly stage: string;

    constructor(
      code: string,
      message: string,
      options: { stage: string }
    ) {
      super(message);
      this.name = 'ImageInvocationError';
      this.code = code;
      this.stage = options.stage;
    }
  },
  normalizeImageArtifacts: (urls: string[]) =>
    urls.map((url) => ({ url, mimeType: 'image/png', format: 'png' })),
  createImageAdapterRequest: mocks.createImageAdapterRequest,
  resolveImageInvocation: mocks.resolveImageInvocation,
  resumeImageInvocationPolling: mocks.resumeImageInvocationPolling,
}));

vi.mock('../media-executor/fallback-utils', () => ({
  cacheImageArtifacts: mocks.cacheImageArtifacts,
}));

vi.mock('../task-invocation-route', () => ({
  assertTaskInvocationRouteAvailable: vi.fn(),
  createTaskInvocationRouteSnapshot: vi.fn(),
  createTaskInvocationRouteSnapshotFromPlan:
    mocks.createTaskInvocationRouteSnapshotFromPlan,
  resolveTaskInvocationPlanFromSnapshot:
    mocks.resolveTaskInvocationPlanFromSnapshot,
  shouldUseStrictTaskInvocationRoute: mocks.shouldUseStrictTaskInvocationRoute,
}));

vi.mock('../task-queue', () => ({
  legacyTaskQueueService: {
    getTask: mocks.getTask,
    updateTaskProgress: vi.fn(),
    updateTaskStatus: mocks.updateTaskStatus,
  },
}));

vi.mock('../../utils/posthog-analytics', () => ({
  analytics: {
    trackModelCall: mocks.trackModelCall,
    trackModelSuccess: mocks.trackModelSuccess,
    trackModelFailure: vi.fn(),
    trackTaskCancellation: vi.fn(),
  },
}));

vi.mock('../unified-cache-service', () => ({
  unifiedCacheService: {
    getImageForAI: vi.fn(),
  },
}));

vi.mock('../audio-api-service', () => ({
  audioAPIService: {},
  extractAudioGenerationResult: vi.fn(),
}));

vi.mock('../video-api-service', () => ({
  videoAPIService: {},
}));

vi.mock('../async-image-api-service', () => ({
  asyncImageAPIService: {
    resumePolling: mocks.resumeAsyncImagePolling,
    extractUrlAndFormat: vi.fn(() => ({
      url: 'https://example.com/legacy-resumed.png',
      format: 'png',
    })),
  },
}));

describe('generation-api-service image routing', () => {
  const staleModelRef = {
    profileId: 'auto-profile',
    modelId: 'removed-image-model',
  };
  const finalModelRef = {
    profileId: 'auto-profile',
    modelId: 'gpt-image-2',
  };
  const finalBinding = {
    id: 'auto-profile:gpt-image-2:image:openai.images.generations',
    profileId: finalModelRef.profileId,
    modelId: finalModelRef.modelId,
    operation: 'image',
    protocol: 'openai.images.generations',
    requestSchema: 'openai.image.gpt-generation-json',
    responseSchema: 'openai.image.data',
    submitPath: '/images/generations',
    priority: 320,
    confidence: 'high',
    source: 'template',
  } as const;
  const finalPlan = {
    provider: {
      profileId: finalModelRef.profileId,
      profileName: 'default',
      providerType: 'auto',
      baseUrl: 'https://gateway.example.com/v1',
      apiKey: 'test-key',
      authType: 'bearer',
    },
    modelRef: finalModelRef,
    binding: finalBinding,
  } as const;
  const invocationRoute = {
    operation: 'image',
    modelRef: finalModelRef,
    providerProfileId: finalModelRef.profileId,
    providerType: 'auto',
    modelId: finalModelRef.modelId,
    binding: {
      id: finalBinding.id,
      protocol: finalBinding.protocol,
      requestSchema: finalBinding.requestSchema,
      responseSchema: finalBinding.responseSchema,
      submitPath: finalBinding.submitPath,
    },
  } as const;

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.createImageAdapterRequest.mockImplementation(
      (invocation, overrides = {}) => ({
        ...invocation.request,
        operationIntent: invocation.intent,
        model: invocation.modelId,
        modelRef: invocation.modelRef,
        generationMode:
          invocation.request.generationMode ||
          (invocation.intent === 'edit' ? 'image_to_image' : 'text_to_image'),
        ...overrides,
      })
    );
    mocks.resolveInvocationRoute.mockReturnValue({
      routeType: 'image',
      modelId: finalModelRef.modelId,
      profileId: finalModelRef.profileId,
      profileName: 'default',
      providerType: 'auto',
      baseUrl: finalPlan.provider.baseUrl,
      apiKey: finalPlan.provider.apiKey,
      source: 'preset',
    });
    mocks.createTaskInvocationRouteSnapshotFromPlan.mockReturnValue(
      invocationRoute
    );
    mocks.getTask.mockReturnValue(null);
    mocks.shouldUseStrictTaskInvocationRoute.mockReturnValue(false);
    mocks.resolveTaskInvocationPlanFromSnapshot.mockReturnValue(null);
    mocks.resolveImageInvocation.mockReturnValue({
      request: {
        prompt: 'Use the selected catalog replacement',
        model: staleModelRef.modelId,
        modelRef: staleModelRef,
        referenceImages: [],
        params: {},
      },
      intent: 'generation',
      preferredRequestSchema: undefined,
      plan: finalPlan,
      modelRef: finalModelRef,
      modelId: finalModelRef.modelId,
      adapter: {
        id: 'gpt-image-adapter',
        label: 'GPT Image',
        kind: 'image',
        generateImage: mocks.adapterGenerateImage,
      },
      adapterContext: {
        baseUrl: finalPlan.provider.baseUrl,
        apiKey: finalPlan.provider.apiKey,
        authType: finalPlan.provider.authType,
        binding: finalBinding,
      },
      capabilities: null,
    });
    mocks.adapterGenerateImage.mockImplementation(async (_context, request) => {
      await request.onSubmitted?.('remote-image-1');
      return {
        artifacts: [
          {
            url: 'https://example.com/final.png',
            mimeType: 'image/png',
            format: 'png',
          },
        ],
      };
    });
    mocks.artifactsToLegacyImageResult.mockImplementation((artifacts) => ({
      url: artifacts[0]?.url,
      urls:
        artifacts.length > 1
          ? artifacts.map((artifact: { url: string }) => artifact.url)
          : undefined,
      format: artifacts[0]?.format || 'png',
    }));
    mocks.resumeImageInvocationPolling.mockResolvedValue([
      {
        url: 'https://example.com/resumed.png',
        mimeType: 'image/png',
        format: 'png',
      },
    ]);
    mocks.cacheImageArtifacts.mockImplementation(async (artifacts) => artifacts);
  });

  it('refuses image submission because TaskQueue is the only paid-submit owner', async () => {
    const { generationAPIService } = await import('../generation-api-service');

    await expect(
      generationAPIService.generate(
        'task-submit-owner-guard',
        {
          prompt: 'Do not submit from the legacy observer',
          model: staleModelRef.modelId,
          modelRef: staleModelRef,
        },
        TaskType.IMAGE
      )
    ).rejects.toMatchObject({
      name: 'ImageInvocationError',
      code: 'IMAGE_REQUEST_INVALID',
      stage: 'planning',
    });

    expect(mocks.resolveImageInvocation).not.toHaveBeenCalled();
    expect(mocks.adapterGenerateImage).not.toHaveBeenCalled();
    expect(mocks.cacheImageArtifacts).not.toHaveBeenCalled();
    expect(mocks.updateTaskStatus).not.toHaveBeenCalled();
    expect(mocks.trackModelCall).not.toHaveBeenCalled();
  });

  it('recovers a persisted binding snapshot by polling only that plan', async () => {
    const storedTask = {
      id: 'task-resume-1',
      type: TaskType.IMAGE,
      status: 'processing',
      params: {
        prompt: 'Resume image',
        model: finalModelRef.modelId,
        modelRef: finalModelRef,
      },
      invocationRoute,
    };
    mocks.getTask.mockReturnValue(storedTask);
    mocks.shouldUseStrictTaskInvocationRoute.mockReturnValue(true);
    mocks.resolveTaskInvocationPlanFromSnapshot.mockReturnValue(finalPlan);

    const { generationAPIService } = await import('../generation-api-service');
    const result = await generationAPIService.resumeAsyncImageGeneration(
      storedTask.id,
      'remote-image-1',
      staleModelRef,
      'obsolete-binding-id'
    );

    expect(mocks.resolveTaskInvocationPlanFromSnapshot).toHaveBeenCalledWith(
      'image',
      storedTask
    );
    expect(mocks.resumeImageInvocationPolling).toHaveBeenCalledWith(
      finalPlan,
      'remote-image-1',
      expect.objectContaining({ signal: expect.any(AbortSignal) })
    );
    expect(mocks.resumeAsyncImagePolling).not.toHaveBeenCalled();
    expect(result).toEqual({
      url: 'https://example.com/resumed.png',
      urls: undefined,
      imageArtifacts: [
        {
          url: 'https://example.com/resumed.png',
          mimeType: 'image/png',
          format: 'png',
        },
      ],
      format: 'png',
      size: 0,
    });
  });

});
