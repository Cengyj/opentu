import { describe, expect, it, vi } from 'vitest';
import type { InvocationPlan } from '../provider-routing';
import type { ImageModelAdapter } from '../model-adapters/types';
import { resolveImageBindingCapabilities } from './capabilities';
import { executeResolvedImageInvocation } from './execute';
import { normalizeImageRequest } from './normalize-request';
import { createImageInvocationTelemetry } from './performance';
import { prepareImageInputs } from './reference-materializer';
import type { ResolvedImageInvocation } from './resolve-invocation';

function deferred(): { promise: Promise<void>; resolve: () => void } {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

function createInvocation(
  references: readonly string[],
  adapter: ImageModelAdapter,
  signal?: AbortSignal
): ResolvedImageInvocation {
  const plan: InvocationPlan = {
    provider: {
      profileId: 'profile-reference',
      profileName: 'Reference Provider',
      providerType: 'custom',
      baseUrl: 'https://gateway.example.com/v1',
      apiKey: 'secret',
      authType: 'bearer',
    },
    modelRef: {
      profileId: 'profile-reference',
      modelId: 'reference-image-model',
    },
    binding: {
      id: 'profile-reference:reference-image-model:image:mj',
      profileId: 'profile-reference',
      modelId: 'reference-image-model',
      operation: 'image',
      protocol: 'mj.imagine',
      requestSchema: 'mj.imagine.base64-array',
      responseSchema: 'mj.task.status',
      submitPath: '/mj/submit',
      pollPathTemplate: '/mj/tasks/{taskId}',
      priority: 100,
      confidence: 'high',
      source: 'manual',
    },
  };
  const request = normalizeImageRequest({
    prompt: 'prepare references',
    modelRef: plan.modelRef,
    referenceImages: references,
    signal,
  });

  return Object.freeze({
    request,
    intent: references.length > 0 ? 'edit' : 'generation',
    preferredRequestSchema: ['openai.image.gpt-edit-form'],
    plan,
    modelRef: plan.modelRef,
    modelId: plan.modelRef.modelId,
    adapter,
    adapterContext: {
      baseUrl: plan.provider.baseUrl,
      apiKey: plan.provider.apiKey,
      authType: plan.provider.authType,
      provider: plan.provider,
      binding: plan.binding,
    },
    capabilities: resolveImageBindingCapabilities(plan.binding),
    telemetry: createImageInvocationTelemetry(),
  });
}

describe('image reference materialization contract', () => {
  it('materializes one source once across references and mask while preserving positions', async () => {
    const materialize = vi.fn(async (source: string) => `prepared:${source}`);
    const telemetry = createImageInvocationTelemetry();

    const prepared = await prepareImageInputs(
      ['same-source', 'other-source', 'same-source'],
      'same-source',
      { materialize, concurrency: 3, telemetry }
    );

    expect(prepared).toEqual({
      referenceImages: [
        'prepared:same-source',
        'prepared:other-source',
        'prepared:same-source',
      ],
      maskImage: 'prepared:same-source',
    });
    expect(materialize).toHaveBeenCalledTimes(2);
    expect(materialize).toHaveBeenCalledWith('same-source', undefined);
    expect(materialize).toHaveBeenCalledWith('other-source', undefined);
    expect(telemetry.snapshot().counters.referenceMaterializations).toBe(2);
  });

  it('never runs more than three reference workers concurrently', async () => {
    const gate = deferred();
    let active = 0;
    let maximumActive = 0;
    const materialize = vi.fn(async (source: string) => {
      active += 1;
      maximumActive = Math.max(maximumActive, active);
      await gate.promise;
      active -= 1;
      return `prepared:${source}`;
    });

    const preparation = prepareImageInputs(
      Array.from({ length: 8 }, (_, index) => `source-${index}`),
      undefined,
      { materialize }
    );

    await vi.waitFor(() => expect(materialize).toHaveBeenCalledTimes(3));
    expect(maximumActive).toBe(3);
    gate.resolve();
    const prepared = await preparation;
    expect(prepared.referenceImages).toHaveLength(8);
    expect(materialize).toHaveBeenCalledTimes(8);
    expect(maximumActive).toBe(3);
  });

  it('does not start another worker or invoke the adapter after cancellation', async () => {
    const gate = deferred();
    const controller = new AbortController();
    const materialize = vi.fn(async (source: string) => {
      await gate.promise;
      return `prepared:${source}`;
    });
    const generateImage = vi.fn(async () => ({
      artifacts: [
        {
          url: 'https://cdn.example.com/must-not-exist.png',
          source: 'url' as const,
          mimeType: 'image/png',
          format: 'png',
        },
      ],
    }));
    const adapter: ImageModelAdapter = {
      id: 'reference-test-adapter',
      label: 'Reference Test Adapter',
      kind: 'image',
      generateImage,
    };
    const invocation = createInvocation(
      Array.from({ length: 7 }, (_, index) => `source-${index}`),
      adapter,
      controller.signal
    );

    const execution = executeResolvedImageInvocation(invocation, {
      materializeReference: materialize,
      referenceConcurrency: 3,
    });
    await vi.waitFor(() => expect(materialize).toHaveBeenCalledTimes(3));
    controller.abort(new DOMException('cancel preparation', 'AbortError'));
    gate.resolve();

    await expect(execution).rejects.toMatchObject({ name: 'AbortError' });
    expect(materialize).toHaveBeenCalledTimes(3);
    expect(generateImage).not.toHaveBeenCalled();
    expect(invocation.telemetry.snapshot().counters.submitRequests).toBe(
      undefined
    );
  });
});
