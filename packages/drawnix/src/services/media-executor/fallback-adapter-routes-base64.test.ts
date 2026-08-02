/**
 * @vitest-environment node
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  createImageInvocationTelemetry,
  resolveImageBindingCapabilities,
  type ResolvedImageInvocation,
} from '../image-invocation';
import type { ImageModelAdapter } from '../model-adapters/types';
import type { InvocationPlan } from '../provider-routing';

const TINY_PNG_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

function createTestInvocation(
  adapter: ImageModelAdapter,
  prompt: string
): ResolvedImageInvocation {
  const plan: InvocationPlan = {
    provider: {
      profileId: 'profile-test',
      profileName: 'Test Provider',
      providerType: 'openai-compatible',
      baseUrl: 'https://api.example.test/v1',
      apiKey: 'test-key',
      authType: 'bearer',
    },
    modelRef: {
      profileId: 'profile-test',
      modelId: 'gpt-image-2',
    },
    binding: {
      id: 'profile-test:gpt-image-2:image:generation',
      profileId: 'profile-test',
      modelId: 'gpt-image-2',
      operation: 'image',
      protocol: 'openai.images.generations',
      requestSchema: 'openai.image.gpt-generation-json',
      responseSchema: 'openai.image.data',
      submitPath: '/images/generations',
      priority: 100,
      confidence: 'high',
      source: 'manual',
    },
  };
  return Object.freeze({
    request: Object.freeze({
      prompt,
      model: 'gpt-image-2',
      modelRef: plan.modelRef,
      referenceImages: Object.freeze([]),
      params: Object.freeze({}),
    }),
    intent: 'generation',
    preferredRequestSchema: undefined,
    plan,
    modelRef: plan.modelRef,
    modelId: 'gpt-image-2',
    adapter,
    adapterContext: {
      baseUrl: 'https://api.example.test/v1',
      apiKey: 'test-key',
      authType: 'bearer',
      provider: plan.provider,
      binding: plan.binding,
    },
    capabilities: resolveImageBindingCapabilities(plan.binding),
    telemetry: createImageInvocationTelemetry(),
  });
}

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
    const attemptStartedAt = 777;
    const updateRemoteId = vi.fn(async () => true);
    const completeTask = vi.fn(async (taskId: string, result: any) => ({
      id: taskId,
      type: 'image' as const,
      status: 'completed' as const,
      params: { prompt: 'A tiny test image' },
      createdAt: 1,
      startedAt: attemptStartedAt,
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
        updateRemoteId,
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
      createTaskInvocationRouteSnapshotFromPlan: vi.fn(() => undefined),
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
    const adapterGenerateImage: ImageModelAdapter['generateImage'] = vi.fn(
      async (_context, request) => {
        await request.onSubmitted?.('provider-remote-id');
        return {
          artifacts: [
            {
              url: `data:image/png;base64,${TINY_PNG_BASE64}`,
              mimeType: 'image/png',
              format: 'png',
            },
          ],
        };
      }
    );
    const adapter: ImageModelAdapter = {
      id: 'test-b64-adapter',
      label: 'Test Base64 Adapter',
      kind: 'image',
      generateImage: adapterGenerateImage,
    };

    await executeImageViaAdapter(
      'task-base64-cache',
      {
        imageInvocation: createTestInvocation(adapter, 'A tiny test image'),
      },
      { imageAttemptStartedAt: attemptStartedAt }
    );

    expect(adapterGenerateImage).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ operationIntent: 'generation' })
    );

    const cachedUrl = cacheMediaFromBlob.mock.calls[0]?.[0] as string;
    expect(fetchMock).not.toHaveBeenCalled();
    expect(cacheMediaFromBlob).toHaveBeenCalledTimes(1);
    expect(cachedUrl).toMatch(
      /^\/__aitu_cache__\/image\/content-[a-f0-9]{64}\.png$/
    );
    expect(cachedUrls.has(cachedUrl)).toBe(true);
    expect(cacheMediaFromBlob.mock.invocationCallOrder[0]).toBeLessThan(
      completeTask.mock.invocationCallOrder[0]
    );
    expect(updateRemoteId).toHaveBeenCalledWith(
      'task-base64-cache',
      'provider-remote-id',
      undefined,
      { expectedStartedAt: attemptStartedAt }
    );
    expect(completeTask).toHaveBeenCalledWith(
      'task-base64-cache',
      {
        url: cachedUrl,
        urls: undefined,
        imageArtifacts: [
          {
            url: cachedUrl,
            mimeType: 'image/png',
            format: 'png',
          },
        ],
        format: 'png',
        size: 0,
      },
      { expectedStartedAt: attemptStartedAt }
    );
  });

  it('fails without completing when durable image cache persistence fails', async () => {
    const completeTask = vi.fn();
    const failTask = vi.fn(
      async (taskId: string, error: { code: string; message: string }) => ({
        id: taskId,
        type: 'image' as const,
        status: 'failed' as const,
        params: { prompt: 'A tiny test image' },
        createdAt: 1,
        updatedAt: 2,
        progress: 95,
        error,
      })
    );
    const cacheMediaFromBlob = vi.fn(async () => {
      throw new Error('cache write failed');
    });

    vi.doMock('./task-storage-writer', () => ({
      taskStorageWriter: {
        completeTask,
        failTask,
      },
    }));
    vi.doMock('../unified-cache-service', () => ({
      unifiedCacheService: {
        isCached: vi.fn(async () => false),
        cacheMediaFromBlob,
      },
    }));
    vi.doMock('./llm-api-logger', () => ({
      startLLMApiLog: vi.fn(() => 'log-cache-failure'),
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
    }));
    vi.doMock('../task-invocation-route', () => ({
      createTaskInvocationRouteSnapshot: vi.fn(),
      createTaskInvocationRouteSnapshotFromPlan: vi.fn(() => undefined),
    }));
    vi.doMock('../video-binding-utils', () => ({
      downloadVideoContentToLocalUrl: vi.fn(),
      extractInlineVideoUrl: vi.fn(),
      resolveVideoPollPath: vi.fn(),
      shouldDownloadVideoContent: vi.fn(),
    }));

    const { executeImageViaAdapter } = await import(
      './fallback-adapter-routes'
    );
    const adapter: ImageModelAdapter = {
      id: 'test-cache-failure-adapter',
      label: 'Test Cache Failure Adapter',
      kind: 'image',
      async generateImage() {
        return {
          artifacts: [
            {
              url: `data:image/png;base64,${TINY_PNG_BASE64}`,
              mimeType: 'image/png',
              format: 'png',
            },
          ],
        };
      },
    };

    const outcome = await executeImageViaAdapter(
      'task-cache-failure',
      {
        imageInvocation: createTestInvocation(adapter, 'A tiny test image'),
      }
    );

    expect(completeTask).not.toHaveBeenCalled();
    expect(failTask).toHaveBeenCalledWith('task-cache-failure', {
      code: 'IMAGE_CACHE_PERSISTENCE_FAILED',
      message: expect.stringContaining('图片结果未能持久化到本地缓存'),
    });
    expect(outcome).toMatchObject({
      status: 'failed',
      error: { code: 'IMAGE_CACHE_PERSISTENCE_FAILED' },
    });
  });

  it('does not enter polling when the remoteId attempt write is rejected', async () => {
    const updateRemoteId = vi.fn(async () => false);
    const completeTask = vi.fn();
    const failTask = vi.fn(
      async (taskId: string, error: { code: string; message: string }) => ({
        id: taskId,
        type: 'image' as const,
        status: 'failed' as const,
        params: { prompt: 'Persist before polling' },
        createdAt: 1,
        updatedAt: 2,
        progress: 10,
        error,
      })
    );
    vi.doMock('./task-storage-writer', () => ({
      taskStorageWriter: { updateRemoteId, completeTask, failTask },
    }));
    vi.doMock('../unified-cache-service', () => ({
      unifiedCacheService: {
        isCached: vi.fn(async () => false),
        cacheMediaFromBlob: vi.fn(),
      },
    }));
    vi.doMock('./llm-api-logger', () => ({
      startLLMApiLog: vi.fn(() => 'log-rejected-remote-id'),
      completeLLMApiLog: vi.fn(),
      failLLMApiLog: vi.fn(),
    }));
    vi.doMock('../../utils/api-auth-error-event', () => ({
      classifyApiCredentialError: vi.fn(() => null),
      dispatchApiAuthError: vi.fn(),
    }));
    vi.doMock('../task-invocation-route', () => ({
      createTaskInvocationRouteSnapshot: vi.fn(),
      createTaskInvocationRouteSnapshotFromPlan: vi.fn(() => ({
        operation: 'image',
      })),
    }));
    vi.doMock('../video-binding-utils', () => ({
      downloadVideoContentToLocalUrl: vi.fn(),
      extractInlineVideoUrl: vi.fn(),
      resolveVideoPollPath: vi.fn(),
      shouldDownloadVideoContent: vi.fn(),
    }));

    const { executeImageViaAdapter } = await import(
      './fallback-adapter-routes'
    );
    let pollAttempts = 0;
    const adapter: ImageModelAdapter = {
      id: 'remote-id-rejection-adapter',
      label: 'Remote ID Rejection Adapter',
      kind: 'image',
      async generateImage(_context, request) {
        await request.onSubmitted?.('remote-id-rejected');
        pollAttempts += 1;
        return {
          artifacts: [
            {
              url: 'https://cdn.example.com/must-not-complete.png',
              mimeType: 'image/png',
              format: 'png',
            },
          ],
        };
      },
    };

    const outcome = await executeImageViaAdapter('task-remote-id-rejected', {
      imageInvocation: createTestInvocation(
        adapter,
        'Persist before polling'
      ),
    });

    expect(updateRemoteId).toHaveBeenCalledTimes(1);
    expect(pollAttempts).toBe(0);
    expect(completeTask).not.toHaveBeenCalled();
    expect(failTask).toHaveBeenCalledTimes(1);
    expect(outcome.status).toBe('failed');
  });
});
