import { beforeEach, describe, expect, it, vi } from 'vitest';
import { sendChatWithGemini } from './services';

const mocks = vi.hoisted(() => ({
  callApiStreamRaw: vi.fn(),
  completeLLMApiLog: vi.fn(),
  failLLMApiLog: vi.fn(),
  startLLMApiLog: vi.fn(() => 'log-1'),
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
  providerTransport: { send: vi.fn() },
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
  validateAndEnsureConfig: vi.fn(async (config) => config),
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
});
