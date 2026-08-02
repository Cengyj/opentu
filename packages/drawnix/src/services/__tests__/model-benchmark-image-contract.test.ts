import { describe, expect, it, vi } from 'vitest';
import { ModelVendor } from '../../constants/model-config';

const mocks = vi.hoisted(() => {
  const adapter = {
    id: 'resolved-image-adapter',
    label: 'Resolved Image Adapter',
    kind: 'image' as const,
    generateImage: vi.fn(),
  };
  const adapterContext = {
    baseUrl: 'https://resolved.example.com/v1',
    operation: 'image' as const,
    apiKey: 'secret',
    authType: 'bearer' as const,
    binding: {
      id: 'profile-final:catalog-final-image:image:resolved',
      profileId: 'profile-final',
      modelId: 'catalog-final-image',
      operation: 'image' as const,
      protocol: 'openai.images.generations' as const,
      requestSchema: 'openai.image.gpt-generation-json',
      responseSchema: 'openai.image.data',
      submitPath: '/resolved/images/generations',
      priority: 900,
      confidence: 'high' as const,
      source: 'discovered' as const,
    },
  };

  return {
    adapter,
    adapterContext,
    artifactsToLegacyImageResult: vi.fn(),
    executeResolvedImageInvocation: vi.fn(),
    getAdapterContextFromSettings: vi.fn(),
    kvSet: vi.fn(async () => undefined),
    queueCreateTask: vi.fn(),
    queueServiceCreateTask: vi.fn(),
    resolveAdapterForInvocation: vi.fn(),
    resolveImageInvocation: vi.fn(),
    track: vi.fn(),
  };
});

vi.mock('../../utils/gemini-api', () => ({
  defaultGeminiClient: { sendChat: vi.fn() },
}));

vi.mock('../kv-storage-service', () => ({
  kvStorageService: {
    isAvailable: vi.fn(() => false),
    get: vi.fn(),
    set: mocks.kvSet,
  },
}));

let generatedId = 0;
vi.mock('../../utils/task-utils', () => ({
  generateTaskId: vi.fn(() => `benchmark-id-${++generatedId}`),
}));

vi.mock('../../utils/settings-manager', () => ({
  createModelRef: vi.fn((profileId: string, modelId: string) => ({
    profileId,
    modelId,
  })),
}));

vi.mock('../../utils/posthog-analytics', () => ({
  analytics: { track: mocks.track },
}));

vi.mock('../model-adapters', () => ({
  getAdapterContextFromSettings: mocks.getAdapterContextFromSettings,
  resolveAdapterForInvocation: mocks.resolveAdapterForInvocation,
}));

vi.mock('../image-invocation', () => ({
  resolveImageInvocation: mocks.resolveImageInvocation,
  executeResolvedImageInvocation: mocks.executeResolvedImageInvocation,
  artifactsToLegacyImageResult: mocks.artifactsToLegacyImageResult,
}));

vi.mock('../generation-context-service', () => ({
  buildPromptWithKnowledgeContext: vi.fn(),
  normalizeKnowledgeContextRefs: vi.fn((refs) => refs),
}));

// Importing or invoking a queue from the benchmark path is a contract breach.
vi.mock('../task-queue', () => ({
  legacyTaskQueueService: { createTask: mocks.queueCreateTask },
}));
vi.mock('../task-queue-service', () => ({
  taskQueueService: { createTask: mocks.queueServiceCreateTask },
}));

describe('model benchmark image invocation contract', () => {
  it('uses one resolved invocation and preserves final ModelRef and artifact order', async () => {
    const orderedArtifacts = [
      {
        url: 'https://cdn.example.com/first.png',
        source: 'url' as const,
        mimeType: 'image/png' as const,
        format: 'png' as const,
      },
      {
        url: 'https://cdn.example.com/second.webp',
        source: 'url' as const,
        mimeType: 'image/webp' as const,
        format: 'webp' as const,
      },
      {
        url: 'https://cdn.example.com/third.jpg',
        source: 'url' as const,
        mimeType: 'image/jpeg' as const,
        format: 'jpg' as const,
      },
    ];
    const finalModelRef = {
      profileId: 'profile-final',
      modelId: 'catalog-final-image',
    };
    const resolvedInvocation = {
      request: {
        prompt: 'benchmark prompt',
        model: 'stale-image-model',
        modelRef: {
          profileId: 'profile-original',
          modelId: 'stale-image-model',
        },
        referenceImages: [],
        size: '1024x1024',
        count: 1,
        params: {},
      },
      intent: 'generation',
      plan: {
        provider: {
          profileId: 'profile-final',
          profileName: 'Final Provider',
          providerType: 'auto',
          baseUrl: mocks.adapterContext.baseUrl,
          apiKey: 'secret',
          authType: 'bearer',
        },
        modelRef: finalModelRef,
        binding: mocks.adapterContext.binding,
      },
      modelRef: finalModelRef,
      modelId: finalModelRef.modelId,
      adapter: mocks.adapter,
      adapterContext: mocks.adapterContext,
      capabilities: null,
    };
    mocks.resolveImageInvocation.mockReturnValue(resolvedInvocation);
    mocks.executeResolvedImageInvocation.mockImplementation(
      async (_invocation, options) => {
        options.onProgress?.(10, 'submitting');
        return { artifacts: orderedArtifacts };
      }
    );
    mocks.artifactsToLegacyImageResult.mockImplementation((artifacts) => ({
      url: artifacts[0].url,
      urls: artifacts.map((artifact) => artifact.url),
      format: artifacts[0].format,
    }));

    const { modelBenchmarkService } = await import(
      '../model-benchmark-service'
    );
    const session = modelBenchmarkService.createSession({
      modality: 'image',
      compareMode: 'custom',
      promptPresetId: 'image-single-object',
      prompt: 'benchmark prompt',
      rankingMode: 'speed',
      targets: [
        {
          profileId: 'profile-original',
          profileName: 'Original Provider',
          modelId: 'stale-image-model',
          modelLabel: 'Stale Image Model',
          modality: 'image',
          vendor: ModelVendor.GPT,
          selectionKey: 'profile-original::stale-image-model',
        },
      ],
    });

    await modelBenchmarkService.runSession(session.id, 1);

    expect(mocks.resolveImageInvocation).toHaveBeenCalledTimes(1);
    expect(mocks.resolveImageInvocation).toHaveBeenCalledWith({
      prompt: 'benchmark prompt',
      model: 'stale-image-model',
      modelRef: {
        profileId: 'profile-original',
        modelId: 'stale-image-model',
      },
      size: '1024x1024',
      count: 1,
    });

    expect(mocks.executeResolvedImageInvocation).toHaveBeenCalledTimes(1);
    expect(mocks.executeResolvedImageInvocation.mock.calls[0]?.[0]).toBe(
      resolvedInvocation
    );
    expect(
      mocks.executeResolvedImageInvocation.mock.calls[0]?.[1]
    ).toMatchObject({
      generationMode: 'text_to_image',
      onSubmitted: expect.any(Function),
      onProgress: expect.any(Function),
    });
    expect(mocks.adapter.generateImage).not.toHaveBeenCalled();
    expect(mocks.getAdapterContextFromSettings).not.toHaveBeenCalled();
    expect(mocks.resolveAdapterForInvocation).not.toHaveBeenCalled();

    expect(mocks.artifactsToLegacyImageResult).toHaveBeenCalledWith(
      orderedArtifacts,
      { fallbackFormat: 'png' }
    );
    const completedSession = modelBenchmarkService
      .getState()
      .sessions.find((item) => item.id === session.id);
    expect(completedSession?.status).toBe('completed');
    expect(completedSession?.entries[0]?.preview).toMatchObject({
      url: orderedArtifacts[0].url,
      urls: orderedArtifacts.map((artifact) => artifact.url),
      format: 'png',
    });

    expect(mocks.queueCreateTask).not.toHaveBeenCalled();
    expect(mocks.queueServiceCreateTask).not.toHaveBeenCalled();
  });
});
