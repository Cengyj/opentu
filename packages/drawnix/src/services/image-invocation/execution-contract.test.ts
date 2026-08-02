import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  InvocationPlanningError,
  type InvocationPlan,
} from '../provider-routing';
import type { ImageModelAdapter } from '../model-adapters/types';
import { executeResolvedImageInvocation } from './execute';
import { createImageInvocationTelemetry } from './performance';
import { resolveImageInvocation } from './resolve-invocation';

const mocks = vi.hoisted(() => ({
  resolveInvocationPlanFromRoute: vi.fn(),
  resolveAdapterForPlan: vi.fn(),
}));

vi.mock('../provider-routing', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../provider-routing')>();
  return {
    ...actual,
    resolveInvocationPlanFromRoute: mocks.resolveInvocationPlanFromRoute,
  };
});

vi.mock('../model-adapters/registry', async (importOriginal) => {
  const actual = await importOriginal<
    typeof import('../model-adapters/registry')
  >();
  return {
    ...actual,
    resolveAdapterForPlan: mocks.resolveAdapterForPlan,
  };
});

const PLAN: InvocationPlan = {
  provider: {
    profileId: 'profile-performance',
    profileName: 'Performance Provider',
    providerType: 'auto',
    baseUrl: 'https://gateway.example.com/v1',
    apiKey: 'secret',
    authType: 'bearer',
  },
  modelRef: {
    profileId: 'profile-performance',
    modelId: 'gpt-image-2',
  },
  binding: {
    id: 'profile-performance:gpt-image-2:image:generation',
    profileId: 'profile-performance',
    modelId: 'gpt-image-2',
    operation: 'image',
    protocol: 'openai.images.generations',
    requestSchema: 'openai.image.gpt-generation-json',
    responseSchema: 'openai.image.data',
    submitPath: '/images/generations',
    submitMethod: 'POST',
    priority: 100,
    confidence: 'high',
    source: 'manual',
  },
};

describe('resolved image execution performance contract', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  beforeEach(() => {
    mocks.resolveInvocationPlanFromRoute.mockReset();
    mocks.resolveAdapterForPlan.mockReset();
  });

  it('normalizes, plans, resolves the adapter and submits exactly once', async () => {
    const generateImage = vi.fn<ImageModelAdapter['generateImage']>(
      async (_context, request) => {
        request.telemetry?.increment('submitRequests');
        const submit = async () => ({
          artifacts: [
            {
              url: 'https://cdn.example.com/result.png',
              source: 'url' as const,
              mimeType: 'image/png' as const,
              format: 'png' as const,
            },
          ],
        });
        return request.telemetry
          ? request.telemetry.measure('submit', submit)
          : submit();
      }
    );
    const adapter: ImageModelAdapter = {
      id: 'performance-contract-adapter',
      label: 'Performance Contract Adapter',
      kind: 'image',
      generateImage,
    };
    mocks.resolveInvocationPlanFromRoute.mockReturnValue(PLAN);
    mocks.resolveAdapterForPlan.mockReturnValue(adapter);
    let now = 0;
    const telemetry = createImageInvocationTelemetry({
      now: () => {
        const measuredAt = now;
        now += 2;
        return measuredAt;
      },
    });

    const invocation = resolveImageInvocation(
      {
        prompt: 'one logical invocation',
        modelRef: PLAN.modelRef,
      },
      { telemetry }
    );
    const result = await executeResolvedImageInvocation(invocation);

    expect(result.artifacts).toHaveLength(1);
    expect(mocks.resolveInvocationPlanFromRoute).toHaveBeenCalledTimes(1);
    expect(mocks.resolveAdapterForPlan).toHaveBeenCalledTimes(1);
    expect(generateImage).toHaveBeenCalledTimes(1);
    const completedSnapshot = telemetry.snapshot();
    expect(completedSnapshot).toEqual({
      durationsMs: {
        normalization: 2,
        planning: 2,
        adapterResolution: 2,
        capabilityValidation: 2,
        referencePreparation: 2,
        submit: 2,
      },
      counters: {
        normalizationCalls: 1,
        plannerCalls: 1,
        adapterResolutionCalls: 1,
        capabilityValidationCalls: 1,
        submitRequests: 1,
      },
    });
    expect(completedSnapshot.counters).toMatchObject({
      normalizationCalls: 1,
      plannerCalls: 1,
      adapterResolutionCalls: 1,
      capabilityValidationCalls: 1,
      submitRequests: 1,
    });
    expect(Object.isFrozen(completedSnapshot)).toBe(true);
    expect(Object.isFrozen(completedSnapshot.durationsMs)).toBe(true);
    expect(Object.isFrozen(completedSnapshot.counters)).toBe(true);

    telemetry.increment('pollRequests');
    expect(completedSnapshot.counters).not.toHaveProperty('pollRequests');
    expect(telemetry.snapshot().counters.pollRequests).toBe(1);
  });

  it('rejects unknown provider params before adapter execution or transport', () => {
    const transport = vi.fn();
    const generateImage = vi.fn<ImageModelAdapter['generateImage']>();
    vi.stubGlobal('fetch', transport);
    mocks.resolveInvocationPlanFromRoute.mockReturnValue(PLAN);
    mocks.resolveAdapterForPlan.mockReturnValue({
      id: 'must-not-execute-adapter',
      label: 'Must not execute',
      kind: 'image',
      generateImage,
    } satisfies ImageModelAdapter);

    expect(() =>
      resolveImageInvocation({
        prompt: 'do not submit',
        modelRef: PLAN.modelRef,
        params: { provider_option: 'silently-ignored-before-this-contract' },
      })
    ).toThrowError(
      expect.objectContaining({
        name: 'ImageInvocationError',
        code: 'IMAGE_PARAMETER_UNSUPPORTED',
        stage: 'capability-validation',
        details: expect.objectContaining({
          bindingId: PLAN.binding.id,
          requestSchema: PLAN.binding.requestSchema,
          parameter: 'params.provider_option',
          reason: 'unsupported',
        }),
      })
    );

    expect(generateImage).not.toHaveBeenCalled();
    expect(transport).not.toHaveBeenCalled();
  });

  it.each([
    ['apiKey', { apiKey: '' }],
    ['baseUrl', { baseUrl: '   ' }],
  ] as const)(
    'rejects a selected plan with missing profile %s before adapter resolution',
    (missingField, providerOverride) => {
      const transport = vi.fn();
      vi.stubGlobal('fetch', transport);
      const plan: InvocationPlan = {
        ...PLAN,
        provider: {
          ...PLAN.provider,
          ...providerOverride,
        },
      };
      mocks.resolveInvocationPlanFromRoute.mockReturnValue(plan);

      expect(() =>
        resolveImageInvocation({
          prompt: 'must not borrow another profile credential',
          modelRef: PLAN.modelRef,
        })
      ).toThrowError(
        expect.objectContaining({
          name: 'ImageInvocationError',
          code: 'IMAGE_CONFIGURATION_MISSING',
          stage: 'planning',
          details: expect.objectContaining({
            profileId: PLAN.provider.profileId,
            modelId: PLAN.modelRef.modelId,
            operation: 'image',
            bindingId: PLAN.binding.id,
            missingFields: [missingField],
          }),
        })
      );

      expect(mocks.resolveAdapterForPlan).not.toHaveBeenCalled();
      expect(transport).not.toHaveBeenCalled();
    }
  );

  it.each([
    ['PROFILE_NOT_FOUND', 'IMAGE_BINDING_UNAVAILABLE'],
    ['BINDING_NOT_FOUND', 'IMAGE_BINDING_UNAVAILABLE'],
    ['AMBIGUOUS_BINDING', 'IMAGE_BINDING_AMBIGUOUS'],
  ] as const)(
    'maps %s planner failures into the image error contract',
    (reason, expectedCode) => {
      const transport = vi.fn();
      vi.stubGlobal('fetch', transport);
      const bindingIds =
        reason === 'AMBIGUOUS_BINDING'
          ? ['binding-generation-a', 'binding-generation-b']
          : undefined;
      mocks.resolveInvocationPlanFromRoute.mockImplementation(() => {
        throw new InvocationPlanningError('sanitized planner failure', {
          reason,
          details: {
            profileId: PLAN.modelRef.profileId,
            modelId: PLAN.modelRef.modelId,
            operation: 'image',
            apiKey: 'planner-secret-must-not-leak',
            baseUrl: 'https://credential-bearing-value.example.com',
            ...(bindingIds ? { bindingIds } : {}),
          },
        });
      });

      let planningFailure: unknown;
      try {
        resolveImageInvocation({
          prompt: 'fail before execution',
          modelRef: PLAN.modelRef,
        });
      } catch (error) {
        planningFailure = error;
      }

      expect(planningFailure).toMatchObject({
        name: 'ImageInvocationError',
        code: expectedCode,
        stage: 'planning',
        details: expect.objectContaining({
          profileId: PLAN.modelRef.profileId,
          modelId: PLAN.modelRef.modelId,
          operation: 'image',
          planningReason: reason,
          ...(bindingIds ? { bindingIds } : {}),
        }),
      });
      expect(
        (planningFailure as { details?: Record<string, unknown> }).details
      ).not.toHaveProperty('apiKey');
      expect(
        (planningFailure as { details?: Record<string, unknown> }).details
      ).not.toHaveProperty('baseUrl');

      expect(mocks.resolveAdapterForPlan).not.toHaveBeenCalled();
      expect(transport).not.toHaveBeenCalled();
    }
  );
});
