import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  clearModelAdapters,
  registerModelAdapter,
  resolveAdapterForBinding,
  resolveAdapterForInvocation,
  resolveAdapterForModel,
} from '../model-adapters/registry';
import { ModelVendor } from '../../constants/model-config';
import * as providerRouting from '../provider-routing';
import { inferBindingsForProviderModel } from '../provider-routing';
import type {
  ImageModelAdapter,
  VideoModelAdapter,
} from '../model-adapters/types';
import type { ProviderModelBinding } from '../provider-routing';

function createBinding(
  overrides: Partial<ProviderModelBinding>
): ProviderModelBinding {
  return {
    id: 'binding',
    profileId: 'provider-a',
    modelId: 'gemini-3-pro-image-preview',
    operation: 'image',
    protocol: 'openai.images.generations',
    requestSchema: 'openai.image.basic-json',
    responseSchema: 'openai.image.data',
    submitPath: '/images/generations',
    priority: 100,
    confidence: 'high',
    source: 'template',
    ...overrides,
  };
}

const genericImageAdapter: ImageModelAdapter = {
  id: 'generic-image',
  label: 'Generic Image',
  kind: 'image',
  matchProtocols: ['openai.images.generations', 'google.generateContent'],
  matchRequestSchemas: [
    'openai.image.basic-json',
    'google.generate-content.image-inline',
  ],
  async generateImage() {
    throw new Error('not implemented');
  },
};

const seedreamImageAdapter: ImageModelAdapter = {
  id: 'seedream-image',
  label: 'Seedream Image',
  kind: 'image',
  matchProtocols: ['openai.images.generations'],
  matchRequestSchemas: ['openai.image.seedream-json'],
  async generateImage() {
    throw new Error('not implemented');
  },
};

const gptImageAdapter: ImageModelAdapter = {
  id: 'gpt-image',
  label: 'GPT Image',
  kind: 'image',
  matchRequestSchemas: [
    'openai.image.gpt-generation-json',
    'openai.image.gpt-edit-form',
  ],
  async generateImage() {
    throw new Error('not implemented');
  },
};

const seedanceVideoAdapter: VideoModelAdapter = {
  id: 'seedance-video',
  label: 'Seedance Video',
  kind: 'video',
  matchProtocols: ['seedance.task'],
  matchRequestSchemas: ['seedance.video.form-auto'],
  async generateVideo() {
    throw new Error('not implemented');
  },
};

const happyHorseVideoAdapter: VideoModelAdapter = {
  id: 'happyhorse-video',
  label: 'HappyHorse Video',
  kind: 'video',
  matchProtocols: ['happyhorse.video'],
  matchRequestSchemas: ['happyhorse.video.json'],
  async generateVideo() {
    throw new Error('not implemented');
  },
};

const genericVideoAdapter: VideoModelAdapter = {
  id: 'generic-video',
  label: 'Generic Video',
  kind: 'video',
  matchProtocols: ['openai.async.video'],
  matchRequestSchemas: ['openai.video.form-input-reference'],
  matchPredicate(modelConfig) {
    if (modelConfig.type !== 'video') {
      return false;
    }
    const lowerId = modelConfig.id.toLowerCase();
    return (
      !lowerId.includes('kling') &&
      !lowerId.includes('seedance') &&
      !lowerId.includes('happyhorse')
    );
  },
  async generateVideo() {
    throw new Error('not implemented');
  },
};

describe('model adapter registry', () => {
  beforeEach(() => {
    clearModelAdapters();
    registerModelAdapter(genericImageAdapter);
    registerModelAdapter(seedreamImageAdapter);
    registerModelAdapter(gptImageAdapter);
    registerModelAdapter(seedanceVideoAdapter);
    registerModelAdapter(happyHorseVideoAdapter);
    registerModelAdapter(genericVideoAdapter);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    clearModelAdapters();
  });

  it('prefers schema-specific adapter for seedream bindings', () => {
    const adapter = resolveAdapterForBinding(
      createBinding({
        modelId: 'doubao-seedream-5-0-260128',
        requestSchema: 'openai.image.seedream-json',
      }),
      'image'
    );

    expect(adapter?.id).toBe('seedream-image');
  });

  it('routes google generateContent image bindings to the generic image adapter', () => {
    const adapter = resolveAdapterForBinding(
      createBinding({
        protocol: 'google.generateContent',
        requestSchema: 'google.generate-content.image-inline',
      }),
      'image'
    );

    expect(adapter?.id).toBe('generic-image');
  });

  it('routes official GPT Image schemas to the dedicated adapter', () => {
    const adapter = resolveAdapterForBinding(
      createBinding({
        modelId: 'gpt-image-2',
        requestSchema: 'openai.image.gpt-generation-json',
      }),
      'image'
    );

    expect(adapter?.id).toBe('gpt-image');
  });

  it('routes official GPT Image edit schemas to the dedicated adapter', () => {
    const adapter = resolveAdapterForBinding(
      createBinding({
        modelId: 'gpt-image-2',
        protocol: 'openai.images.edits',
        requestSchema: 'openai.image.gpt-edit-form',
        submitPath: '/images/edits',
      }),
      'image'
    );

    expect(adapter?.id).toBe('gpt-image');
  });

  it('routes seedance bindings to the seedance adapter before generic video handlers', () => {
    const adapter = resolveAdapterForBinding(
      createBinding({
        modelId: 'seedance-1.5-pro',
        operation: 'video',
        protocol: 'seedance.task',
        requestSchema: 'seedance.video.form-auto',
        responseSchema: 'seedance.video.task',
        submitPath: '/videos',
      }),
      'video'
    );

    expect(adapter?.id).toBe('seedance-video');
  });

  it('routes HappyHorse video schemas to the dedicated adapter', () => {
    const adapter = resolveAdapterForBinding(
      createBinding({
        modelId: 'happyhorse-1.0-r2v',
        operation: 'video',
        protocol: 'happyhorse.video',
        requestSchema: 'happyhorse.video.json',
        responseSchema: 'happyhorse.video.task',
        submitPath: '/videos',
      }),
      'video'
    );

    expect(adapter?.id).toBe('happyhorse-video');
  });

  it('routes Omni Flash video models to the generic async video adapter', () => {
    expect(resolveAdapterForModel('omni-flash', 'video')?.id).toBe(
      'generic-video'
    );
    expect(resolveAdapterForModel('omni-flash-components', 'video')?.id).toBe(
      'generic-video'
    );
  });

  it('routes Omni Flash provider bindings to the generic async video adapter', () => {
    const bindings = inferBindingsForProviderModel(
      {
        id: 'provider-video',
        name: 'Video Provider',
        providerType: 'openai-compatible',
        baseUrl: 'https://api.example.com/v1',
        apiKey: 'test-key',
        authType: 'bearer',
      },
      {
        id: 'omni-flash-components',
        label: 'Gemini Omni Flash Components',
        type: 'video',
        vendor: ModelVendor.GEMINI,
      }
    );
    const binding = bindings.find(
      (candidate) => candidate.protocol === 'openai.async.video'
    );

    expect(binding).toMatchObject({
      modelId: 'omni-flash-components',
      requestSchema: 'openai.video.form-input-reference',
    });
    expect(resolveAdapterForBinding(binding!, 'video')?.id).toBe(
      'generic-video'
    );
  });

  it.each(['openai-compatible', 'gemini-compatible', 'custom'] as const)(
    'requires an exact image request schema for planned %s invocations',
    (providerType) => {
      vi.spyOn(
        providerRouting,
        'resolveInvocationPlanFromRoute'
      ).mockReturnValue({
        provider: {
          profileId: 'provider-image',
          profileName: 'Image Provider',
          providerType,
          baseUrl: 'https://api.example.com/v1',
          apiKey: 'test-key',
          authType: 'bearer',
        },
        modelRef: {
          profileId: 'provider-image',
          modelId: 'gpt-image-2',
        },
        binding: createBinding({
          id: 'unsupported-image-binding',
          profileId: 'provider-image',
          modelId: 'gpt-image-2',
          protocol: 'openai.images.generations',
          requestSchema: 'vendor.unsupported.image-json',
          responseSchema: 'vendor.unsupported.image-result',
          submitPath: '/custom/images',
        }),
      });

      expect(
        resolveAdapterForInvocation('image', 'gpt-image-2', {
          profileId: 'provider-image',
          modelId: 'gpt-image-2',
        })
      ).toBeUndefined();
    }
  );

  it.each(['openai-compatible', 'gemini-compatible', 'custom'] as const)(
    'keeps the schema-owning default image adapter for planned %s basic-json invocations',
    (providerType) => {
      vi.spyOn(
        providerRouting,
        'resolveInvocationPlanFromRoute'
      ).mockReturnValue({
        provider: {
          profileId: 'provider-image',
          profileName: 'Image Provider',
          providerType,
          baseUrl: 'https://api.example.com/v1',
          apiKey: 'test-key',
          authType: 'bearer',
        },
        modelRef: {
          profileId: 'provider-image',
          modelId: 'dynamic-image-model',
        },
        binding: createBinding({
          id: 'basic-image-binding',
          profileId: 'provider-image',
          modelId: 'dynamic-image-model',
          protocol: 'openai.images.generations',
          requestSchema: 'openai.image.basic-json',
          responseSchema: 'openai.image.data',
          submitPath: '/custom/images',
        }),
      });

      expect(
        resolveAdapterForInvocation('image', 'dynamic-image-model', {
          profileId: 'provider-image',
          modelId: 'dynamic-image-model',
        })?.id
      ).toBe('generic-image');
    }
  );

  it('does not fall back to model matching when an invocation plan has no adapter', () => {
    const planSpy = vi
      .spyOn(providerRouting, 'resolveInvocationPlanFromRoute')
      .mockReturnValue({
        provider: {
          profileId: 'provider-video',
          profileName: 'Video Provider',
          providerType: 'auto',
          baseUrl: 'https://api.example.com/v1',
          apiKey: 'test-key',
          authType: 'bearer',
        },
        modelRef: {
          profileId: 'provider-video',
          modelId: 'omni-flash',
        },
        binding: createBinding({
          id: 'unsupported-binding',
          profileId: 'provider-video',
          modelId: 'omni-flash',
          operation: 'video',
          protocol: 'vendor.unsupported.video',
          requestSchema: 'vendor.unsupported.video-json',
          responseSchema: 'vendor.unsupported.result',
          submitPath: '/unsupported',
        }),
      });

    expect(resolveAdapterForModel('omni-flash', 'video')?.id).toBe(
      'generic-video'
    );
    expect(
      resolveAdapterForInvocation('video', 'omni-flash', null)
    ).toBeUndefined();

    planSpy.mockRestore();
  });

  it('does not select an image adapter from a bare model when no plan exists', () => {
    vi.spyOn(
      providerRouting,
      'resolveInvocationPlanFromRoute'
    ).mockReturnValue(null);

    expect(
      resolveAdapterForInvocation('image', 'gpt-image-2', null)
    ).toBeUndefined();
  });

  it.each(['openai-compatible', 'gemini-compatible', 'custom'] as const)(
    'keeps legacy non-image model matching for %s plans with an unmapped binding',
    (providerType) => {
      vi.spyOn(
        providerRouting,
        'resolveInvocationPlanFromRoute'
      ).mockReturnValue({
        provider: {
          profileId: 'provider-video',
          profileName: 'Video Provider',
          providerType,
          baseUrl: 'https://api.example.com/v1',
          apiKey: 'test-key',
          authType: 'bearer',
        },
        modelRef: {
          profileId: 'provider-video',
          modelId: 'omni-flash',
        },
        binding: createBinding({
          id: 'unsupported-binding',
          profileId: 'provider-video',
          modelId: 'omni-flash',
          operation: 'video',
          protocol: 'vendor.unsupported.video',
          requestSchema: 'vendor.unsupported.video-json',
          responseSchema: 'vendor.unsupported.result',
          submitPath: '/unsupported',
        }),
      });

      expect(resolveAdapterForInvocation('video', 'omni-flash', null)?.id).toBe(
        'generic-video'
      );
    }
  );
});
