import { beforeEach, describe, expect, it, vi } from 'vitest';
import { generateImageWithGemini, sendChatWithGemini } from './services';

const mocks = vi.hoisted(() => ({
  callApiStreamRaw: vi.fn(),
  completeLLMApiLog: vi.fn(),
  failLLMApiLog: vi.fn(),
  providerSend: vi.fn(),
  startLLMApiLog: vi.fn(() => 'log-1'),
  validateAndEnsureConfig: vi.fn(async (config) => config),
}));

vi.mock('../settings-manager', () => ({
  resolveInvocationRoute: vi.fn(() => ({
    apiKey: 'test-key',
    baseUrl: 'https://example.invalid',
    modelId: 'test-model',
    providerType: 'custom',
  })),
  settingsManager: {
    waitForInitialization: vi.fn(async () => undefined),
  },
}));

vi.mock('../../services/provider-routing', () => ({
  providerTransport: { send: mocks.providerSend },
  resolveProviderBindingAuthQueryKey: (
    binding?: { protocol?: string } | null
  ) => (binding?.protocol === 'google.generateContent' ? 'key' : 'api_key'),
  resolveInvocationPlanFromRoute: vi.fn(() => ({
    binding: {
      protocol: 'openai.chat.completions',
      baseUrlStrategy: 'openai-compatible',
    },
    provider: {
      profileId: 'test-profile',
      profileName: 'Test',
      providerType: 'custom',
      baseUrl: 'https://example.invalid',
      apiKey: 'test-key',
      authType: 'bearer',
    },
  })),
}));

vi.mock('./auth', () => ({
  validateAndEnsureConfig: mocks.validateAndEnsureConfig,
}));

vi.mock('./apiCalls', () => ({
  callApiStreamRaw: mocks.callApiStreamRaw,
  callApiWithRetry: vi.fn(),
  callGoogleGenerateContentRaw: vi.fn(),
  callVideoApiStreamRaw: vi.fn(),
}));

vi.mock('../../services/media-executor/llm-api-logger', () => ({
  startLLMApiLog: mocks.startLLMApiLog,
  completeLLMApiLog: mocks.completeLLMApiLog,
  failLLMApiLog: mocks.failLLMApiLog,
}));

vi.mock('@aitu/utils', () => ({
  normalizeImageDataUrl: vi.fn((value: string) => value),
  truncate: vi.fn((value: string, maxLength: number) =>
    value.slice(0, maxLength)
  ),
}));

describe('sendChatWithGemini stream logging', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.providerSend.mockResolvedValue(
      new Response(
        JSON.stringify({
          data: [{ url: 'https://example.com/generated.png' }],
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }
      )
    );
  });

  it('records the latest accumulated stream value without duplicating prefixes', async () => {
    mocks.callApiStreamRaw.mockImplementation(
      async (_config, _messages, onChunk) => {
        onChunk?.('a');
        onChunk?.('ab');
        onChunk?.('abc');
        return {
          choices: [{ message: { role: 'assistant', content: 'abc' } }],
        };
      }
    );

    const visibleChunks: string[] = [];
    await sendChatWithGemini(
      [{ role: 'user', content: [{ type: 'text', text: 'hello' }] }],
      (content) => visibleChunks.push(content)
    );

    expect(visibleChunks).toEqual(['a', 'ab', 'abc']);
    expect(mocks.completeLLMApiLog).toHaveBeenCalledWith(
      'log-1',
      expect.objectContaining({ resultText: 'abc' })
    );
  });

  it('passes an OpenAI binding query key and submit path to transport', async () => {
    const binding = {
      id: 'auto-openai-image',
      profileId: 'auto-profile',
      modelId: 'generic-image-model',
      operation: 'image' as const,
      protocol: 'openai.images.generations',
      requestSchema: 'openai.image.basic-json',
      responseSchema: 'openai.image.data',
      submitPath: '/custom/images/generations',
      priority: 140,
      confidence: 'medium' as const,
      source: 'discovered' as const,
    };

    await generateImageWithGemini('Draw a cat', {
      model: binding.modelId,
      invocationConfig: {
        apiKey: 'test-key',
        baseUrl: 'https://gateway.example.com/v1',
        modelName: binding.modelId,
        authType: 'query',
        providerType: 'auto',
        protocol: binding.protocol,
        binding,
      },
    });

    expect(mocks.providerSend).toHaveBeenCalledWith(
      expect.objectContaining({
        providerType: 'auto',
        authType: 'query',
      }),
      expect.objectContaining({
        path: '/custom/images/generations',
        authQueryKey: 'api_key',
      })
    );
    expect(mocks.validateAndEnsureConfig).toHaveBeenCalledWith(
      expect.objectContaining({
        apiKey: 'test-key',
        binding,
      }),
      { credentialFallback: 'none' }
    );
  });

  it('rejects an image request without a planned binding before transport', async () => {
    await expect(
      generateImageWithGemini('Draw without a plan', {
        invocationConfig: {
          apiKey: 'test-key',
          baseUrl: 'https://gateway.example.com/v1',
          modelName: 'generic-image-model',
          authType: 'bearer',
          providerType: 'auto',
          binding: null,
        },
      })
    ).rejects.toThrow('图片请求缺少已规划的 InvocationPlan.binding');

    expect(mocks.providerSend).not.toHaveBeenCalled();
  });

  it('logs only a structured provider error summary without response image bytes', async () => {
    const binding = {
      id: 'auto-openai-image',
      profileId: 'auto-profile',
      modelId: 'generic-image-model',
      operation: 'image' as const,
      protocol: 'openai.images.generations',
      requestSchema: 'openai.image.basic-json',
      responseSchema: 'openai.image.data',
      submitPath: '/custom/images/generations',
      priority: 140,
      confidence: 'medium' as const,
      source: 'discovered' as const,
    };
    const imageBytes = 'data:image/png;base64,do-not-log-these-bytes';
    mocks.providerSend.mockResolvedValueOnce(
      new Response(JSON.stringify({ error: { data: imageBytes } }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      })
    );
    const consoleError = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);

    await expect(
      generateImageWithGemini('Draw a cat', {
        model: binding.modelId,
        invocationConfig: {
          apiKey: 'test-key',
          baseUrl: 'https://gateway.example.com/v1',
          modelName: binding.modelId,
          authType: 'bearer',
          providerType: 'auto',
          protocol: binding.protocol,
          binding,
        },
      })
    ).rejects.toMatchObject({
      message: '图片生成请求失败: 400 - 供应商拒绝了图片请求（HTTP 400）',
      apiErrorBody: '供应商拒绝了图片请求（HTTP 400）',
      httpStatus: 400,
    });

    expect(JSON.stringify(consoleError.mock.calls)).not.toContain(imageBytes);
    expect(JSON.stringify(mocks.failLLMApiLog.mock.calls)).not.toContain(
      imageBytes
    );
  });
});
