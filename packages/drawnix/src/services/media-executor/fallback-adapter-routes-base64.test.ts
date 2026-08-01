/**
 * @vitest-environment node
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ImageModelAdapter } from '../model-adapters/types';

const TINY_PNG_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

describe('executeImageViaAdapter base64 completion', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.resetModules();
    vi.doUnmock('./task-storage-writer');
    vi.doUnmock('../unified-cache-service');
    vi.doUnmock('./llm-api-logger');
    vi.doUnmock('../../utils/api-auth-error-event');
    vi.doUnmock('../model-adapters');
    vi.doUnmock('../task-invocation-route');
    vi.doUnmock('../video-binding-utils');
  });

  it('caches a b64_json-style result and persists the local cache URL as the task result', async () => {
    const completeTask = vi.fn(async (taskId: string, result: any) => ({
      id: taskId,
      type: 'image' as const,
      status: 'completed' as const,
      params: { prompt: 'A tiny test image' },
      createdAt: 1,
      updatedAt: 2,
      completedAt: 2,
      progress: 100,
      result,
    }));
    const cachedUrls = new Set<string>();
    const isCached = vi.fn(async (url: string) => cachedUrls.has(url));
    const cacheMediaFromBlob = vi.fn(async (url: string) => {
      cachedUrls.add(url);
      return url;
    });
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(new Blob(['png-bytes'], { type: 'image/png' }), {
        status: 200,
      })
    );

    vi.doMock('./task-storage-writer', () => ({
      taskStorageWriter: {
        completeTask,
        failTask: vi.fn(),
      },
    }));
    vi.doMock('../unified-cache-service', () => ({
      unifiedCacheService: { isCached, cacheMediaFromBlob },
    }));
    vi.doMock('./llm-api-logger', () => ({
      startLLMApiLog: vi.fn(() => 'log-base64'),
      completeLLMApiLog: vi.fn(),
      failLLMApiLog: vi.fn(),
    }));
    vi.doMock('../../utils/api-auth-error-event', () => ({
      classifyApiCredentialError: vi.fn(() => null),
      dispatchApiAuthError: vi.fn(),
    }));
    vi.doMock('../model-adapters', () => ({
      getAdapterContextFromSettings: vi.fn(() => ({
        baseUrl: 'https://api.example.test/v1',
        apiKey: 'test-key',
        authType: 'bearer',
      })),
      GPT_IMAGE_EDIT_REQUEST_SCHEMAS: ['openai.images.edit'],
      isGPTImageEditRequestSchema: vi.fn(() => false),
    }));
    vi.doMock('../task-invocation-route', () => ({
      createTaskInvocationRouteSnapshot: vi.fn(),
    }));
    vi.doMock('../video-binding-utils', () => ({
      downloadVideoContentToLocalUrl: vi.fn(),
      extractInlineVideoUrl: vi.fn(),
      resolveVideoPollPath: vi.fn(),
      shouldDownloadVideoContent: vi.fn(),
    }));
    vi.stubGlobal('fetch', fetchMock);

    const { executeImageViaAdapter } = await import(
      './fallback-adapter-routes'
    );
    const adapter: ImageModelAdapter = {
      id: 'test-b64-adapter',
      label: 'Test Base64 Adapter',
      kind: 'image',
      async generateImage() {
        return { url: TINY_PNG_BASE64, format: 'png' };
      },
    };

    await executeImageViaAdapter('task-base64-cache', adapter, {
      prompt: 'A tiny test image',
      model: 'gpt-image-2',
    });

    const cachedUrl = cacheMediaFromBlob.mock.calls[0]?.[0] as string;
    expect(fetchMock).not.toHaveBeenCalled();
    expect(cacheMediaFromBlob).toHaveBeenCalledTimes(1);
    expect(cachedUrl).toMatch(
      /^\/__aitu_cache__\/image\/content-[a-f0-9]{64}\.png$/
    );
    expect(cachedUrls.has(cachedUrl)).toBe(true);
    expect(completeTask).toHaveBeenCalledWith('task-base64-cache', {
      url: cachedUrl,
      urls: undefined,
      format: 'png',
      size: 0,
    });
  });
});
