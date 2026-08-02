import { afterEach, describe, expect, it, vi } from 'vitest';
import type {
  InvocationPlan,
  ProviderModelBinding,
  ResolvedProviderContext,
} from '../provider-routing';
import { resumeImageInvocationPolling } from './resume-polling';

const DEFAULT_PROVIDER: ResolvedProviderContext = {
  profileId: 'profile-snapshot',
  profileName: 'Snapshot Provider',
  providerType: 'auto',
  baseUrl: 'https://gateway.example.com/v1',
  apiKey: 'secret',
  authType: 'bearer',
};

const DEFAULT_BINDING: ProviderModelBinding = {
  id: 'snapshot-binding',
  profileId: DEFAULT_PROVIDER.profileId,
  modelId: 'async-image-model',
  operation: 'image',
  protocol: 'openai.async.media',
  requestSchema: 'openai.async.image.form',
  responseSchema: 'openai.async.task',
  submitPath: '/must-never-submit',
  submitMethod: 'POST',
  pollPathTemplate: '/async/images/{taskId}',
  pollMethod: 'GET',
  priority: 0,
  confidence: 'high',
  source: 'manual',
};

function plan(
  bindingOverrides: Partial<ProviderModelBinding> = {},
  providerOverrides: Partial<ResolvedProviderContext> = {}
): InvocationPlan {
  const provider = { ...DEFAULT_PROVIDER, ...providerOverrides };
  const binding = {
    ...DEFAULT_BINDING,
    profileId: provider.profileId,
    ...bindingOverrides,
  };
  return {
    provider,
    modelRef: {
      profileId: provider.profileId,
      modelId: binding.modelId,
    },
    binding,
  };
}

function jsonResponse(payload: unknown): Response {
  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('resumeImageInvocationPolling', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('queries an OpenAI async snapshot and normalizes a completed result', async () => {
    const fetcher = vi.fn(
      async (input: RequestInfo | URL, init?: RequestInit) => {
        expect(String(input)).toBe(
          'https://gateway.example.com/v1/async/images/remote%2Ftask%201'
        );
        expect(init?.method).toBe('GET');
        return jsonResponse({
          id: 'remote/task 1',
          status: 'completed',
          progress: 100,
          url: 'https://cdn.example.com/result.png',
        });
      }
    );
    vi.stubGlobal('fetch', fetcher);

    const artifacts = await resumeImageInvocationPolling(
      plan(),
      'remote/task 1',
      { maxAttempts: 1 }
    );

    expect(artifacts).toEqual([
      expect.objectContaining({
        url: 'https://cdn.example.com/result.png',
        mimeType: 'image/png',
      }),
    ]);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('preserves and de-duplicates ordered OpenAI async multi-image results', async () => {
    const fetcher = vi.fn(async () =>
      jsonResponse({
        status: 'completed',
        url: 'https://cdn.example.com/second.png',
        urls: [
          'https://cdn.example.com/first.png',
          { url: 'https://cdn.example.com/second.png' },
        ],
        data: [
          { url: 'https://cdn.example.com/third.webp' },
          { url: 'https://cdn.example.com/first.png' },
        ],
      })
    );
    vi.stubGlobal('fetch', fetcher);

    const artifacts = await resumeImageInvocationPolling(
      plan(),
      'multi-image-task',
      { maxAttempts: 1 }
    );

    expect(artifacts.map((artifact) => artifact.url)).toEqual([
      'https://cdn.example.com/first.png',
      'https://cdn.example.com/second.png',
      'https://cdn.example.com/third.webp',
    ]);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('rejects a completed response without artifacts as an invalid image result', async () => {
    const fetcher = vi.fn(async () =>
      jsonResponse({ status: 'completed', progress: 100, data: [] })
    );
    vi.stubGlobal('fetch', fetcher);

    await expect(
      resumeImageInvocationPolling(plan(), 'empty-completed-task', {
        maxAttempts: 1,
      })
    ).rejects.toMatchObject({
      code: 'IMAGE_RESULT_INVALID',
      stage: 'result',
      details: {
        bindingId: DEFAULT_BINDING.id,
        responseSchema: DEFAULT_BINDING.responseSchema,
      },
    });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('preserves the provider MJ multi-image order without duplicating primary', async () => {
    const fetcher = vi.fn(async () =>
      jsonResponse({
        status: 'SUCCESS',
        imageUrl: 'https://cdn.example.com/b.png',
        imageUrls: [
          { url: 'https://cdn.example.com/a.png' },
          { url: 'https://cdn.example.com/b.png' },
          { url: 'https://cdn.example.com/c.png' },
        ],
      })
    );
    vi.stubGlobal('fetch', fetcher);

    const artifacts = await resumeImageInvocationPolling(
      plan({
        protocol: 'mj.imagine',
        requestSchema: 'mj.imagine.base64-array',
        responseSchema: 'mj.task.status',
        pollPathTemplate: '/mj/task/{taskId}/fetch',
      }),
      'mj-task',
      { maxAttempts: 1 }
    );

    expect(artifacts.map((artifact) => artifact.url)).toEqual([
      'https://cdn.example.com/a.png',
      'https://cdn.example.com/b.png',
      'https://cdn.example.com/c.png',
    ]);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('normalizes a Flux Ready result from its snapshot schema', async () => {
    const fetcher = vi.fn(async () =>
      jsonResponse({
        id: 'flux-task',
        status: 'Ready',
        result: { sample: 'https://cdn.example.com/flux.webp' },
      })
    );
    vi.stubGlobal('fetch', fetcher);

    const artifacts = await resumeImageInvocationPolling(
      plan({
        protocol: 'flux.task',
        requestSchema: 'flux.image.polling-json',
        responseSchema: 'flux.task.status',
        pollPathTemplate: '/flux/v1/get_result?id={taskId}',
      }),
      'flux-task',
      { maxAttempts: 1 }
    );

    expect(artifacts).toEqual([
      expect.objectContaining({
        url: 'https://cdn.example.com/flux.webp',
        mimeType: 'image/webp',
      }),
    ]);
    expect(fetcher.mock.calls[0]?.[1]?.method).toBe('GET');
  });

  it('keeps querying the snapshot poll endpoint from pending to completed', async () => {
    const onProgress = vi.fn();
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse({ status: 'in_progress', progress: 42 })
      )
      .mockResolvedValueOnce(
        jsonResponse({
          status: 'completed',
          url: 'https://cdn.example.com/final.jpg',
        })
      );
    vi.stubGlobal('fetch', fetcher);

    const artifacts = await resumeImageInvocationPolling(plan(), 'task-2', {
      interval: 0,
      maxAttempts: 2,
      onProgress,
    });

    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(fetcher.mock.calls.every(([, init]) => init?.method === 'GET')).toBe(
      true
    );
    expect(onProgress.mock.calls).toEqual([
      [42, 'in_progress'],
      [100, 'completed'],
    ]);
    expect(artifacts[0]?.url).toBe('https://cdn.example.com/final.jpg');
  });

  it('stops after abort without issuing another query', async () => {
    const controller = new AbortController();
    const fetcher = vi.fn(async () =>
      jsonResponse({ status: 'in_progress', progress: 20 })
    );
    vi.stubGlobal('fetch', fetcher);

    const polling = resumeImageInvocationPolling(plan(), 'task-abort', {
      interval: 0,
      maxAttempts: 3,
      signal: controller.signal,
      onProgress: () => {
        controller.abort(new DOMException('cancel recovery', 'AbortError'));
      },
    });

    await expect(polling).rejects.toMatchObject({ name: 'AbortError' });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it.each([
    {
      label: 'unknown response schema',
      plan: plan({ responseSchema: 'unknown.image.task' }),
      message: '没有图片恢复解析器: unknown.image.task',
    },
    {
      label: 'missing poll path',
      plan: plan({ pollPathTemplate: undefined }),
      message: '图片 binding 缺少轮询路径',
    },
  ])(
    'fails before networking for $label',
    async ({ plan: invocation, message }) => {
      const fetcher = vi.fn();
      vi.stubGlobal('fetch', fetcher);

      await expect(
        resumeImageInvocationPolling(invocation, 'task-no-request')
      ).rejects.toThrow(message);
      expect(fetcher).not.toHaveBeenCalled();
    }
  );

  it('uses snapshot poll path, query, base strategy, headers, and query auth', async () => {
    const fetcher = vi.fn(
      async (input: RequestInfo | URL, init?: RequestInit) => {
        expect(String(input)).toBe(
          'https://gateway.example.com/tenant/jobs/remote%2Ftask%203?view=result&api_key=secret'
        );
        expect(init?.method).toBe('GET');
        expect(init?.headers).toMatchObject({ 'X-Tenant': 'tenant-a' });
        return jsonResponse({
          status: 'completed',
          video_url: 'https://cdn.example.com/custom.png',
        });
      }
    );
    vi.stubGlobal('fetch', fetcher);

    const artifacts = await resumeImageInvocationPolling(
      plan(
        {
          pollPathTemplate: '/tenant/jobs/{taskId}?view=result',
          baseUrlStrategy: 'trim-v1',
        },
        {
          authType: 'query',
          extraHeaders: { 'X-Tenant': 'tenant-a' },
        }
      ),
      'remote/task 3',
      { maxAttempts: 1 }
    );

    expect(artifacts[0]?.url).toBe('https://cdn.example.com/custom.png');
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
});
