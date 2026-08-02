import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ParamConfig } from '../../constants/model-config';
import {
  clearImageBindingParameterCapabilityCache,
  filterImageParamsForBinding,
  isImageBindingParameterSupported,
  pruneSelectedImageParams,
  resolveBindingScopedImageParameters,
  resolveImageParametersForSelection,
} from '../image-binding-parameter-capabilities';
import { resolveImageBindingCapabilities } from '../image-invocation';

const mocks = vi.hoisted(() => ({
  resolveInvocationPlanFromRoute: vi.fn(),
  runtimeRevision: 0,
  pricingVersion: 0,
}));

vi.mock('../provider-routing', () => ({
  resolveInvocationPlanFromRoute: mocks.resolveInvocationPlanFromRoute,
}));

vi.mock('../../utils/runtime-model-discovery', () => ({
  runtimeModelDiscovery: {
    getRevision: () => mocks.runtimeRevision,
    subscribe: () => () => undefined,
  },
}));

vi.mock('../../utils/model-pricing-service', () => ({
  modelPricingService: {
    getVersion: () => mocks.pricingVersion,
    subscribe: () => () => undefined,
  },
}));

function enumParam(
  id: string,
  values: readonly string[] = ['auto', '1x1', '16x9']
): ParamConfig {
  return {
    id,
    label: id,
    valueType: 'enum',
    options: values.map((value) => ({ value, label: value })),
    defaultValue: values[0],
    compatibleModels: [],
    modelType: 'image',
  };
}

function binding(
  requestSchema: string,
  options: {
    id?: string;
    profileId?: string;
    modelId?: string;
    metadata?: Record<string, unknown>;
  } = {}
) {
  return {
    id: options.id || `binding:${requestSchema}`,
    profileId: options.profileId || 'profile-a',
    modelId: options.modelId || 'same-model',
    operation: 'image' as const,
    protocol: 'test.image',
    requestSchema,
    responseSchema: 'test.response',
    submitPath: '/images',
    submitMethod: 'POST' as const,
    priority: 100,
    confidence: 'high' as const,
    source: 'manual' as const,
    metadata: options.metadata,
  };
}

function planFor(testBinding: ReturnType<typeof binding>) {
  return {
    provider: {
      profileId: testBinding.profileId,
      profileName: 'Provider',
      providerType: 'auto',
      baseUrl: 'https://example.com/v1',
      apiKey: 'secret',
      authType: 'bearer' as const,
    },
    modelRef: {
      profileId: testBinding.profileId,
      modelId: testBinding.modelId,
    },
    binding: testBinding,
  };
}

describe('binding-scoped image parameter presentation', () => {
  beforeEach(() => {
    mocks.resolveInvocationPlanFromRoute.mockReset();
    mocks.runtimeRevision = 0;
    mocks.pricingVersion = 0;
    clearImageBindingParameterCapabilityCache();
  });

  it('plans a binding-scoped capability once per unchanged revision', () => {
    const modelRef = { profileId: 'profile-cache', modelId: 'image-cache' };
    mocks.resolveInvocationPlanFromRoute.mockReturnValue(
      planFor(
        binding('dynamic.image.schema', {
          id: 'binding-cache',
          ...modelRef,
          metadata: {
            image: {
              capabilities: {
                operations: ['generation'],
                size: ['1x1'],
              },
            },
          },
        })
      )
    );

    const first = resolveBindingScopedImageParameters(
      modelRef,
      'generation',
      []
    );
    const second = resolveBindingScopedImageParameters(
      modelRef,
      'generation',
      []
    );

    expect(first.capabilities).toBe(second.capabilities);
    expect(mocks.resolveInvocationPlanFromRoute).toHaveBeenCalledTimes(1);
  });

  it('invalidates capability snapshots on catalog/profile and pricing revisions', () => {
    const modelRef = {
      profileId: 'profile-revision',
      modelId: 'image-revision',
    };
    mocks.resolveInvocationPlanFromRoute.mockImplementation(() =>
      planFor(
        binding('dynamic.image.schema', {
          id: 'binding-revision',
          ...modelRef,
          metadata: {
            image: {
              capabilities: {
                operations: ['generation'],
                size:
                  mocks.pricingVersion > 0
                    ? ['4x3']
                    : mocks.runtimeRevision > 0
                    ? ['16x9']
                    : ['1x1'],
              },
            },
          },
        })
      )
    );

    const initial = resolveBindingScopedImageParameters(
      modelRef,
      'generation',
      []
    );
    mocks.runtimeRevision += 1;
    const afterCatalogChange = resolveBindingScopedImageParameters(
      modelRef,
      'generation',
      []
    );
    mocks.pricingVersion += 1;
    const afterPricingChange = resolveBindingScopedImageParameters(
      modelRef,
      'generation',
      []
    );

    expect(
      initial.compatibleParams[0]?.options?.map(({ value }) => value)
    ).toEqual(['1x1']);
    expect(
      afterCatalogChange.compatibleParams[0]?.options?.map(({ value }) => value)
    ).toEqual(['16x9']);
    expect(
      afterPricingChange.compatibleParams[0]?.options?.map(({ value }) => value)
    ).toEqual(['4x3']);
    expect(mocks.resolveInvocationPlanFromRoute).toHaveBeenCalledTimes(3);
  });

  it('evicts the least-recently-used binding capability at the bounded limit', () => {
    mocks.resolveInvocationPlanFromRoute.mockImplementation(
      (_operation, rawModelRef) => {
        const modelRef = rawModelRef as {
          profileId: string;
          modelId: string;
        };
        return planFor(
          binding('dynamic.image.schema', {
            id: `binding-${modelRef.modelId}`,
            ...modelRef,
            metadata: {
              image: {
                capabilities: { operations: ['generation'] },
              },
            },
          })
        );
      }
    );

    for (let index = 0; index < 129; index += 1) {
      resolveBindingScopedImageParameters(
        { profileId: 'profile-lru', modelId: `image-${index}` },
        'generation',
        []
      );
    }
    resolveBindingScopedImageParameters(
      { profileId: 'profile-lru', modelId: 'image-0' },
      'generation',
      []
    );

    expect(mocks.resolveInvocationPlanFromRoute).toHaveBeenCalledTimes(130);
  });

  it('plans with the exact ModelRef and intersects existing params with binding metadata', () => {
    const modelRef = { profileId: 'profile-b', modelId: 'same-model' };
    const selectedBinding = binding('google.generate-content.image-inline', {
      id: 'binding-b',
      ...modelRef,
      metadata: {
        image: {
          capabilities: {
            size: ['1x1'],
            outputFormat: false,
          },
        },
      },
    });
    mocks.resolveInvocationPlanFromRoute.mockReturnValue(
      planFor(selectedBinding)
    );

    const result = resolveBindingScopedImageParameters(modelRef, 'generation', [
      enumParam('size'),
      enumParam('quality', ['1k', '2k', '4k']),
      enumParam('output_format', ['png', 'jpeg']),
      enumParam('seedream_quality', ['2k', '4k']),
    ]);

    expect(mocks.resolveInvocationPlanFromRoute).toHaveBeenCalledWith(
      'image',
      modelRef,
      {
        preferredRequestSchema: ['openai.image.gpt-generation-json'],
      }
    );
    expect(result.bindingId).toBe('binding-b');
    expect(result.compatibleParams.map((param) => param.id)).toEqual([
      'size',
      'quality',
    ]);
    expect(
      result.compatibleParams[0].options?.map(({ value }) => value)
    ).toEqual(['1x1']);
  });

  it('requests the edit binding and uses its exact request-schema capabilities', () => {
    const modelRef = { profileId: 'profile-gpt', modelId: 'gpt-image-2' };
    mocks.resolveInvocationPlanFromRoute.mockReturnValue(
      planFor(
        binding('openai.image.gpt-edit-form', {
          id: 'gpt-edit',
          ...modelRef,
        })
      )
    );

    const result = resolveBindingScopedImageParameters(modelRef, 'edit', [
      enumParam('input_fidelity', ['low', 'high']),
      enumParam('background', ['auto', 'transparent', 'opaque']),
    ]);

    expect(mocks.resolveInvocationPlanFromRoute).toHaveBeenCalledWith(
      'image',
      modelRef,
      { preferredRequestSchema: ['openai.image.gpt-edit-form'] }
    );
    expect(result.compatibleParams.map((param) => param.id)).toEqual([
      'input_fidelity',
      'background',
    ]);
  });

  it('materializes canonical controls for a dynamic model from explicit binding metadata', () => {
    const modelRef = {
      profileId: 'profile-dynamic',
      modelId: 'runtime-discovered-image',
    };
    mocks.resolveInvocationPlanFromRoute.mockReturnValue(
      planFor(
        binding('dynamic.image.schema', {
          id: 'binding-dynamic',
          ...modelRef,
          metadata: {
            image: {
              capabilities: {
                operations: ['generation'],
                size: ['1:1', '16:9'],
                resolution: ['1K', '2K'],
                outputFormat: ['png', 'jpg'],
                count: { min: 1, max: 4, integer: true },
                quality: true,
                background: true,
                outputCompression: { min: 0 },
              },
            },
          },
        })
      )
    );

    const result = resolveBindingScopedImageParameters(
      modelRef,
      'generation',
      []
    );

    expect(result.compatibleParams.map((param) => param.id)).toEqual([
      'size',
      'resolution',
      'outputFormat',
      'count',
    ]);
    expect(result.compatibleParams[0]).toMatchObject({
      valueType: 'enum',
      compatibleModels: [modelRef.modelId],
      options: [{ value: '1x1' }, { value: '16x9' }],
    });
    expect(
      result.compatibleParams[1].options?.map(({ value }) => value)
    ).toEqual(['1k', '2k']);
    expect(
      result.compatibleParams[2].options?.map(({ value }) => value)
    ).toEqual(['png', 'jpeg']);
    expect(result.compatibleParams[3]).toMatchObject({
      valueType: 'number',
      min: 1,
      max: 4,
      step: 1,
      integer: true,
    });
  });

  it('keeps identical model IDs isolated by profile-scoped binding metadata', () => {
    mocks.resolveInvocationPlanFromRoute.mockImplementation(
      (_operation, modelRef) => {
        const exactRef = modelRef as {
          profileId: string;
          modelId: string;
        };
        return planFor(
          binding('dynamic.image.schema', {
            id: `binding-${exactRef.profileId}`,
            ...exactRef,
            metadata: {
              image: {
                capabilities: {
                  operations: ['generation'],
                  size: exactRef.profileId === 'profile-a' ? ['1x1'] : ['16x9'],
                },
              },
            },
          })
        );
      }
    );
    const first = resolveBindingScopedImageParameters(
      { profileId: 'profile-a', modelId: 'same-model' },
      'generation',
      []
    );
    const second = resolveBindingScopedImageParameters(
      { profileId: 'profile-b', modelId: 'same-model' },
      'generation',
      []
    );
    resolveBindingScopedImageParameters(
      { profileId: 'profile-a', modelId: 'same-model' },
      'generation',
      []
    );
    resolveBindingScopedImageParameters(
      { profileId: 'profile-b', modelId: 'same-model' },
      'generation',
      []
    );

    expect(first.bindingId).toBe('binding-profile-a');
    expect(
      first.compatibleParams[0].options?.map(({ value }) => value)
    ).toEqual(['1x1']);
    expect(second.bindingId).toBe('binding-profile-b');
    expect(
      second.compatibleParams[0].options?.map(({ value }) => value)
    ).toEqual(['16x9']);
    expect(mocks.resolveInvocationPlanFromRoute).toHaveBeenCalledTimes(2);
  });

  it('does not materialize controls from boolean-only or incomplete range evidence', () => {
    const modelRef = {
      profileId: 'profile-unknown',
      modelId: 'gpt-image-misleading-name',
    };
    mocks.resolveInvocationPlanFromRoute.mockReturnValue(
      planFor(
        binding('vendor.unknown-image-schema', {
          ...modelRef,
          metadata: {
            image: {
              capabilities: {
                operations: ['generation'],
                size: true,
                resolution: true,
                outputFormat: true,
                count: true,
                outputCompression: { min: 0 },
              },
            },
          },
        })
      )
    );

    const result = resolveBindingScopedImageParameters(
      modelRef,
      'generation',
      []
    );

    expect(result.compatibleParams).toEqual([]);
  });

  it('fails closed to non-canonical controls when no invocation plan exists', () => {
    mocks.resolveInvocationPlanFromRoute.mockReturnValue(null);
    const params = [enumParam('size'), enumParam('seedream_quality')];

    const result = resolveBindingScopedImageParameters(
      { profileId: 'legacy-provider', modelId: 'legacy-image' },
      'generation',
      params
    );

    expect(result).toMatchObject({
      resolution: 'unresolved',
      compatibleParams: [],
    });
    expect(result.bindingId).toBeUndefined();
    expect(result.capabilities).toBeUndefined();
  });

  it('shows provider-specific controls only for the serializer schema that consumes them', () => {
    const providerParams = [
      enumParam('seedream_quality', ['2k', '3k', '4k']),
      enumParam('mj_ar', ['1:1', '16:9']),
    ];
    const seedream = resolveImageBindingCapabilities(
      binding('openai.image.seedream-json')
    );
    const mj = resolveImageBindingCapabilities(
      binding('mj.imagine.base64-array')
    );
    const gpt = resolveImageBindingCapabilities(
      binding('openai.image.gpt-generation-json')
    );

    expect(
      filterImageParamsForBinding(providerParams, seedream, 'generation').map(
        (param) => param.id
      )
    ).toEqual(['seedream_quality']);
    expect(
      filterImageParamsForBinding(providerParams, mj, 'generation').map(
        (param) => param.id
      )
    ).toEqual(['mj_ar']);
    expect(
      filterImageParamsForBinding(providerParams, gpt, 'generation')
    ).toEqual([]);
  });

  it('does not plan or expose bare-model canonical controls without an exact ModelRef', () => {
    const missingRef = resolveImageParametersForSelection(
      'gpt-image-2',
      null,
      'generation'
    );
    const mismatchedRef = resolveImageParametersForSelection(
      'gpt-image-2',
      { profileId: 'profile-gpt', modelId: 'different-model' },
      'generation'
    );

    expect(missingRef).toMatchObject({
      resolution: 'unresolved',
      compatibleParams: [],
    });
    expect(mismatchedRef).toMatchObject({
      resolution: 'unresolved',
      compatibleParams: [],
    });
    expect(mocks.resolveInvocationPlanFromRoute).not.toHaveBeenCalled();
  });

  it('keeps generation and edit controls isolated by their selected bindings', () => {
    const modelRef = { profileId: 'profile-gpt', modelId: 'gpt-image-2' };
    mocks.resolveInvocationPlanFromRoute.mockImplementation(
      (_operation, _modelRef, constraints) => {
        const isEdit =
          (
            constraints as { preferredRequestSchema?: readonly string[] }
          ).preferredRequestSchema?.includes('openai.image.gpt-edit-form') ===
          true;
        return planFor(
          binding(
            isEdit
              ? 'openai.image.gpt-edit-form'
              : 'openai.image.gpt-generation-json',
            {
              id: isEdit ? 'binding-edit' : 'binding-generation',
              ...modelRef,
              metadata: {
                image: {
                  capabilities: {
                    operations: [isEdit ? 'edit' : 'generation'],
                    quality: [isEdit ? 'high' : 'low'],
                  },
                },
              },
            }
          )
        );
      }
    );
    const params = [enumParam('quality', ['low', 'high'])];

    const generation = resolveBindingScopedImageParameters(
      modelRef,
      'generation',
      params
    );
    const edit = resolveBindingScopedImageParameters(modelRef, 'edit', params);

    expect(generation.bindingId).toBe('binding-generation');
    expect(
      generation.compatibleParams[0]?.options?.map(({ value }) => value)
    ).toEqual(['low']);
    expect(edit.bindingId).toBe('binding-edit');
    expect(
      edit.compatibleParams[0]?.options?.map(({ value }) => value)
    ).toEqual(['high']);
  });

  it('does not infer canonical fields from a familiar model ID when schema capability is unknown', () => {
    const capabilities = resolveImageBindingCapabilities(
      binding('vendor.unknown-image-schema', { modelId: 'gpt-image-2' })
    );

    expect(
      filterImageParamsForBinding(
        [enumParam('size'), enumParam('mj_ar')],
        capabilities,
        'generation'
      )
    ).toEqual([]);
  });

  it('hides all fields when the selected binding explicitly excludes the current operation', () => {
    const capabilities = resolveImageBindingCapabilities(
      binding('openai.image.gpt-generation-json')
    );

    expect(
      filterImageParamsForBinding(
        [enumParam('size'), enumParam('seedream_quality')],
        capabilities,
        'edit'
      )
    ).toEqual([]);
  });

  it('does not re-submit a hidden size when the selected binding excludes the operation', () => {
    const modelRef = { profileId: 'profile-gpt', modelId: 'gpt-image-2' };
    mocks.resolveInvocationPlanFromRoute.mockReturnValue(
      planFor(
        binding('openai.image.gpt-generation-json', {
          id: 'generation-only',
          ...modelRef,
        })
      )
    );

    const state = resolveBindingScopedImageParameters(modelRef, 'edit', [
      enumParam('size'),
    ]);

    expect(state.compatibleParams).toEqual([]);
    expect(isImageBindingParameterSupported(state, 'size')).toBe(false);
    expect(isImageBindingParameterSupported(state, 'aspectRatio')).toBe(false);
  });

  it('removes hidden and newly invalid selections without adding defaults', () => {
    const compatibleParams = [
      enumParam('size', ['1x1']),
      {
        ...enumParam('count'),
        valueType: 'number' as const,
        options: undefined,
        min: 1,
        max: 2,
        integer: true,
      },
    ];

    expect(
      pruneSelectedImageParams(
        {
          size: '16x9',
          count: '3',
          background: 'transparent',
        },
        compatibleParams
      )
    ).toEqual({});
    expect(pruneSelectedImageParams({}, compatibleParams)).toEqual({});
  });

  it('retains only valid enum and integer range selections at their boundaries', () => {
    const compatibleParams = [
      enumParam('quality', ['low', 'high']),
      {
        ...enumParam('count'),
        valueType: 'number' as const,
        options: undefined,
        min: 1,
        max: 4,
        integer: true,
      },
    ];

    expect(
      pruneSelectedImageParams(
        { quality: 'high', count: '4', removed: 'value' },
        compatibleParams
      )
    ).toEqual({ quality: 'high', count: '4' });
    expect(
      pruneSelectedImageParams(
        { quality: 'medium', count: '1.5' },
        compatibleParams
      )
    ).toEqual({});
  });
});
