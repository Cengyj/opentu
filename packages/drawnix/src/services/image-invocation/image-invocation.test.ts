import { describe, expect, it } from 'vitest';
import {
  assertImageRequestCapabilities,
  resolveImageBindingCapabilities,
  validateImageRequestCapabilities,
} from './capabilities';
import { createImageAdapterRequest } from './adapter-request';
import { ImageInvocationError } from './errors';
import { normalizeImageRequest } from './normalize-request';
import { resolveImageOperationIntent } from './operation-intent';
import { createImageInvocationTelemetry } from './performance';
import type { ResolvedImageInvocation } from './resolve-invocation';
import type { ImageCapabilityBinding } from './types';
import type { InvocationPlan } from '../provider-routing';
import type { ImageModelAdapter } from '../model-adapters/types';

function binding(
  requestSchema: string,
  options: {
    id?: string;
    profileId?: string;
    modelId?: string;
    imageMetadata?: Record<string, unknown>;
  } = {}
): ImageCapabilityBinding {
  return {
    id: options.id || `binding:${requestSchema}`,
    profileId: options.profileId || 'profile-a',
    modelId: options.modelId || 'image-model',
    requestSchema,
    ...(options.imageMetadata
      ? { metadata: { image: options.imageMetadata } }
      : {}),
  };
}

describe('normalizeImageRequest', () => {
  it('normalizes top-level and nested camel/snake aliases into one contract', () => {
    const controller = new AbortController();
    const result = normalizeImageRequest({
      prompt: '  draw a lighthouse  ',
      task_id: ' task-1 ',
      model_ref: {
        profile_id: ' profile-a ',
        model_id: ' model-a ',
      },
      binding_id: ' binding-a ',
      generation_mode: 'IMAGE_TO_IMAGE',
      size: ' 16 : 9 ',
      aspect_ratio: '16X9',
      reference_images: [' https://example.com/one.png '],
      mask_image: { url: ' https://example.com/mask.png ' },
      output_format: 'JPG',
      compression: '80',
      response_format: 'B64_JSON',
      moderation: 'AUTO',
      user: ' end-user-1 ',
      signal: controller.signal,
      params: {
        resolution: '2K',
        quality: 'HIGH',
        input_fidelity: 'HIGH',
        background: 'TRANSPARENT',
        n: '2',
        seedream_quality: '4k',
      },
    });

    expect(result).toEqual({
      prompt: 'draw a lighthouse',
      taskId: 'task-1',
      model: undefined,
      modelRef: { profileId: 'profile-a', modelId: 'model-a' },
      bindingId: 'binding-a',
      generationMode: 'image_to_image',
      referenceImages: ['https://example.com/one.png'],
      maskImage: 'https://example.com/mask.png',
      size: '16x9',
      aspectRatio: '16:9',
      resolution: '2k',
      quality: 'high',
      inputFidelity: 'high',
      background: 'transparent',
      outputFormat: 'jpeg',
      outputCompression: 80,
      count: 2,
      responseFormat: 'b64_json',
      moderation: 'auto',
      user: 'end-user-1',
      params: { seedream_quality: '4k' },
      signal: controller.signal,
    });
  });

  it('merges every reference/upload shape in stable first-seen order', () => {
    const result = normalizeImageRequest({
      prompt: 'edit',
      referenceImages: [
        'https://example.com/a.png',
        { url: 'https://example.com/b.png' },
      ],
      uploaded_images: [
        { url: 'https://example.com/a.png' },
        { base64: 'QUJDRA==', mime_type: 'image/webp' },
      ],
      uploadedImage: 'https://example.com/c.png',
      params: {
        reference_images: [
          { url: 'https://example.com/b.png' },
          'https://example.com/d.png',
        ],
        uploadedImages: [
          { base64: 'QUJDRA==', mimeType: 'image/webp' },
          { base64: 'RUZHSA==' },
        ],
        uploaded_image: { url: 'https://example.com/e.png' },
      },
    });

    expect(result.referenceImages).toEqual([
      'https://example.com/a.png',
      'https://example.com/b.png',
      'data:image/webp;base64,QUJDRA==',
      'https://example.com/c.png',
      'https://example.com/d.png',
      'data:image/png;base64,RUZHSA==',
      'https://example.com/e.png',
    ]);
  });

  it('uses top-level canonical values before nested or snake aliases', () => {
    const result = normalizeImageRequest({
      prompt: 'draw',
      generationMode: 'text_to_image',
      outputFormat: 'webp',
      count: 1,
      params: {
        generation_mode: 'image_edit',
        output_format: 'png',
        n: 4,
      },
    });

    expect(result.generationMode).toBe('text_to_image');
    expect(result.outputFormat).toBe('webp');
    expect(result.count).toBe(1);
    expect(result.params).toEqual({});
  });

  it('returns an immutable request and compatibility collections', () => {
    const result = normalizeImageRequest({
      prompt: 'draw',
      referenceImages: ['https://example.com/reference.png'],
      params: { provider_option: true },
    });

    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result.referenceImages)).toBe(true);
    expect(Object.isFrozen(result.params)).toBe(true);
  });

  it('normalizes camel/snake metadata aliases once and freezes nested metadata', () => {
    const result = normalizeImageRequest({
      prompt: 'draw a character portrait',
      asset_metadata: {
        category: 'character',
        character_name: 'Nova',
        character_prompt: 'silver-haired explorer',
      },
      params: {
        prompt_meta: {
          initial_prompt: 'initial draft',
          sent_prompt: 'final prompt',
          title: 'Portrait',
          category: 'IMAGE',
          tags: ['character', 'portrait'],
          knowledge_context_refs: [
            {
              note_id: 'note-1',
              title: 'Character Bible',
              directory_id: 'characters',
              updated_at: 42,
            },
          ],
          skill_id: 'skill-1',
          skill_name: 'Character Artist',
        },
      },
    });

    expect(result.assetMetadata).toEqual({
      category: 'CHARACTER',
      characterName: 'Nova',
      characterPrompt: 'silver-haired explorer',
    });
    expect(result.promptMeta).toEqual({
      initialPrompt: 'initial draft',
      sentPrompt: 'final prompt',
      title: 'Portrait',
      category: 'image',
      tags: ['character', 'portrait'],
      knowledgeContextRefs: [
        {
          noteId: 'note-1',
          title: 'Character Bible',
          directoryId: 'characters',
          updatedAt: 42,
        },
      ],
      skillId: 'skill-1',
      skillName: 'Character Artist',
    });
    expect(result.params).toEqual({});
    expect(Object.isFrozen(result.assetMetadata)).toBe(true);
    expect(Object.isFrozen(result.promptMeta)).toBe(true);
    expect(Object.isFrozen(result.promptMeta?.tags)).toBe(true);
    expect(Object.isFrozen(result.promptMeta?.knowledgeContextRefs)).toBe(true);
    expect(Object.isFrozen(result.promptMeta?.knowledgeContextRefs?.[0])).toBe(
      true
    );
  });

  it.each([
    { raw: null, field: undefined },
    { raw: {}, field: 'prompt' },
    { raw: { prompt: 'draw', params: [] }, field: 'params' },
    {
      raw: { prompt: 'draw', uploadedImage: { name: 'missing-data' } },
      field: 'uploadedImage[0]',
    },
    {
      raw: { prompt: 'draw', generationMode: 'unknown' },
      field: 'generationMode',
    },
    { raw: { prompt: 'draw', count: 0 }, field: 'count' },
    {
      raw: { prompt: 'draw', outputCompression: 101 },
      field: 'outputCompression',
    },
  ])(
    'rejects malformed input without silently dropping it: $field',
    ({ raw, field }) => {
      try {
        normalizeImageRequest(raw);
        throw new Error('expected normalization to fail');
      } catch (error) {
        expect(error).toBeInstanceOf(ImageInvocationError);
        expect((error as ImageInvocationError).code).toBe(
          'IMAGE_REQUEST_INVALID'
        );
        if (field) {
          expect((error as ImageInvocationError).details?.field).toBe(field);
        }
      }
    }
  );
});

describe('createImageAdapterRequest', () => {
  it('projects one resolved invocation without re-reading aliases or settings', () => {
    const normalized = normalizeImageRequest({
      prompt: 'Edit the product photo',
      model: 'stale-model',
      modelRef: { profileId: 'profile-a', modelId: 'stale-model' },
      referenceImages: ['https://example.com/source.png'],
      params: {
        resolution: '2k',
        n: 2,
        provider_option: 'kept',
      },
      assetMetadata: {
        category: 'CHARACTER',
        characterName: 'Nova',
      },
      promptMeta: {
        initialPrompt: 'original prompt',
        sentPrompt: 'Edit the product photo',
        category: 'image',
      },
    });
    const plan: InvocationPlan = {
      provider: {
        profileId: 'profile-a',
        profileName: 'Provider A',
        providerType: 'openai-compatible',
        baseUrl: 'https://example.test/v1',
        apiKey: 'test-key',
        authType: 'bearer',
      },
      modelRef: {
        profileId: 'profile-a',
        modelId: 'replacement-model',
      },
      binding: {
        id: 'profile-a:replacement-model:image:edit',
        profileId: 'profile-a',
        modelId: 'replacement-model',
        operation: 'image',
        protocol: 'openai.images.edits',
        requestSchema: 'openai.image.gpt-edit-form',
        responseSchema: 'openai.image.data',
        submitPath: '/images/edits',
        priority: 100,
        confidence: 'high',
        source: 'manual',
      },
    };
    const adapter: ImageModelAdapter = {
      id: 'test-image-adapter',
      label: 'Test Image Adapter',
      kind: 'image',
      async generateImage() {
        return { artifacts: [] };
      },
    };
    const invocation: ResolvedImageInvocation = {
      request: normalized,
      intent: 'edit',
      preferredRequestSchema: ['openai.image.gpt-edit-form'],
      plan,
      modelRef: { profileId: 'profile-a', modelId: 'replacement-model' },
      modelId: 'replacement-model',
      adapter,
      adapterContext: {
        baseUrl: 'https://example.test/v1',
        binding: plan.binding,
      },
      capabilities: resolveImageBindingCapabilities(plan.binding),
      telemetry: createImageInvocationTelemetry(),
    };
    const onSubmitted = () => undefined;
    const onProgress = () => undefined;

    const request = createImageAdapterRequest(invocation, {
      referenceImages: ['data:image/png;base64,AAAA'],
      onSubmitted,
      onProgress,
    });

    expect(request).toMatchObject({
      prompt: 'Edit the product photo',
      operationIntent: 'edit',
      model: 'replacement-model',
      modelRef: { profileId: 'profile-a', modelId: 'replacement-model' },
      generationMode: 'image_to_image',
      referenceImages: ['data:image/png;base64,AAAA'],
      resolution: '2k',
      count: 2,
      params: { provider_option: 'kept' },
      onSubmitted,
      onProgress,
    });
    expect(Object.isFrozen(request)).toBe(true);
    expect(Object.isFrozen(request.referenceImages)).toBe(true);
    expect(request).not.toHaveProperty('assetMetadata');
    expect(request).not.toHaveProperty('promptMeta');
  });
});

describe('resolveImageOperationIntent', () => {
  it.each([
    [{ prompt: 'draw' }, 'generation'],
    [{ prompt: 'draw', generationMode: 'text_to_image' }, 'generation'],
    [
      { prompt: 'draw', referenceImages: ['https://example.com/ref.png'] },
      'edit',
    ],
    [
      { prompt: 'draw', uploadedImage: { url: 'https://example.com/ref.png' } },
      'edit',
    ],
    [{ prompt: 'draw', mask_image: 'data:image/png;base64,AAAA' }, 'edit'],
    [{ prompt: 'draw', generation_mode: 'image_to_image' }, 'edit'],
    [{ prompt: 'draw', generationMode: 'image_edit' }, 'edit'],
    [
      {
        prompt: 'draw',
        generationMode: 'text_to_image',
        params: { uploaded_images: ['https://example.com/ref.png'] },
      },
      'edit',
    ],
  ] as const)('resolves the truth table for %#', (raw, expected) => {
    expect(resolveImageOperationIntent(normalizeImageRequest(raw))).toBe(
      expected
    );
  });
});

describe('image binding capabilities', () => {
  it('uses exact request-schema evidence without consulting the model name', () => {
    const generation = resolveImageBindingCapabilities(
      binding('openai.image.gpt-generation-json', {
        modelId: 'arbitrary-dynamic-model',
      })
    );
    const edit = resolveImageBindingCapabilities(
      binding('openai.image.gpt-edit-form', {
        modelId: 'arbitrary-dynamic-model',
      })
    );

    expect(generation.source).toBe('request-schema');
    expect(generation.operations).toEqual(['generation']);
    expect(generation.referenceImages?.supported).toBe(false);
    expect(edit.operations).toEqual(['edit']);
    expect(edit.referenceImages).toEqual({
      supported: true,
      minCount: 1,
      maxCount: 16,
    });
    expect(edit.maskImage).toBe(true);
  });

  it('lets explicit nested metadata override schema fallback field by field', () => {
    const capabilities = resolveImageBindingCapabilities(
      binding('openai.image.basic-json', {
        imageMetadata: {
          capabilities: {
            operations: ['generation'],
            referenceImages: false,
            size: ['1:1', '16:9'],
            outputFormat: ['PNG', 'jpg'],
            count: { min: 2, max: 4, integer: true },
          },
        },
      })
    );

    expect(capabilities.source).toBe('mixed');
    expect(capabilities.operations).toEqual(['generation']);
    expect(capabilities.referenceImages).toEqual({ supported: false });
    expect(capabilities.size).toEqual({
      supported: true,
      values: ['1x1', '16x9'],
    });
    expect(capabilities.outputFormat).toEqual({
      supported: true,
      values: ['png', 'jpeg'],
    });
    expect(capabilities.count).toEqual({
      supported: true,
      min: 2,
      max: 4,
      integer: true,
    });
    expect(capabilities.evidence.size).toBe('binding-metadata');
    expect(capabilities.evidence.quality).toBe('request-schema');
  });

  it('accepts existing direct image action/count/mask metadata', () => {
    const capabilities = resolveImageBindingCapabilities(
      binding('openai.image.gpt-edit-form', {
        imageMetadata: {
          action: 'edit',
          maxImageCount: 3,
          supportsMask: false,
          quality: ['high'],
        },
      })
    );

    expect(capabilities.operations).toEqual(['edit']);
    expect(capabilities.referenceImages).toEqual({
      supported: true,
      minCount: 1,
      maxCount: 3,
    });
    expect(capabilities.maskImage).toBe(false);
    expect(capabilities.quality?.values).toEqual(['high']);
  });

  it('keeps identical model IDs isolated by their binding/profile metadata', () => {
    const first = resolveImageBindingCapabilities(
      binding('dynamic.image.schema', {
        id: 'binding-a',
        profileId: 'profile-a',
        modelId: 'same-model',
        imageMetadata: {
          capabilities: { operations: ['generation'], size: ['1:1'] },
        },
      })
    );
    const second = resolveImageBindingCapabilities(
      binding('dynamic.image.schema', {
        id: 'binding-b',
        profileId: 'profile-b',
        modelId: 'same-model',
        imageMetadata: {
          capabilities: { operations: ['edit'], size: false },
        },
      })
    );

    expect(first.profileId).toBe('profile-a');
    expect(first.operations).toEqual(['generation']);
    expect(first.size?.supported).toBe(true);
    expect(second.profileId).toBe('profile-b');
    expect(second.operations).toEqual(['edit']);
    expect(second.size?.supported).toBe(false);
  });

  it('uses a conservative unknown result for an unrecognized schema even if its model name looks familiar', () => {
    const capabilities = resolveImageBindingCapabilities(
      binding('vendor.unknown-image-schema', { modelId: 'gpt-image-2' })
    );
    const request = normalizeImageRequest({ prompt: 'draw', size: '1x1' });
    const issues = validateImageRequestCapabilities(
      request,
      resolveImageOperationIntent(request),
      capabilities
    );

    expect(capabilities.source).toBe('unknown');
    expect(capabilities.operations).toBeUndefined();
    expect(issues).toEqual([
      expect.objectContaining({ parameter: 'operation', reason: 'unknown' }),
      expect.objectContaining({ parameter: 'size', reason: 'unknown' }),
    ]);
  });

  it('reports every unsupported parameter before transport', () => {
    const capabilities = resolveImageBindingCapabilities(
      binding('google.generate-content.image-inline')
    );
    const request = normalizeImageRequest({
      prompt: 'draw',
      maskImage: 'https://example.com/mask.png',
      background: 'transparent',
      outputFormat: 'png',
      outputCompression: 50,
      count: 2,
    });
    const issues = validateImageRequestCapabilities(
      request,
      resolveImageOperationIntent(request),
      capabilities
    );

    expect(issues.map(({ parameter, reason }) => [parameter, reason])).toEqual([
      ['maskImage', 'unsupported'],
      ['background', 'unsupported'],
      ['outputFormat', 'unsupported'],
      ['outputCompression', 'unsupported'],
      ['count', 'unsupported'],
    ]);
    expect(() =>
      assertImageRequestCapabilities(request, 'edit', capabilities)
    ).toThrowError(
      expect.objectContaining({
        code: 'IMAGE_PARAMETER_UNSUPPORTED',
        stage: 'capability-validation',
      })
    );
  });

  it('accepts only provider params owned by the selected request schema', () => {
    const seedreamCapabilities = resolveImageBindingCapabilities(
      binding('openai.image.seedream-json')
    );
    const validSeedreamRequest = normalizeImageRequest({
      prompt: 'draw',
      params: { seedream_quality: '4k' },
    });

    expect(
      validateImageRequestCapabilities(
        validSeedreamRequest,
        'generation',
        seedreamCapabilities
      )
    ).toEqual([]);

    const gptCapabilities = resolveImageBindingCapabilities(
      binding('openai.image.gpt-generation-json')
    );
    const wrongSchemaRequest = normalizeImageRequest({
      prompt: 'draw',
      params: { seedream_quality: '4k' },
    });
    expect(
      validateImageRequestCapabilities(
        wrongSchemaRequest,
        'generation',
        gptCapabilities
      )
    ).toEqual([
      expect.objectContaining({
        parameter: 'params.seedream_quality',
        reason: 'unsupported',
      }),
    ]);
  });

  it('rejects unknown and invalid provider params before serialization', () => {
    const seedreamCapabilities = resolveImageBindingCapabilities(
      binding('openai.image.seedream-json')
    );
    const request = normalizeImageRequest({
      prompt: 'draw',
      params: {
        seedream_quality: 'ultra',
        provider_option: true,
      },
    });

    expect(
      validateImageRequestCapabilities(
        request,
        'generation',
        seedreamCapabilities
      ).map(({ parameter, reason }) => [parameter, reason])
    ).toEqual([
      ['params.seedream_quality', 'invalid-value'],
      ['params.provider_option', 'unsupported'],
    ]);
  });

  it('accepts the MJ serializer parameter contract without model-name inference', () => {
    const capabilities = resolveImageBindingCapabilities(
      binding('mj.imagine.base64-array', {
        modelId: 'runtime-image-id-without-mj-name',
      })
    );
    const request = normalizeImageRequest({
      prompt: 'draw',
      params: {
        mj_ar: '16:9',
        mj_v: 7,
        mj_style: 'raw',
        mj_s: 200,
        mj_q: '2',
        mj_seed: 42,
      },
    });

    expect(
      validateImageRequestCapabilities(request, 'generation', capabilities)
    ).toEqual([]);
  });

  it('validates explicit enum, reference-count, and numeric ranges', () => {
    const capabilities = resolveImageBindingCapabilities(
      binding('dynamic.image.schema', {
        imageMetadata: {
          operations: ['edit'],
          referenceImages: { minCount: 1, maxCount: 1 },
          size: ['1x1'],
          outputCompression: { min: 10, max: 90 },
          count: { min: 1, max: 2, integer: true },
        },
      })
    );
    const request = normalizeImageRequest({
      prompt: 'edit',
      referenceImages: [
        'https://example.com/a.png',
        'https://example.com/b.png',
      ],
      size: '16:9',
      outputCompression: 5,
      count: 3,
    });

    expect(
      validateImageRequestCapabilities(request, 'edit', capabilities).map(
        ({ parameter, reason }) => [parameter, reason]
      )
    ).toEqual([
      ['referenceImages', 'above-maximum'],
      ['size', 'invalid-value'],
      ['outputCompression', 'below-minimum'],
      ['count', 'above-maximum'],
    ]);
  });

  it.each([
    { capabilities: 'not-an-object', field: 'image.capabilities' },
    {
      capabilities: { operations: ['generation', 'other'] },
      field: 'image.capabilities.operations',
    },
    {
      capabilities: { referenceImages: { minCount: 2, maxCount: 1 } },
      field: 'image.capabilities.referenceImages',
    },
  ])(
    'rejects malformed explicit metadata: $field',
    ({ capabilities, field }) => {
      expect(() =>
        resolveImageBindingCapabilities(
          binding('dynamic.image.schema', {
            imageMetadata: { capabilities },
          })
        )
      ).toThrowError(
        expect.objectContaining({
          code: 'IMAGE_CAPABILITY_METADATA_INVALID',
          details: expect.objectContaining({ field }),
        })
      );
    }
  );
});
