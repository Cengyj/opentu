import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ProviderModelBinding } from '../provider-routing';
import { fluxImageAdapter } from '../model-adapters/flux-adapter';
import { mjImageAdapter } from '../model-adapters/mj-image-adapter';
import { seedreamImageAdapter } from '../model-adapters/seedream-adapter';

function deferred<T = void>(): {
  promise: Promise<T>;
  resolve: (value: T) => void;
} {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

function binding(
  overrides: Partial<ProviderModelBinding> &
    Pick<ProviderModelBinding, 'protocol' | 'requestSchema' | 'submitPath'>
): ProviderModelBinding {
  return {
    id: 'custom-image-binding',
    profileId: 'custom-profile',
    modelId: 'custom-image-model',
    operation: 'image',
    responseSchema: 'custom.image.response',
    submitMethod: 'POST',
    pollMethod: 'GET',
    priority: 900,
    confidence: 'high',
    source: 'discovered',
    ...overrides,
  };
}

describe('specialized image adapter execution contracts', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('uses MJ binding paths and waits for remoteId persistence before polling', async () => {
    vi.useFakeTimers();
    const persistenceGate = deferred();
    const callbackStarted = deferred();
    const onProgress = vi.fn();
    const legacyParamsOnProgress = vi.fn();
    const legacyParamsOnSubmitted = vi.fn();
    const fetcher = vi.fn(
      async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url === 'https://gateway.example.com/tenant/mj/start') {
        expect(init?.method).toBe('PATCH');
        expect(JSON.parse(String(init?.body))).toMatchObject({
          botType: 'MID_JOURNEY',
          prompt: 'draw a city --ar 16:9 --q 2',
          base64Array: [],
        });
        return new Response(
          JSON.stringify({
            code: 1,
            description: 'submitted',
            result: 'remote/task 1',
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }

      expect(url).toBe(
        'https://gateway.example.com/tenant/mj/jobs/remote%2Ftask%201'
      );
      expect(init?.method).toBe('POST');
      return new Response(
        JSON.stringify({
          status: 'SUCCESS',
          imageUrl: 'https://cdn.example.com/mj.png',
          imageUrls: [
            { url: 'https://cdn.example.com/mj.png' },
            { url: 'https://cdn.example.com/mj-variation.webp' },
          ],
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
      }
    );

    const generation = mjImageAdapter.generateImage(
      {
        baseUrl: 'https://gateway.example.com/v1',
        apiKey: 'secret',
        authType: 'bearer',
        fetcher: fetcher as unknown as typeof fetch,
        binding: binding({
          modelId: 'mj-imagine',
          protocol: 'mj.imagine',
          requestSchema: 'mj.imagine.base64-array',
          responseSchema: 'mj.task.status',
          submitPath: '/tenant/mj/start',
          submitMethod: 'PATCH',
          pollPathTemplate: '/tenant/mj/jobs/{taskId}',
          pollMethod: 'POST',
          baseUrlStrategy: 'trim-v1',
        }),
      },
      {
        model: 'mj-imagine',
        prompt: 'draw a city',
        operationIntent: 'generation',
        onProgress,
        onSubmitted: async (remoteId) => {
          expect(remoteId).toBe('remote/task 1');
          callbackStarted.resolve();
          await persistenceGate.promise;
        },
        params: {
          mj_ar: '16:9',
          mj_q: '2',
          onProgress: legacyParamsOnProgress,
          onSubmitted: legacyParamsOnSubmitted,
        },
      }
    );

    await callbackStarted.promise;
    expect(fetcher).toHaveBeenCalledTimes(1);
    persistenceGate.resolve();
    await vi.advanceTimersByTimeAsync(5000);

    await expect(generation).resolves.toEqual({
      artifacts: [
        {
          url: 'https://cdn.example.com/mj.png',
          source: 'url',
          mimeType: 'image/png',
          format: 'png',
        },
        {
          url: 'https://cdn.example.com/mj-variation.webp',
          source: 'url',
          mimeType: 'image/webp',
          format: 'webp',
        },
      ],
    });
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(onProgress).toHaveBeenCalledWith(5, 'submitting');
    expect(onProgress).toHaveBeenCalledWith(10, 'processing');
    expect(onProgress).toHaveBeenCalledWith(100, 'success');
    expect(legacyParamsOnProgress).not.toHaveBeenCalled();
    expect(legacyParamsOnSubmitted).not.toHaveBeenCalled();
  });

  it('materializes Flux binding templates and persists remoteId before polling', async () => {
    vi.useFakeTimers();
    const persistenceGate = deferred();
    const callbackStarted = deferred();
    const onProgress = vi.fn();
    const legacyParamsOnProgress = vi.fn();
    const legacyParamsOnSubmitted = vi.fn();
    const fetcher = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (
        url === 'https://gateway.example.com/tenant/flux/flux%2Fcustom/start'
      ) {
        return new Response(JSON.stringify({ id: 'flux/task 1' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      expect(url).toBe(
        'https://gateway.example.com/tenant/flux/jobs/flux%2Ftask%201?view=result'
      );
      return new Response(
        JSON.stringify({
          id: 'flux/task 1',
          status: 'Ready',
          result: { sample: 'https://cdn.example.com/flux.png' },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    });

    const generation = fluxImageAdapter.generateImage(
      {
        baseUrl: 'https://gateway.example.com/v1',
        apiKey: 'secret',
        authType: 'bearer',
        fetcher: fetcher as unknown as typeof fetch,
        binding: binding({
          modelId: 'flux/custom',
          protocol: 'flux.task',
          requestSchema: 'flux.image.polling-json',
          responseSchema: 'flux.task.status',
          submitPath: '/tenant/flux/{model}/start',
          pollPathTemplate: '/tenant/flux/jobs/{taskId}?view=result',
          baseUrlStrategy: 'trim-v1',
        }),
      },
      {
        model: 'flux/custom',
        prompt: 'draw a landscape',
        operationIntent: 'generation',
        onProgress,
        onSubmitted: async (remoteId) => {
          expect(remoteId).toBe('flux/task 1');
          callbackStarted.resolve();
          await persistenceGate.promise;
        },
        params: {
          onProgress: legacyParamsOnProgress,
          onSubmitted: legacyParamsOnSubmitted,
        },
      }
    );

    await callbackStarted.promise;
    expect(fetcher).toHaveBeenCalledTimes(1);
    persistenceGate.resolve();
    await vi.advanceTimersByTimeAsync(3000);

    await expect(generation).resolves.toEqual({
      artifacts: [
        {
          url: 'https://cdn.example.com/flux.png',
          source: 'url',
          mimeType: 'image/png',
          format: 'png',
        },
      ],
    });
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(onProgress).toHaveBeenCalledWith(5, 'submitting');
    expect(onProgress).toHaveBeenCalledWith(10, 'processing');
    expect(onProgress).toHaveBeenCalledWith(100, 'Ready');
    expect(legacyParamsOnProgress).not.toHaveBeenCalled();
    expect(legacyParamsOnSubmitted).not.toHaveBeenCalled();
  });

  it('cancels Flux polling wait without issuing a query', async () => {
    vi.useFakeTimers();
    const submitted = deferred();
    const controller = new AbortController();
    const fetcher = vi.fn(
      async () =>
        new Response(JSON.stringify({ id: 'flux-task' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
    );

    const generation = fluxImageAdapter.generateImage(
      {
        baseUrl: 'https://gateway.example.com/v1',
        apiKey: 'secret',
        authType: 'bearer',
        fetcher: fetcher as unknown as typeof fetch,
        binding: binding({
          modelId: 'flux-model',
          protocol: 'flux.task',
          requestSchema: 'flux.image.polling-json',
          responseSchema: 'flux.task.status',
          submitPath: '/flux/start',
          pollPathTemplate: '/flux/tasks/{taskId}',
        }),
      },
      {
        model: 'flux-model',
        prompt: 'draw a landscape',
        operationIntent: 'generation',
        signal: controller.signal,
        onSubmitted: () => submitted.resolve(),
      }
    );

    await submitted.promise;
    controller.abort(new DOMException('cancel polling', 'AbortError'));

    await expect(generation).rejects.toMatchObject({ name: 'AbortError' });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('uses Seedream binding submitPath and baseUrlStrategy', async () => {
    const fetcher = vi.fn(
      async (_input: RequestInfo | URL, _init?: RequestInit) =>
        new Response(
          JSON.stringify({
            data: [{ url: 'https://cdn.example.com/seedream.webp' }],
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        )
    );

    const result = await seedreamImageAdapter.generateImage(
      {
        baseUrl: 'https://gateway.example.com/v1',
        apiKey: 'secret',
        authType: 'bearer',
        fetcher,
        binding: binding({
          modelId: 'doubao-seedream-5-0-260128',
          protocol: 'openai.images.generations',
          requestSchema: 'openai.image.seedream-json',
          submitPath: '/tenant/seedream/generate',
          baseUrlStrategy: 'trim-v1',
        }),
      },
      {
        model: 'doubao-seedream-5-0-260128',
        prompt: 'draw a product',
        operationIntent: 'generation',
        size: '1:1',
        params: { seedream_quality: '4k' },
      }
    );

    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(fetcher.mock.calls[0]?.[0]).toBe(
      'https://gateway.example.com/tenant/seedream/generate'
    );
    expect(JSON.parse(String(fetcher.mock.calls[0]?.[1]?.body))).toMatchObject({
      model: 'doubao-seedream-5-0-260128',
      size: '4096x4096',
    });
    expect(result).toEqual({
      artifacts: [
        {
          url: 'https://cdn.example.com/seedream.webp',
          source: 'url',
          mimeType: 'image/webp',
          format: 'webp',
        },
      ],
    });
  });

  it('fails before submit when an async binding lacks a poll path', async () => {
    const fetcher = vi.fn();

    await expect(
      mjImageAdapter.generateImage(
        {
          baseUrl: 'https://gateway.example.com/v1',
          apiKey: 'secret',
          authType: 'bearer',
          fetcher,
          binding: binding({
            modelId: 'mj-imagine',
            protocol: 'mj.imagine',
            requestSchema: 'mj.imagine.base64-array',
            responseSchema: 'mj.task.status',
            submitPath: '/mj/start',
          }),
        },
        {
          model: 'mj-imagine',
          prompt: 'draw a city',
          operationIntent: 'generation',
        }
      )
    ).rejects.toThrow('MJ adapter binding 缺少 pollPathTemplate');

    expect(fetcher).not.toHaveBeenCalled();
  });
});
