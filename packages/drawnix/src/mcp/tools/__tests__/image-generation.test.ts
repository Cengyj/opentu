import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { imageGenerationTool } from '../image-generation';

interface TestImageRequest extends Record<string, unknown> {
  prompt?: string;
  model?: string;
  modelRef?: { profileId: string; modelId: string } | null;
  referenceImages?: string[];
  params?: Record<string, unknown>;
  maskImage?: string;
  generationMode?: string;
}

interface TestAdapterContext extends Record<string, unknown> {
  baseUrl: string;
  apiKey: string;
  authType: string;
}

const mocks = vi.hoisted(() => ({
  createQueueTask: vi.fn(),
  normalizeImageRequest: vi.fn(),
  resolveImageInvocation: vi.fn(),
  createImageAdapterRequest: vi.fn(),
  artifactsToLegacyImageResult: vi.fn(),
  resolveImageTaskModelSelection: vi.fn(),
  executeResolvedImageInvocation: vi.fn(),
  generateImage: vi.fn(),
  getGeminiSettings: vi.fn(),
  updateGeminiSettings: vi.fn(),
  cacheImageArtifacts: vi.fn(),
}));

vi.mock('../../../constants/model-config', () => ({
  getDefaultImageModel: () => 'gpt-image-2',
  IMAGE_PARAMS: [
    {
      id: 'size',
      options: [
        { value: '1x1', label: '1:1' },
        { value: '16x9', label: '16:9' },
        { value: '9x16', label: '9:16' },
      ],
    },
  ],
}));

vi.mock('../../../utils/settings-manager', () => ({
  geminiSettings: {
    get: mocks.getGeminiSettings,
    update: mocks.updateGeminiSettings,
  },
}));

vi.mock('../../../services/image-task-model-selection', () => ({
  resolveImageTaskModelSelection: mocks.resolveImageTaskModelSelection,
}));

vi.mock('../../../services/image-invocation', () => ({
  normalizeImageRequest: mocks.normalizeImageRequest,
  resolveImageInvocation: mocks.resolveImageInvocation,
  createImageAdapterRequest: mocks.createImageAdapterRequest,
  artifactsToLegacyImageResult: mocks.artifactsToLegacyImageResult,
  executeResolvedImageInvocation: mocks.executeResolvedImageInvocation,
}));

vi.mock('../../../services/media-executor/fallback-utils', () => ({
  cacheImageArtifacts: mocks.cacheImageArtifacts,
}));

vi.mock('../shared/queue-utils', () => ({
  createQueueTask: mocks.createQueueTask,
  validatePrompt: (prompt: unknown) =>
    !prompt || typeof prompt !== 'string'
      ? { success: false, error: '缺少必填参数 prompt', type: 'error' }
      : null,
  wrapApiError: (error: unknown, fallbackMessage: string) => ({
    success: false,
    error: error instanceof Error ? error.message : fallbackMessage,
    type: 'error',
  }),
  toUploadedImages: (referenceImages?: string[]) =>
    referenceImages?.map((url, index) => ({
      type: 'url' as const,
      url,
      name: `reference-${index + 1}`,
    })),
}));

function normalizeTestRequest(input: TestImageRequest) {
  return {
    ...input,
    prompt: input.prompt,
    model: input.model,
    modelRef: input.modelRef || null,
    referenceImages: input.referenceImages || [],
    params: input.params || {},
  };
}

function createResolvedInvocation(
  input: TestImageRequest,
  adapterContext: TestAdapterContext = {
    baseUrl: 'https://api.openai.com/v1',
    apiKey: 'test-key',
    authType: 'bearer',
  }
) {
  const request = normalizeTestRequest(input);
  const modelId = request.modelRef?.modelId || request.model;
  const intent =
    request.referenceImages.length > 0 ||
    request.maskImage ||
    request.generationMode === 'image_edit' ||
    request.generationMode === 'image_to_image'
      ? 'edit'
      : 'generation';

  return {
    request,
    intent,
    preferredRequestSchema:
      intent === 'edit' ? ['openai.image.gpt-edit-form'] : undefined,
    plan: null,
    modelRef: request.modelRef,
    modelId,
    adapter: {
      id: 'test-image-adapter',
      kind: 'image',
      generateImage: mocks.generateImage,
    },
    adapterContext,
    capabilities: null,
  };
}

describe('image-generation MCP tool', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  beforeEach(() => {
    mocks.createQueueTask.mockReset();
    mocks.normalizeImageRequest.mockReset();
    mocks.resolveImageInvocation.mockReset();
    mocks.createImageAdapterRequest.mockReset();
    mocks.artifactsToLegacyImageResult.mockReset();
    mocks.resolveImageTaskModelSelection.mockReset();
    mocks.executeResolvedImageInvocation.mockReset();
    mocks.generateImage.mockReset();
    mocks.getGeminiSettings.mockReset();
    mocks.updateGeminiSettings.mockReset();
    mocks.cacheImageArtifacts.mockReset();

    mocks.getGeminiSettings.mockReturnValue({});
    mocks.normalizeImageRequest.mockImplementation(normalizeTestRequest);
    mocks.resolveImageTaskModelSelection.mockImplementation(
      (model?: string, modelRef?: TestImageRequest['modelRef']) =>
        modelRef?.profileId && modelRef.modelId
          ? { model: modelRef.modelId, modelRef }
          : { model: model || 'gpt-image-2', modelRef: null }
    );
    mocks.resolveImageInvocation.mockImplementation((input) =>
      createResolvedInvocation(input)
    );
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
    mocks.executeResolvedImageInvocation.mockImplementation(
      (invocation, options = {}) =>
        invocation.adapter.generateImage(
          invocation.adapterContext,
          mocks.createImageAdapterRequest(invocation, options)
        )
    );
    mocks.artifactsToLegacyImageResult.mockImplementation((artifacts) => ({
      url: artifacts[0]?.url,
      urls:
        artifacts.length > 1
          ? artifacts.map((artifact: { url: string }) => artifact.url)
          : undefined,
      format: artifacts[0]?.format || 'png',
    }));
    mocks.cacheImageArtifacts.mockImplementation(async (artifacts) => artifacts);
  });

  it('fails direct execution before adapter and transport when the selected profile key is missing', async () => {
    mocks.getGeminiSettings.mockReturnValue({
      apiKey: 'global-key-must-not-be-borrowed',
      baseUrl: 'https://global.example.com/v1',
    });
    const configurationError = Object.assign(
      new Error('图片供应商配置缺失: apiKey'),
      {
        name: 'ImageInvocationError',
        code: 'IMAGE_CONFIGURATION_MISSING',
        stage: 'planning',
        details: {
          profileId: 'selected-profile',
          modelId: 'gemini-image-model',
          operation: 'image',
          bindingId: 'selected-profile:gemini-image-model:image',
          missingFields: ['apiKey'],
        },
      }
    );
    mocks.resolveImageInvocation.mockImplementationOnce(() => {
      throw configurationError;
    });
    const transport = vi.fn();
    vi.stubGlobal('fetch', transport);
    vi.spyOn(console, 'error').mockImplementation(() => undefined);

    const result = await imageGenerationTool.execute(
      {
        prompt: 'do not borrow the global credential',
        model: 'gemini-image-model',
        modelRef: {
          profileId: 'selected-profile',
          modelId: 'gemini-image-model',
        },
      },
      { mode: 'async' }
    );

    expect(result).toEqual({
      success: false,
      error: '图片供应商配置缺失: apiKey',
      type: 'error',
    });
    expect(mocks.executeResolvedImageInvocation).not.toHaveBeenCalled();
    expect(mocks.generateImage).not.toHaveBeenCalled();
    expect(mocks.cacheImageArtifacts).not.toHaveBeenCalled();
    expect(transport).not.toHaveBeenCalled();
    expect(mocks.updateGeminiSettings).not.toHaveBeenCalled();
  });

  it('routes async generation through the selected image adapter', async () => {
    mocks.generateImage.mockResolvedValue({
      artifacts: [
        {
          url: 'https://example.com/output.webp',
          mimeType: 'image/webp',
          format: 'webp',
        },
        {
          url: 'https://example.com/output-2.webp',
          mimeType: 'image/webp',
          format: 'webp',
        },
      ],
    });

    const result = await imageGenerationTool.execute(
      {
        prompt: 'Create an edited image',
        model: 'gpt-image-2',
        size: '16x9',
        resolution: '2k',
        quality: 'high',
        referenceImages: ['https://example.com/input.png'],
        generationMode: 'image_edit',
        maskImage: 'https://example.com/mask.png',
        inputFidelity: 'high',
        background: 'transparent',
        outputFormat: 'png',
        outputCompression: 80,
        count: 3,
      },
      { mode: 'async' }
    );

    expect(mocks.resolveImageInvocation).toHaveBeenCalledWith(
      expect.objectContaining({
        prompt: 'Create an edited image',
        model: 'gpt-image-2',
        modelRef: null,
        referenceImages: ['https://example.com/input.png'],
        generationMode: 'image_edit',
      })
    );
    expect(mocks.executeResolvedImageInvocation).toHaveBeenCalledTimes(1);
    expect(mocks.executeResolvedImageInvocation).toHaveBeenCalledWith(
      mocks.resolveImageInvocation.mock.results[0]?.value,
      { signal: undefined }
    );
    expect(mocks.generateImage).toHaveBeenCalledWith(
      expect.objectContaining({
        baseUrl: 'https://api.openai.com/v1',
      }),
      expect.objectContaining({
        prompt: 'Create an edited image',
        operationIntent: 'edit',
        model: 'gpt-image-2',
        size: '16x9',
        generationMode: 'image_edit',
        referenceImages: ['https://example.com/input.png'],
        maskImage: 'https://example.com/mask.png',
        inputFidelity: 'high',
        background: 'transparent',
        outputFormat: 'png',
        outputCompression: 80,
        resolution: '2k',
        quality: 'high',
        count: 3,
        params: {},
      })
    );
    expect(result).toEqual({
      success: true,
      data: {
        url: 'https://example.com/output.webp',
        urls: [
          'https://example.com/output.webp',
          'https://example.com/output-2.webp',
        ],
        format: 'webp',
        prompt: 'Create an edited image',
        size: '16x9',
      },
      type: 'image',
    });
  });

  it('leaves size validation to the binding-scoped invocation contract', async () => {
    mocks.generateImage.mockResolvedValue({
      artifacts: [
        {
          url: 'https://example.com/custom-ratio.png',
          mimeType: 'image/png',
          format: 'png',
        },
      ],
    });

    await imageGenerationTool.execute(
      {
        prompt: 'Use a provider-defined ratio',
        model: 'dynamic-image-model',
        size: '5x4',
      },
      { mode: 'async' }
    );

    expect(mocks.resolveImageInvocation).toHaveBeenCalledWith(
      expect.objectContaining({ size: '5x4' })
    );
    expect(mocks.executeResolvedImageInvocation).toHaveBeenCalledTimes(1);
    expect(mocks.createImageAdapterRequest).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything()
    );
    expect(mocks.generateImage).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ size: '5x4' })
    );
  });

  it('uses the final provider-scoped binding model in direct mode', async () => {
    const modelRef = {
      profileId: 'auto-profile',
      modelId: 'gemini-3.1-flash-image-preview',
    };
    const binding = {
      id: 'auto-gemini-binding',
      profileId: 'auto-profile',
      modelId: 'gemini-3.1-flash-image-preview',
      operation: 'image',
      protocol: 'google.generateContent',
      requestSchema: 'google.generate-content.image-inline',
      responseSchema: 'google.generate-content.parts',
      submitPath: '/v1beta/models/{model}:generateContent',
      priority: 480,
      confidence: 'high',
      source: 'template',
    };
    const adapterContext = {
      baseUrl: 'https://gateway.example.com/v1',
      apiKey: 'test-key',
      authType: 'bearer',
      binding,
    };
    mocks.resolveImageInvocation.mockReturnValueOnce({
      ...createResolvedInvocation(
        {
          prompt: 'Use the final model reference',
          model: 'stale-model-id',
          modelRef,
        },
        adapterContext
      ),
      plan: {
        provider: {
          profileId: modelRef.profileId,
          profileName: 'default',
          providerType: 'auto',
          baseUrl: adapterContext.baseUrl,
          apiKey: adapterContext.apiKey,
          authType: adapterContext.authType,
        },
        modelRef,
        binding,
      },
    });
    mocks.generateImage.mockResolvedValue({
      artifacts: [
        {
          url: 'https://example.com/gemini.png',
          mimeType: 'image/png',
          format: 'png',
        },
      ],
    });

    const result = await imageGenerationTool.execute(
      {
        prompt: 'Use the final model reference',
        model: 'stale-model-id',
        modelRef,
      },
      { mode: 'async' }
    );

    expect(mocks.resolveImageInvocation).toHaveBeenCalledWith(
      expect.objectContaining({
        model: 'gemini-3.1-flash-image-preview',
        modelRef,
      })
    );
    expect(mocks.executeResolvedImageInvocation).toHaveBeenCalledTimes(1);
    expect(mocks.executeResolvedImageInvocation.mock.calls[0]?.[0]).toBe(
      mocks.resolveImageInvocation.mock.results[0]?.value
    );
    expect(mocks.generateImage).toHaveBeenCalledWith(
      expect.objectContaining({
        binding: expect.objectContaining({
          id: 'auto-gemini-binding',
        }),
      }),
      expect.objectContaining({
        model: 'gemini-3.1-flash-image-preview',
        operationIntent: 'generation',
        modelRef: {
          profileId: 'auto-profile',
          modelId: 'gemini-3.1-flash-image-preview',
        },
      })
    );
    expect(result.success).toBe(true);
  });

  it('freezes the same provider-scoped model identity for direct and queue modes', async () => {
    const modelRef = {
      profileId: 'shared-profile',
      modelId: 'provider-image-model',
    };
    mocks.generateImage.mockResolvedValue({
      artifacts: [
        {
          url: 'https://example.com/direct.png',
          mimeType: 'image/png',
          format: 'png',
        },
      ],
    });
    mocks.createQueueTask.mockReturnValue({
      success: true,
      type: 'image',
      taskId: 'task-shared-model-ref',
    });

    await imageGenerationTool.execute(
      { prompt: 'Direct', model: 'stale-model', modelRef },
      { mode: 'async' }
    );
    await imageGenerationTool.execute(
      { prompt: 'Queue', model: 'stale-model', modelRef },
      { mode: 'queue' }
    );

    expect(mocks.resolveImageInvocation).toHaveBeenCalledWith(
      expect.objectContaining({
        model: modelRef.modelId,
        modelRef,
      })
    );
    expect(mocks.executeResolvedImageInvocation).toHaveBeenCalledTimes(1);
    const queueConfig = mocks.createQueueTask.mock.calls[0]?.[2];
    expect(queueConfig.buildTaskPayload()).toMatchObject({
      model: modelRef.modelId,
      modelRef,
    });
    expect(mocks.resolveImageTaskModelSelection).toHaveBeenNthCalledWith(
      1,
      'stale-model',
      modelRef
    );
    expect(mocks.resolveImageTaskModelSelection).toHaveBeenNthCalledWith(
      2,
      'stale-model',
      modelRef
    );
  });

  it('propagates cancellation and persists ordered artifacts before legacy projection', async () => {
    const controller = new AbortController();
    const events: string[] = [];
    const artifacts = [
      {
        url: 'https://example.com/first.webp',
        source: 'url' as const,
        mimeType: 'image/webp' as const,
        format: 'webp' as const,
        width: 1024,
        height: 768,
      },
      {
        url: 'https://example.com/second.jpg',
        source: 'url' as const,
        mimeType: 'image/jpeg' as const,
        width: 640,
        height: 640,
      },
    ];
    mocks.generateImage.mockImplementation(async () => {
      events.push('adapter');
      return { artifacts };
    });
    mocks.cacheImageArtifacts.mockImplementation(async (inputArtifacts) => {
      inputArtifacts.forEach((_artifact, index) => events.push(`cache-${index}`));
      return inputArtifacts.map((artifact, index) => ({
        ...artifact,
        url:
          index === 0
            ? '/__aitu_cache__/image/direct-0.webp'
            : '/__aitu_cache__/image/direct-1.jpg',
      }));
    });
    mocks.artifactsToLegacyImageResult.mockImplementationOnce(
      (cachedArtifacts) => {
        events.push('project');
        return {
          url: cachedArtifacts[0].url,
          urls: cachedArtifacts.map(
            (artifact: { url: string }) => artifact.url
          ),
          format: cachedArtifacts[0].format,
        };
      }
    );

    const result = await imageGenerationTool.execute(
      {
        prompt: 'Persist both images',
        model: 'gpt-image-2',
      },
      { mode: 'async', signal: controller.signal }
    );

    expect(mocks.resolveImageInvocation).toHaveBeenCalledWith(
      expect.objectContaining({ signal: controller.signal })
    );
    expect(mocks.executeResolvedImageInvocation).toHaveBeenCalledTimes(1);
    expect(mocks.executeResolvedImageInvocation).toHaveBeenCalledWith(
      mocks.resolveImageInvocation.mock.results[0]?.value,
      { signal: controller.signal }
    );
    expect(mocks.createImageAdapterRequest).toHaveBeenCalledWith(
      expect.anything(),
      { signal: controller.signal }
    );
    expect(mocks.generateImage).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ signal: controller.signal })
    );
    expect(mocks.cacheImageArtifacts).toHaveBeenCalledTimes(1);
    expect(mocks.cacheImageArtifacts).toHaveBeenCalledWith(
      artifacts,
      expect.stringMatching(/^mcp-image-direct-/),
      expect.objectContaining({
        requirePersistence: true,
        forceRemoteCache: true,
        signal: controller.signal,
      })
    );
    expect(mocks.artifactsToLegacyImageResult).toHaveBeenCalledWith(
      [
        {
          ...artifacts[0],
          url: '/__aitu_cache__/image/direct-0.webp',
        },
        {
          ...artifacts[1],
          url: '/__aitu_cache__/image/direct-1.jpg',
        },
      ],
      { fallbackFormat: 'png', includeSingleUrl: true }
    );
    expect(events).toEqual(['adapter', 'cache-0', 'cache-1', 'project']);
    expect(result).toMatchObject({
      success: true,
      data: {
        url: '/__aitu_cache__/image/direct-0.webp',
        urls: [
          '/__aitu_cache__/image/direct-0.webp',
          '/__aitu_cache__/image/direct-1.jpg',
        ],
      },
    });
  });

  it('fails direct execution before projection when persistent caching fails', async () => {
    mocks.generateImage.mockResolvedValue({
      artifacts: [
        {
          url: 'https://example.com/output.png',
          source: 'url',
          mimeType: 'image/png',
          format: 'png',
        },
      ],
    });
    mocks.cacheImageArtifacts.mockRejectedValue(
      new Error('图片结果未能持久化到本地缓存')
    );

    const result = await imageGenerationTool.execute(
      { prompt: 'Do not expose an unpersisted result', model: 'gpt-image-2' },
      { mode: 'async' }
    );

    expect(result).toEqual({
      success: false,
      error: '图片结果未能持久化到本地缓存',
      type: 'error',
    });
    expect(mocks.artifactsToLegacyImageResult).not.toHaveBeenCalled();
    expect(mocks.executeResolvedImageInvocation).toHaveBeenCalledTimes(1);
    expect(mocks.createQueueTask).not.toHaveBeenCalled();
  });

  it('passes top-level quality and resolution into queue task params', async () => {
    mocks.createQueueTask.mockReturnValue({
      success: true,
      type: 'image',
      taskId: 'task-1',
    });

    await imageGenerationTool.execute(
      {
        prompt: 'Queue this image',
        model: 'gpt-image-2',
        size: '1x1',
        resolution: '4k',
        quality: 'high',
        params: {
          foo: 'bar',
        },
      },
      { mode: 'queue' }
    );

    expect(mocks.createQueueTask).toHaveBeenCalledTimes(1);
    const queueConfig = mocks.createQueueTask.mock.calls[0]?.[2];

    expect(queueConfig.buildTaskPayload()).toMatchObject({
      prompt: 'Queue this image',
      size: '1x1',
      model: 'gpt-image-2',
      resolution: '4k',
      quality: 'high',
      params: {
        foo: 'bar',
      },
    });
  });

  it('does not pass top-level count as adapter n in queue task params', async () => {
    mocks.createQueueTask.mockReturnValue({
      success: true,
      type: 'image',
      taskId: 'task-1',
    });

    await imageGenerationTool.execute(
      {
        prompt: 'Queue two image tasks',
        model: 'gpt-image-2',
        count: 2,
        params: {
          foo: 'bar',
        },
      },
      { mode: 'queue' }
    );

    const queueConfig = mocks.createQueueTask.mock.calls[0]?.[2];

    expect(queueConfig.buildTaskPayload()).toMatchObject({
      prompt: 'Queue two image tasks',
      params: {
        foo: 'bar',
      },
    });
    expect(queueConfig.buildTaskPayload().params).not.toHaveProperty('n');
    expect(queueConfig.buildTaskPayload().params).not.toHaveProperty('count');
    expect(mocks.cacheImageArtifacts).not.toHaveBeenCalled();
  });

  it('passes PPT slide replacement metadata into queue task params', async () => {
    mocks.createQueueTask.mockReturnValue({
      success: true,
      type: 'image',
      taskId: 'task-1',
    });

    await imageGenerationTool.execute(
      {
        prompt: 'Regenerate a PPT slide',
        model: 'gpt-image-2',
        size: '16x9',
        autoInsertToCanvas: true,
        targetFrameId: 'frame-1',
        targetFrameDimensions: { width: 1920, height: 1080 },
        pptSlideImage: true,
        pptReplaceElementId: 'old-image',
      },
      { mode: 'queue' }
    );

    const queueConfig = mocks.createQueueTask.mock.calls[0]?.[2];

    expect(queueConfig.buildTaskPayload()).toMatchObject({
      prompt: 'Regenerate a PPT slide',
      size: '16x9',
      targetFrameId: 'frame-1',
      targetFrameDimensions: { width: 1920, height: 1080 },
      pptSlideImage: true,
      pptReplaceElementId: 'old-image',
    });
  });
});
