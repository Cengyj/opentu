import { afterEach, describe, expect, it, vi } from 'vitest';
import { ImageArtifactError } from '../image-invocation/artifacts';
import { geminiImageAdapter } from '../model-adapters/default-adapters';
import type { AdapterContext } from '../model-adapters/types';

const mocks = vi.hoisted(() => ({
  generateImage: vi.fn(),
  generateWithPolling: vi.fn(),
  extractUrlAndFormat: vi.fn(),
}));

vi.mock('../../utils/gemini-api', () => ({
  defaultGeminiClient: {
    generateImage: mocks.generateImage,
  },
}));

vi.mock('../async-image-api-service', () => ({
  asyncImageAPIService: {
    generateWithPolling: mocks.generateWithPolling,
    extractUrlAndFormat: mocks.extractUrlAndFormat,
  },
}));

vi.mock('../audio-api-service', () => ({
  audioAPIService: {},
  extractAudioGenerationResult: vi.fn(),
}));

vi.mock('../video-api-service', () => ({
  videoAPIService: {},
}));

vi.mock('../unified-cache-service', () => ({
  unifiedCacheService: {},
}));

const PNG_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

function basicImageContext(modelId: string): AdapterContext {
  const provider = {
    profileId: 'compat-profile',
    profileName: 'Compatibility Provider',
    providerType: 'openai-compatible',
    baseUrl: 'https://gateway.example.com/v1',
    apiKey: 'test-key',
    authType: 'bearer' as const,
  };
  return {
    baseUrl: provider.baseUrl,
    apiKey: provider.apiKey,
    authType: provider.authType,
    provider,
    binding: {
      id: `basic-${modelId}`,
      profileId: provider.profileId,
      modelId,
      operation: 'image',
      protocol: 'openai.images.generations',
      requestSchema: 'openai.image.basic-json',
      responseSchema: 'openai.image.data',
      submitPath: '/images/generations',
      submitMethod: 'POST',
      priority: 300,
      confidence: 'high',
      source: 'template',
      metadata:
        modelId === 'gpt-image-2'
          ? {
              image: {
                serialization: {
                  omitDefaultResponseFormat: true,
                  defaultResolution: '1k',
                },
              },
            }
          : undefined,
    },
  };
}

describe('default image adapter compatibility', () => {
  afterEach(() => {
    mocks.generateImage.mockReset();
    mocks.generateWithPolling.mockReset();
    mocks.extractUrlAndFormat.mockReset();
  });

  it('keeps generic GPT image bindings on the basic compatibility request shape', async () => {
    mocks.generateImage.mockResolvedValue({
      data: [
        {
          url: 'https://example.com/basic.png',
        },
      ],
    });

    const result = await geminiImageAdapter.generateImage(
      basicImageContext('gpt-image-2'),
      {
        model: 'gpt-image-2',
        prompt: 'Draw a clean product photo',
        operationIntent: 'edit',
        size: '1024x1024',
        referenceImages: ['data:image/png;base64,abc123'],
        resolution: '4k',
        quality: 'high',
        count: 2,
        params: {
          provider_specific_option: 'preserved',
        },
      }
    );

    expect(mocks.generateImage).toHaveBeenCalledWith(
      'Draw a clean product photo',
      expect.objectContaining({
        size: '1024x1024',
        image: ['data:image/png;base64,abc123'],
        quality: '4k',
        count: 2,
        model: 'gpt-image-2',
        modelRef: null,
        omitDefaultResponseFormat: true,
        invocationConfig: expect.objectContaining({
          binding: expect.objectContaining({
            id: 'basic-gpt-image-2',
            submitPath: '/images/generations',
          }),
        }),
      })
    );
    expect(result).toEqual({
      artifacts: [
        {
          url: 'https://example.com/basic.png',
          source: 'url',
          mimeType: 'image/png',
          format: 'png',
        },
      ],
    });
  });

  it('defaults GPT Image 2 basic binding quality to 1k when resolution is unset', async () => {
    mocks.generateImage.mockResolvedValue({
      data: [
        {
          url: 'https://example.com/basic.png',
        },
      ],
    });

    await geminiImageAdapter.generateImage(basicImageContext('gpt-image-2'), {
      model: 'gpt-image-2',
      prompt: 'Draw a clean product photo',
      operationIntent: 'generation',
      size: '16x9',
      quality: 'high',
    });

    expect(mocks.generateImage).toHaveBeenCalledWith(
      'Draw a clean product photo',
      expect.objectContaining({
        quality: '1k',
      })
    );
  });

  it('does not infer serializer behavior from a model name without binding metadata', async () => {
    mocks.generateImage.mockResolvedValue({
      data: [{ url: 'https://example.com/no-name-heuristic.png' }],
    });
    const context = basicImageContext('gpt-image-2');
    context.binding = {
      ...context.binding!,
      metadata: undefined,
    };

    await geminiImageAdapter.generateImage(context, {
      model: 'gpt-image-2',
      prompt: 'Use only explicit binding serializer evidence',
      operationIntent: 'generation',
      quality: 'high',
    });

    expect(mocks.generateImage).toHaveBeenCalledWith(
      'Use only explicit binding serializer evidence',
      expect.objectContaining({
        quality: undefined,
        omitDefaultResponseFormat: false,
      })
    );
  });

  it('normalizes multi-image provider results once and does not expose raw payloads', async () => {
    mocks.generateImage.mockResolvedValue({
      data: [
        { url: 'https://example.com/first.webp' },
        { b64_json: PNG_BASE64, mime_type: 'image/png' },
      ],
    });

    const result = await geminiImageAdapter.generateImage(
      basicImageContext('gateway-image-model'),
      {
        model: 'gateway-image-model',
        prompt: 'Draw two ordered images',
        operationIntent: 'generation',
      }
    );

    expect(result).toEqual({
      artifacts: [
        {
          url: 'https://example.com/first.webp',
          source: 'url',
          mimeType: 'image/webp',
          format: 'webp',
        },
        {
          url: `data:image/png;base64,${PNG_BASE64}`,
          source: 'inline',
          mimeType: 'image/png',
          format: 'png',
        },
      ],
    });
    expect(result).not.toHaveProperty('raw');
  });

  it('uses canonical fields instead of known aliases left in provider params', async () => {
    mocks.generateImage.mockResolvedValue({
      data: [{ url: 'https://example.com/canonical.png' }],
    });

    await geminiImageAdapter.generateImage(
      basicImageContext('gateway-image-model'),
      {
        model: 'gateway-image-model',
        prompt: 'Use canonical options',
        operationIntent: 'generation',
        resolution: '2k',
        quality: 'high',
        count: 2,
        responseFormat: 'b64_json',
        params: {
          resolution: '4k',
          quality: '4k',
          n: 9,
          response_format: 'url',
          provider_specific_option: 'preserved',
        },
      }
    );

    expect(mocks.generateImage).toHaveBeenCalledWith(
      'Use canonical options',
      expect.objectContaining({
        quality: '2k',
        count: 2,
        response_format: 'b64_json',
      })
    );
  });

  it('surfaces malformed Base64 as a structured payload-safe error', async () => {
    const malformedPayload = 'provider-secret-payload!!!';
    mocks.generateImage.mockResolvedValue({
      data: [
        {
          b64_json: malformedPayload,
          mime_type: 'image/png',
        },
      ],
    });

    let caught: unknown;
    try {
      await geminiImageAdapter.generateImage(
        basicImageContext('gateway-image-model'),
        {
          model: 'gateway-image-model',
          prompt: 'Draw safely',
          operationIntent: 'generation',
        }
      );
    } catch (error) {
      caught = error;
    }

    expect(caught).toBeInstanceOf(ImageArtifactError);
    expect(caught).toMatchObject({ code: 'IMAGE_ARTIFACT_INVALID_BASE64' });
    expect((caught as Error).message).not.toContain(malformedPayload);
  });

  it('rejects unsupported provider image MIME types', async () => {
    mocks.generateImage.mockResolvedValue({
      data: [
        {
          b64_json: PNG_BASE64,
          mime_type: 'image/svg+xml',
        },
      ],
    });

    await expect(
      geminiImageAdapter.generateImage(
        basicImageContext('gateway-image-model'),
        {
          model: 'gateway-image-model',
          prompt: 'Draw safely',
          operationIntent: 'generation',
        }
      )
    ).rejects.toMatchObject({
      code: 'IMAGE_ARTIFACT_UNSUPPORTED_MIME',
    });
  });

  it('does not enter the legacy client when InvocationPlan.binding is missing', async () => {
    const context = basicImageContext('gateway-image-model');
    context.binding = null;

    await expect(
      geminiImageAdapter.generateImage(context, {
        model: 'gateway-image-model',
        prompt: 'Do not guess a protocol',
        operationIntent: 'generation',
      })
    ).rejects.toThrow('Gemini Image adapter 缺少 InvocationPlan.binding');

    expect(mocks.generateImage).not.toHaveBeenCalled();
    expect(mocks.generateWithPolling).not.toHaveBeenCalled();
  });

  it('rejects an empty binding submitPath before entering either client', async () => {
    const context = basicImageContext('gateway-image-model');
    const plannedBinding = context.binding;
    if (!plannedBinding) {
      throw new Error('test fixture is missing its planned binding');
    }
    context.binding = {
      ...plannedBinding,
      submitPath: '',
    };

    await expect(
      geminiImageAdapter.generateImage(context, {
        model: 'gateway-image-model',
        prompt: 'Do not guess an endpoint',
        operationIntent: 'generation',
      })
    ).rejects.toThrow('Gemini Image adapter binding 缺少 submitPath');

    expect(mocks.generateImage).not.toHaveBeenCalled();
    expect(mocks.generateWithPolling).not.toHaveBeenCalled();
  });

  it('rejects model identity drift before entering either client', async () => {
    const context = basicImageContext('planned-model');

    await expect(
      geminiImageAdapter.generateImage(context, {
        model: 'different-model',
        prompt: 'Do not cross model identities',
        operationIntent: 'generation',
      })
    ).rejects.toThrow('Gemini Image adapter 请求模型与 binding 不一致');

    expect(mocks.generateImage).not.toHaveBeenCalled();
    expect(mocks.generateWithPolling).not.toHaveBeenCalled();
  });

  it('passes the selected Gemini binding through without replanning inside the client', async () => {
    mocks.generateImage.mockResolvedValue({
      choices: [{ message: { role: 'assistant', content: '' } }],
      inlineMedia: [{ url: 'https://example.com/gemini.png' }],
    });
    const binding = {
      id: 'auto-gemini-binding',
      profileId: 'auto-profile',
      modelId: 'gemini-3.1-flash-image-preview',
      operation: 'image' as const,
      protocol: 'google.generateContent' as const,
      requestSchema: 'google.generate-content.image-inline',
      responseSchema: 'google.generate-content.parts',
      submitPath: '/v1beta/models/{model}:generateContent',
      submitMethod: 'POST',
      baseUrlStrategy: 'trim-v1' as const,
      priority: 480,
      confidence: 'high' as const,
      source: 'template' as const,
    };
    const provider = {
      profileId: 'auto-profile',
      profileName: 'default',
      providerType: 'auto',
      baseUrl: 'https://gateway.example.com/v1',
      apiKey: 'test-key',
      authType: 'query' as const,
      extraHeaders: {
        'X-Provider-Group': 'default',
      },
    };
    const fetcher = vi.fn();

    await geminiImageAdapter.generateImage(
      {
        baseUrl: provider.baseUrl,
        apiKey: provider.apiKey,
        authType: provider.authType,
        extraHeaders: provider.extraHeaders,
        fetcher,
        provider,
        binding,
      },
      {
        model: binding.modelId,
        modelRef: {
          profileId: binding.profileId,
          modelId: binding.modelId,
        },
        prompt: 'Draw with Gemini',
        operationIntent: 'generation',
        size: '1x1',
      }
    );

    expect(mocks.generateImage).toHaveBeenCalledWith(
      'Draw with Gemini',
      expect.objectContaining({
        model: binding.modelId,
        invocationConfig: expect.objectContaining({
          modelName: binding.modelId,
          protocol: binding.protocol,
          binding,
          provider,
          fetcher,
        }),
      })
    );
  });

  it('parses structured Gemini inline media without converting it to OpenAI b64_json', async () => {
    mocks.generateImage.mockResolvedValue({
      choices: [
        {
          message: {
            role: 'assistant',
            content: '',
          },
        },
      ],
      inlineMedia: [
        {
          data: PNG_BASE64,
          mimeType: 'image/png',
        },
      ],
    });
    const binding = {
      id: 'gemini-structured-binding',
      profileId: 'gemini-profile',
      modelId: 'gemini-image-model',
      operation: 'image' as const,
      protocol: 'google.generateContent' as const,
      requestSchema: 'google.generate-content.image-inline',
      responseSchema: 'google.generate-content.parts',
      submitPath: '/v1beta/models/{model}:generateContent',
      submitMethod: 'POST',
      baseUrlStrategy: 'trim-v1' as const,
      priority: 500,
      confidence: 'high' as const,
      source: 'template' as const,
    };

    const result = await geminiImageAdapter.generateImage(
      {
        baseUrl: 'https://gateway.example.com/v1',
        apiKey: 'test-key',
        authType: 'query',
        provider: {
          profileId: binding.profileId,
          profileName: 'Gemini Provider',
          providerType: 'auto',
          baseUrl: 'https://gateway.example.com/v1',
          apiKey: 'test-key',
          authType: 'query',
        },
        binding,
      },
      {
        model: binding.modelId,
        modelRef: {
          profileId: binding.profileId,
          modelId: binding.modelId,
        },
        prompt: 'Draw one image',
        operationIntent: 'generation',
      }
    );

    expect(result).toEqual({
      artifacts: [
        {
          url: `data:image/png;base64,${PNG_BASE64}`,
          source: 'inline',
          mimeType: 'image/png',
          format: 'png',
        },
      ],
    });
  });

  it('uses async image polling when provider binding comes from pricing async-image endpoint', async () => {
    const onProgress = vi.fn();
    const onSubmitted = vi.fn();
    const legacyOnProgress = vi.fn();
    const legacyOnSubmitted = vi.fn();
    const fetcher = vi.fn();
    mocks.generateWithPolling.mockResolvedValue([
      {
        url: 'https://example.com/async.png',
        source: 'url',
        mimeType: 'image/png',
        format: 'png',
      },
    ]);

    const result = await geminiImageAdapter.generateImage(
      {
        baseUrl: 'https://gateway.example.com/v1',
        apiKey: 'test-key',
        authType: 'bearer',
        fetcher,
        provider: {
          profileId: 'provider',
          profileName: 'Async Provider',
          providerType: 'auto',
          baseUrl: 'https://gateway.example.com/v1',
          apiKey: 'test-key',
          authType: 'bearer',
        },
        binding: {
          id: 'binding',
          profileId: 'provider',
          modelId: 'gpt-image-1-vip',
          operation: 'image',
          protocol: 'openai.async.media',
          requestSchema: 'openai.async.image.form',
          responseSchema: 'openai.async.task',
          submitPath: '/videos',
          submitMethod: 'POST',
          pollPathTemplate: '/videos/{taskId}',
          pollMethod: 'GET',
          priority: 700,
          confidence: 'medium',
          source: 'discovered',
        },
      },
      {
        model: 'gpt-image-1-vip',
        modelRef: {
          profileId: 'provider',
          modelId: 'gpt-image-1-vip',
        },
        prompt: 'Draw async',
        operationIntent: 'edit',
        size: '1:1',
        referenceImages: ['data:image/png;base64,abc123'],
        maskImage: 'data:image/png;base64,mask123',
        pollIntervalMs: 1234,
        pollMaxAttempts: 7,
        onProgress,
        onSubmitted,
        params: {
          onProgress: legacyOnProgress,
          onSubmitted: legacyOnSubmitted,
          provider_specific_option: 'preserved',
        },
      }
    );

    expect(mocks.generateWithPolling).toHaveBeenCalledWith(
      {
        model: 'gpt-image-1-vip',
        prompt: 'Draw async',
        size: '1:1',
        referenceImages: ['data:image/png;base64,abc123'],
        maskImage: 'data:image/png;base64,mask123',
      },
      expect.objectContaining({
        interval: 1234,
        maxAttempts: 7,
        onProgress,
        onSubmitted,
        invocation: expect.objectContaining({
          fetcher,
          binding: expect.objectContaining({ id: 'binding' }),
          provider: expect.objectContaining({ profileId: 'provider' }),
        }),
      })
    );
    const pollingOptions = mocks.generateWithPolling.mock.calls[0]?.[1];
    expect(pollingOptions?.onProgress).not.toBe(legacyOnProgress);
    expect(pollingOptions?.onSubmitted).not.toBe(legacyOnSubmitted);
    expect(mocks.generateImage).not.toHaveBeenCalled();
    expect(result).toEqual({
      artifacts: [
        {
          url: 'https://example.com/async.png',
          source: 'url',
          mimeType: 'image/png',
          format: 'png',
        },
      ],
    });
  });
});
