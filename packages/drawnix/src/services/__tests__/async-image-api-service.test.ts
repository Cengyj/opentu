import { afterEach, describe, expect, it, vi } from 'vitest';
import type {
  ProviderModelBinding,
  ResolvedProviderContext,
} from '../provider-routing';

const mocks = vi.hoisted(() => ({
  send: vi.fn(),
}));

vi.mock('../provider-routing', () => ({
  resolveProviderBindingAuthQueryKey: vi.fn((binding) =>
    binding?.protocol === 'google.generateContent' ? 'key' : 'api_key'
  ),
  resolveProviderBindingPollPath: vi.fn((binding, taskId, fallbackTemplate) =>
    (binding?.pollPathTemplate || fallbackTemplate).replace(
      /\{(?:taskId|task_id|id)\}/g,
      encodeURIComponent(taskId)
    )
  ),
  providerTransport: {
    send: mocks.send,
  },
}));

function deferred(): { promise: Promise<void>; resolve: () => void } {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

const defaultProvider: ResolvedProviderContext = {
  profileId: 'profile-auto',
  profileName: 'default',
  providerType: 'auto',
  baseUrl: 'https://gateway.example.com/v1',
  apiKey: 'secret',
  authType: 'bearer',
};

const defaultBinding: ProviderModelBinding = {
  id: 'profile-auto:async-image:image:openai.async.media',
  profileId: 'profile-auto',
  modelId: 'async-image',
  operation: 'image',
  protocol: 'openai.async.media',
  requestSchema: 'openai.async.image.form',
  responseSchema: 'openai.async.task',
  submitPath: '/videos',
  submitMethod: 'POST',
  pollPathTemplate: '/videos/{taskId}',
  pollMethod: 'GET',
  priority: 360,
  confidence: 'high',
  source: 'discovered',
};

function invocation(
  binding: ProviderModelBinding = defaultBinding,
  provider: ResolvedProviderContext = defaultProvider
) {
  return { provider, binding };
}

describe('async-image-api-service', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('submits async image masks as multipart mask field', async () => {
    mocks.send
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            id: 'async-image-task-1',
            object: 'video',
            model: 'gpt-image-async',
            status: 'completed',
            progress: 100,
            created_at: 1,
            url: 'https://cdn.example.com/out.png',
          }),
          {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          }
        )
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            id: 'async-image-task-1',
            object: 'video',
            model: 'gpt-image-async',
            status: 'completed',
            progress: 100,
            created_at: 1,
            url: 'https://cdn.example.com/out.png',
          }),
          {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          }
        )
      );

    const { asyncImageAPIService } = await import('../async-image-api-service');

    await asyncImageAPIService.generateWithPolling(
      {
        model: 'gpt-image-async',
        prompt: 'edit masked area',
        size: '1:1',
        referenceImages: ['data:image/png;base64,YWJj'],
        maskImage: 'data:image/png;base64,bWFzaw==',
      },
      {
        interval: 1,
        maxAttempts: 1,
        invocation: invocation(),
      }
    );

    expect(mocks.send).toHaveBeenCalledTimes(2);
    const request = mocks.send.mock.calls[0]?.[1];
    expect(request.body).toBeInstanceOf(FormData);
    const formData = request.body as FormData;
    expect(formData.get('input_reference')).toBeInstanceOf(Blob);
    expect(formData.get('mask')).toBeInstanceOf(Blob);
  });

  it('uses the persisted async image binding for submit and polling paths', async () => {
    const binding = {
      id: 'profile-auto:async-image:image:openai.async.media',
      profileId: 'profile-auto',
      modelId: 'async-image',
      operation: 'image',
      protocol: 'openai.async.media',
      requestSchema: 'openai.async.image.form',
      responseSchema: 'openai.async.task',
      submitPath: '/async/images/tasks',
      pollPathTemplate: '/async/images/tasks/{taskId}',
      baseUrlStrategy: 'trim-v1',
      priority: 360,
      confidence: 'high',
      source: 'discovered',
    } as const;
    const provider = {
      ...defaultProvider,
      authType: 'query' as const,
    };
    mocks.send
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            id: 'remote/task 1',
            object: 'video',
            model: 'async-image',
            status: 'queued',
            progress: 1,
            created_at: 1,
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        )
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            id: 'remote/task 1',
            object: 'video',
            model: 'async-image',
            status: 'completed',
            progress: 100,
            created_at: 1,
            url: 'https://cdn.example.com/result.png',
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        )
      );

    const { asyncImageAPIService } = await import('../async-image-api-service');
    await asyncImageAPIService.generateWithPolling(
      {
        model: 'stale-image-model',
        prompt: 'binding contract',
      },
      {
        interval: 1,
        maxAttempts: 1,
        invocation: invocation(binding, provider),
      }
    );

    expect(mocks.send.mock.calls[0]?.[1]).toMatchObject({
      path: '/async/images/tasks',
      authQueryKey: 'api_key',
      baseUrlStrategy: 'trim-v1',
    });
    expect((mocks.send.mock.calls[0]?.[1]?.body as FormData).get('model')).toBe(
      'async-image'
    );
    expect(mocks.send.mock.calls[1]?.[1]).toMatchObject({
      path: '/async/images/tasks/remote%2Ftask%201',
      authQueryKey: 'api_key',
      baseUrlStrategy: 'trim-v1',
    });
  });

  it('fails closed when no resolved binding contract is supplied', async () => {
    const { asyncImageAPIService } = await import('../async-image-api-service');

    await expect(
      asyncImageAPIService.generateWithPolling(
        {
          model: 'async-image',
          prompt: 'must not probe a fallback endpoint',
        },
        undefined as never
      )
    ).rejects.toThrow('异步图片执行缺少已规划 binding');
    expect(mocks.send).not.toHaveBeenCalled();
  });

  it('awaits remoteId persistence before issuing the first query', async () => {
    const persistenceGate = deferred();
    const callbackStarted = deferred();
    mocks.send
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            id: 'async-image-task-ordered',
            object: 'video',
            model: 'async-image',
            status: 'queued',
            progress: 1,
            created_at: 1,
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        )
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            id: 'async-image-task-ordered',
            object: 'video',
            model: 'async-image',
            status: 'completed',
            progress: 100,
            created_at: 1,
            url: 'https://cdn.example.com/out.png',
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        )
      );

    const { asyncImageAPIService } = await import('../async-image-api-service');
    const generation = asyncImageAPIService.generateWithPolling(
      {
        model: 'async-image',
        prompt: 'persist before poll',
      },
      {
        interval: 0,
        maxAttempts: 1,
        invocation: invocation(),
        onSubmitted: async () => {
          callbackStarted.resolve();
          await persistenceGate.promise;
        },
      }
    );

    await callbackStarted.promise;
    expect(mocks.send).toHaveBeenCalledTimes(1);
    persistenceGate.resolve();

    await expect(generation).resolves.toEqual([
      expect.objectContaining({
        url: 'https://cdn.example.com/out.png',
      }),
    ]);
    expect(mocks.send).toHaveBeenCalledTimes(2);
  });

  it('cancels before preprocessing without submitting a provider request', async () => {
    const controller = new AbortController();
    controller.abort(new DOMException('cancel before submit', 'AbortError'));
    const { asyncImageAPIService } = await import('../async-image-api-service');

    await expect(
      asyncImageAPIService.generateWithPolling(
        {
          model: 'async-image',
          prompt: 'must not submit',
          referenceImages: ['data:image/png;base64,YWJj'],
        },
        { signal: controller.signal, invocation: invocation() }
      )
    ).rejects.toMatchObject({ name: 'AbortError' });

    expect(mocks.send).not.toHaveBeenCalled();
  });

  it('fails before submit when a resolved async binding has no poll path', async () => {
    const incompleteBinding: ProviderModelBinding = {
        id: 'incomplete-binding',
        profileId: 'profile-auto',
        modelId: 'async-image',
        operation: 'image',
        protocol: 'openai.async.media',
        requestSchema: 'openai.async.image.form',
        responseSchema: 'openai.async.task',
        submitPath: '/async/images/tasks',
        priority: 360,
        confidence: 'high',
        source: 'discovered',
      };
    const { asyncImageAPIService } = await import('../async-image-api-service');

    await expect(
      asyncImageAPIService.generateWithPolling(
        {
          model: 'async-image',
          prompt: 'must not submit',
        },
        { invocation: invocation(incompleteBinding) }
      )
    ).rejects.toThrow('异步图片 binding 缺少 pollPathTemplate');

    expect(mocks.send).not.toHaveBeenCalled();
  });
});
