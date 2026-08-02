import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ModelVendor, type ModelConfig } from '../../constants/model-config';
import { fluxImageAdapter } from '../model-adapters/flux-adapter';
import { gptImageAdapter } from '../model-adapters/gpt-image-adapter';
import { mjImageAdapter } from '../model-adapters/mj-image-adapter';
import {
  clearModelAdapters,
  registerModelAdapter,
  resolveAdapterForBinding,
  resolveAdapterForInvocation,
} from '../model-adapters/registry';
import { seedreamImageAdapter } from '../model-adapters/seedream-adapter';
import type { ImageModelAdapter } from '../model-adapters/types';
import { inferBindingsForProviderModel } from '../provider-routing';
import type { ProviderProfileSnapshot } from '../provider-routing';

const defaultBasicImageAdapter: ImageModelAdapter = {
  id: 'gemini-image-adapter',
  label: 'Default Image',
  kind: 'image',
  matchProtocols: ['openai.images.generations', 'openai.async.media'],
  matchRequestSchemas: ['openai.image.basic-json', 'openai.async.image.form'],
  async generateImage() {
    throw new Error('not implemented');
  },
};

const openaiProfile: ProviderProfileSnapshot = {
  id: 'openai',
  name: 'OpenAI',
  providerType: 'openai-compatible',
  baseUrl: 'https://api.openai.com/v1',
  apiKey: 'openai-key',
  authType: 'bearer',
  imageApiCompatibility: 'auto',
};

const forProfile: ProviderProfileSnapshot = {
  id: 'for',
  name: 'For',
  providerType: 'openai-compatible',
  baseUrl: 'https://foropencode.com/v1',
  apiKey: 'for-key',
  authType: 'bearer',
  imageApiCompatibility: 'auto',
};

function firstImageBinding(
  profile: ProviderProfileSnapshot,
  model: ModelConfig
) {
  const binding = inferBindingsForProviderModel(profile, model).find(
    (entry) => entry.operation === 'image'
  );
  if (!binding) {
    throw new Error(`No image binding for ${model.id}`);
  }
  return binding;
}

function imageBindingBySchema(
  profile: ProviderProfileSnapshot,
  model: ModelConfig,
  requestSchema: string
) {
  const binding = inferBindingsForProviderModel(profile, model).find(
    (entry) =>
      entry.operation === 'image' && entry.requestSchema === requestSchema
  );
  if (!binding) {
    throw new Error(`No ${requestSchema} image binding for ${model.id}`);
  }
  return binding;
}

describe('image routing to default registered adapters', () => {
  beforeEach(() => {
    clearModelAdapters();
    registerModelAdapter(gptImageAdapter);
    registerModelAdapter(defaultBasicImageAdapter);
    registerModelAdapter(mjImageAdapter);
    registerModelAdapter(fluxImageAdapter);
    registerModelAdapter(seedreamImageAdapter);
  });

  afterEach(() => {
    clearModelAdapters();
  });

  it('routes official GPT Image schema to the dedicated adapter', () => {
    const binding = firstImageBinding(openaiProfile, {
      id: 'gpt-image-2',
      label: 'GPT Image 2',
      type: 'image',
      vendor: ModelVendor.GPT,
    });

    expect(binding.requestSchema).toBe('openai.image.gpt-generation-json');
    expect(resolveAdapterForBinding(binding, 'image')?.id).toBe(
      'gpt-image-adapter'
    );
  });

  it('routes official GPT Image edit schema to the dedicated adapter', () => {
    const binding = imageBindingBySchema(
      openaiProfile,
      {
        id: 'gpt-image-2',
        label: 'GPT Image 2',
        type: 'image',
        vendor: ModelVendor.GPT,
      },
      'openai.image.gpt-edit-form'
    );

    expect(binding.protocol).toBe('openai.images.edits');
    expect(binding.submitPath).toBe('/images/edits');
    expect(resolveAdapterForBinding(binding, 'image')?.id).toBe(
      'gpt-image-adapter'
    );
  });

  it('routes third-party profiles configured for official GPT Image to the official adapter', () => {
    const binding = firstImageBinding(
      {
        ...forProfile,
        imageApiCompatibility: 'openai-gpt-image',
      },
      {
        id: 'gpt-image-2',
        label: 'GPT Image 2',
        type: 'image',
        vendor: ModelVendor.GPT,
      }
    );

    expect(binding.requestSchema).toBe('openai.image.gpt-generation-json');
    expect(resolveAdapterForBinding(binding, 'image')?.id).toBe(
      'gpt-image-adapter'
    );
  });

  it('routes third-party profiles configured for official GPT Image edits to the official adapter', () => {
    const binding = imageBindingBySchema(
      {
        ...forProfile,
        imageApiCompatibility: 'openai-gpt-image',
      },
      {
        id: 'gpt-image-2',
        label: 'GPT Image 2',
        type: 'image',
        vendor: ModelVendor.GPT,
      },
      'openai.image.gpt-edit-form'
    );

    expect(binding.protocol).toBe('openai.images.edits');
    expect(binding.submitPath).toBe('/images/edits');
    expect(resolveAdapterForBinding(binding, 'image')?.id).toBe(
      'gpt-image-adapter'
    );
  });

  it('keeps legacy model-only GPT Image requests on the official adapter', () => {
    const adapter = resolveAdapterForInvocation('image', 'gpt-image-2', null);

    expect(adapter?.id).toBe('gpt-image-adapter');
  });

  it('keeps generic non-GPT OpenAI-compatible image models on the default adapter', () => {
    const binding = firstImageBinding(forProfile, {
      id: 'qwen-image-2.0',
      label: 'Qwen Image 2.0',
      type: 'image',
      vendor: ModelVendor.QWEN,
    });

    expect(binding.requestSchema).toBe('openai.image.basic-json');
    expect(resolveAdapterForBinding(binding, 'image')?.id).toBe(
      'gemini-image-adapter'
    );
  });

  it('routes pricing async-image bindings to the default image adapter', () => {
    const binding = inferBindingsForProviderModel(
      forProfile,
      {
        id: 'gemini-3-pro-image-preview-async',
        label: 'Gemini Async Image',
        type: 'image',
        vendor: ModelVendor.GEMINI,
      },
      {
        'openai-video': {
          path: '/v1/videos',
          method: 'POST',
          scenario: 'async-image',
        },
      }
    ).find((entry) => entry.requestSchema === 'openai.async.image.form');

    expect(binding?.protocol).toBe('openai.async.media');
    expect(binding?.submitPath).toBe('/videos');
    expect(resolveAdapterForBinding(binding!, 'image')?.id).toBe(
      'gemini-image-adapter'
    );
  });

  it('keeps MJ, Flux, and Seedream on their dedicated adapters', () => {
    const cases: Array<{
      model: ModelConfig;
      adapterId: string;
    }> = [
      {
        model: {
          id: 'mj-imagine',
          label: 'Midjourney',
          type: 'image',
          vendor: ModelVendor.MIDJOURNEY,
          tags: ['mj'],
        },
        adapterId: 'mj-image-adapter',
      },
      {
        model: {
          id: 'bfl-flux-2-pro',
          label: 'Flux 2 Pro',
          type: 'image',
          vendor: ModelVendor.FLUX,
        },
        adapterId: 'flux-image-adapter',
      },
      {
        model: {
          id: 'doubao-seedream-5-0-260128',
          label: 'Seedream 5',
          type: 'image',
          vendor: ModelVendor.DOUBAO,
          tags: ['seedream'],
        },
        adapterId: 'seedream-image-adapter',
      },
    ];

    cases.forEach(({ model, adapterId }) => {
      const binding = firstImageBinding(forProfile, model);
      expect(resolveAdapterForBinding(binding, 'image')?.id).toBe(adapterId);
    });
  });
});
