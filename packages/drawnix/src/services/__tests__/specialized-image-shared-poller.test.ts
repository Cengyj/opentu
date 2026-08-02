import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ProviderModelBinding } from '../provider-routing';
import { fluxImageAdapter } from '../model-adapters/flux-adapter';
import { mjImageAdapter } from '../model-adapters/mj-image-adapter';

const mocks = vi.hoisted(() => ({
  pollImageInvocationBinding: vi.fn(),
}));

vi.mock('../image-invocation/resume-polling', () => ({
  pollImageInvocationBinding: mocks.pollImageInvocationBinding,
}));

function binding(
  overrides: Pick<
    ProviderModelBinding,
    | 'modelId'
    | 'protocol'
    | 'requestSchema'
    | 'responseSchema'
    | 'submitPath'
    | 'pollPathTemplate'
  >
): ProviderModelBinding {
  return {
    id: `profile-shared-poller:${overrides.modelId}:image`,
    profileId: 'profile-shared-poller',
    operation: 'image',
    priority: 100,
    confidence: 'high',
    source: 'manual',
    ...overrides,
  };
}

describe('specialized image adapters use the canonical poller', () => {
  beforeEach(() => {
    mocks.pollImageInvocationBinding.mockReset();
    mocks.pollImageInvocationBinding.mockResolvedValue([
      {
        url: 'https://cdn.example.com/shared-poller.png',
        source: 'url',
        mimeType: 'image/png',
        format: 'png',
      },
    ]);
  });

  it.each([
    {
      label: 'MJ',
      adapter: mjImageAdapter,
      binding: binding({
        modelId: 'mj-imagine',
        protocol: 'mj.imagine',
        requestSchema: 'mj.imagine.base64-array',
        responseSchema: 'mj.task.status',
        submitPath: '/mj/submit',
        submitMethod: 'POST',
        pollPathTemplate: '/mj/tasks/{taskId}',
        pollMethod: 'GET',
      }),
      submitPayload: { code: 1, result: 'mj-remote-id' },
      remoteId: 'mj-remote-id',
    },
    {
      label: 'Flux',
      adapter: fluxImageAdapter,
      binding: binding({
        modelId: 'bfl-flux-2-flex',
        protocol: 'flux.task',
        requestSchema: 'flux.image.polling-json',
        responseSchema: 'flux.task.status',
        submitPath: '/flux/submit',
        submitMethod: 'POST',
        pollPathTemplate: '/flux/tasks/{taskId}',
        pollMethod: 'GET',
      }),
      submitPayload: { id: 'flux-remote-id' },
      remoteId: 'flux-remote-id',
    },
  ])('$label delegates polling exactly once', async (testCase) => {
    const fetcher = vi.fn(async () =>
      new Response(JSON.stringify(testCase.submitPayload), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    );
    const onSubmitted = vi.fn(async () => undefined);

    const result = await testCase.adapter.generateImage(
      {
        baseUrl: 'https://gateway.example.com/v1',
        apiKey: 'secret',
        authType: 'bearer',
        binding: testCase.binding,
        fetcher,
      },
      {
        model: testCase.binding.modelId,
        prompt: 'shared poller contract',
        operationIntent: 'generation',
        onSubmitted,
        pollIntervalMs: 0,
        pollMaxAttempts: 1,
      }
    );

    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(onSubmitted).toHaveBeenCalledWith(testCase.remoteId);
    expect(mocks.pollImageInvocationBinding).toHaveBeenCalledTimes(1);
    expect(mocks.pollImageInvocationBinding).toHaveBeenCalledWith(
      expect.objectContaining({ binding: testCase.binding }),
      testCase.remoteId,
      expect.objectContaining({
        interval: 0,
        maxAttempts: 1,
        fetcher,
      })
    );
    expect(result.artifacts).toEqual([
      expect.objectContaining({
        url: 'https://cdn.example.com/shared-poller.png',
      }),
    ]);
  });

  it('does not start polling when durable remoteId persistence rejects', async () => {
    const mjBinding = binding({
      modelId: 'mj-imagine',
      protocol: 'mj.imagine',
      requestSchema: 'mj.imagine.base64-array',
      responseSchema: 'mj.task.status',
      submitPath: '/mj/submit',
      submitMethod: 'POST',
      pollPathTemplate: '/mj/tasks/{taskId}',
      pollMethod: 'GET',
    });
    const fetcher = vi.fn(async () =>
      new Response(JSON.stringify({ code: 1, result: 'remote-rejected' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    );

    await expect(
      mjImageAdapter.generateImage(
        {
          baseUrl: 'https://gateway.example.com/v1',
          apiKey: 'secret',
          authType: 'bearer',
          binding: mjBinding,
          fetcher,
        },
        {
          model: mjBinding.modelId,
          prompt: 'persistence must win',
          operationIntent: 'generation',
          onSubmitted: async () => {
            throw new Error('remoteId persistence rejected');
          },
        }
      )
    ).rejects.toThrow('remoteId persistence rejected');

    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(mocks.pollImageInvocationBinding).not.toHaveBeenCalled();
  });
});
