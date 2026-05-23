import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  clearModelAdapters,
  getModelAdapter,
  registerModelAdapter,
  resolveAdapterForBinding,
} from '../model-adapters/registry';
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

const forGptImageAdapter: ImageModelAdapter = {
  id: 'for-gpt-image-adapter',
  legacyIds: ['tuzi-gpt-image-adapter'],
  label: 'For GPT Image',
  kind: 'image',
  matchRequestSchemas: [
    'for.image.gpt-generation-json',
    'for.image.gpt-edit-json',
    'tuzi.image.gpt-generation-json',
    'tuzi.image.gpt-edit-json',
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

describe('model adapter registry', () => {
  beforeEach(() => {
    clearModelAdapters();
    registerModelAdapter(genericImageAdapter);
    registerModelAdapter(seedreamImageAdapter);
    registerModelAdapter(gptImageAdapter);
    registerModelAdapter(forGptImageAdapter);
    registerModelAdapter(seedanceVideoAdapter);
    registerModelAdapter(happyHorseVideoAdapter);
  });

  afterEach(() => {
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

  it('routes For GPT Image schemas to the dedicated For GPT adapter', () => {
    const adapter = resolveAdapterForBinding(
      createBinding({
        modelId: 'gpt-image-2',
        requestSchema: 'for.image.gpt-generation-json',
      }),
      'image'
    );

    expect(adapter?.id).toBe('for-gpt-image-adapter');
  });

  it('routes For GPT Image edit schemas to the dedicated For GPT adapter', () => {
    const adapter = resolveAdapterForBinding(
      createBinding({
        modelId: 'gpt-image-2',
        requestSchema: 'for.image.gpt-edit-json',
      }),
      'image'
    );

    expect(adapter?.id).toBe('for-gpt-image-adapter');
  });

  it('keeps legacy For GPT Image schemas mapped to the canonical adapter', () => {
    const generationAdapter = resolveAdapterForBinding(
      createBinding({
        modelId: 'gpt-image-2',
        requestSchema: 'tuzi.image.gpt-generation-json',
      }),
      'image'
    );
    const editAdapter = resolveAdapterForBinding(
      createBinding({
        modelId: 'gpt-image-2',
        requestSchema: 'tuzi.image.gpt-edit-json',
      }),
      'image'
    );

    expect(generationAdapter?.id).toBe('for-gpt-image-adapter');
    expect(editAdapter?.id).toBe('for-gpt-image-adapter');
  });

  it('keeps the legacy For GPT Image adapter id as an alias only', () => {
    expect(getModelAdapter('tuzi-gpt-image-adapter')?.id).toBe(
      'for-gpt-image-adapter'
    );
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
});
