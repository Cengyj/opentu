import { describe, expect, it } from 'vitest';
import {
  getTextBindingMaxImageCount,
  inferBindingsForProviderModel,
  InvocationPlanner,
  supportsTextBindingImageInput,
} from '../provider-routing';
import { providerTransport } from '../provider-routing';
import type {
  InvocationPlannerRepositories,
  ProviderModelBinding,
  ProviderProfileSnapshot,
} from '../provider-routing';
import { ModelVendor, type ModelConfig } from '../../constants/model-config';

function createRepositories(params: {
  profiles?: ProviderProfileSnapshot[];
  bindings?: ProviderModelBinding[];
}): InvocationPlannerRepositories {
  const profiles = params.profiles || [];
  const bindings = params.bindings || [];

  return {
    getProviderProfile(profileId) {
      return profiles.find((profile) => profile.id === profileId) || null;
    },
    getModelBindings(modelRef, operation) {
      return bindings.filter(
        (binding) =>
          binding.profileId === modelRef.profileId &&
          binding.modelId === modelRef.modelId &&
          binding.operation === operation
      );
    },
  };
}

describe('provider routing', () => {
  it('plans the highest-priority binding for the selected provider model', () => {
    const planner = new InvocationPlanner(
      createRepositories({
        profiles: [
          {
            id: 'provider-a',
            name: 'Provider A',
            providerType: 'openai-compatible',
            baseUrl: 'https://api-a.example.com/v1',
            apiKey: 'key-a',
            authType: 'bearer',
          },
        ],
        bindings: [
          {
            id: 'openai-image',
            profileId: 'provider-a',
            modelId: 'gemini-3-pro-image-preview',
            operation: 'image',
            protocol: 'openai.images.generations',
            requestSchema: 'openai.image.basic-json',
            responseSchema: 'openai.image.basic',
            submitPath: '/images/generations',
            priority: 100,
            confidence: 'high',
            source: 'template',
          },
          {
            id: 'google-image',
            profileId: 'provider-a',
            modelId: 'gemini-3-pro-image-preview',
            operation: 'image',
            protocol: 'google.generateContent',
            requestSchema: 'google.gemini.generate-content.image',
            responseSchema: 'google.gemini.generate-content',
            submitPath: '/v1beta/models/{model}:generateContent',
            baseUrlStrategy: 'trim-v1',
            priority: 50,
            confidence: 'medium',
            source: 'discovered',
          },
        ],
      })
    );

    const plan = planner.plan({
      operation: 'image',
      modelRef: {
        profileId: 'provider-a',
        modelId: 'gemini-3-pro-image-preview',
      },
    });

    expect(plan.binding.id).toBe('openai-image');
    expect(plan.binding.protocol).toBe('openai.images.generations');
    expect(plan.provider.profileId).toBe('provider-a');
  });

  it('does not let a lower-priority async candidate bypass normal binding ranking', () => {
    const profile: ProviderProfileSnapshot = {
      id: 'provider-ranked',
      name: 'Ranked Provider',
      providerType: 'openai-compatible',
      baseUrl: 'https://api.example.com/v1',
      apiKey: 'key',
      authType: 'bearer',
    };
    const bindings: ProviderModelBinding[] = [
      {
        id: 'dedicated-image',
        profileId: profile.id,
        modelId: 'ranked-image',
        operation: 'image',
        protocol: 'flux.task',
        requestSchema: 'flux.image.polling-json',
        responseSchema: 'flux.task.status',
        submitPath: '/flux/v1/{model}',
        pollPathTemplate: '/flux/v1/get_result?id={taskId}',
        priority: 600,
        confidence: 'high',
        source: 'template',
      },
      {
        id: 'low-async-image',
        profileId: profile.id,
        modelId: 'ranked-image',
        operation: 'image',
        protocol: 'openai.async.media',
        requestSchema: 'openai.async.image.form',
        responseSchema: 'openai.async.task',
        submitPath: '/videos',
        pollPathTemplate: '/videos/{taskId}',
        priority: 100,
        confidence: 'medium',
        source: 'discovered',
      },
    ];

    const plan = new InvocationPlanner(
      createRepositories({ profiles: [profile], bindings })
    ).plan({
      operation: 'image',
      modelRef: { profileId: profile.id, modelId: 'ranked-image' },
    });

    expect(plan.binding.id).toBe('dedicated-image');
  });

  it('uses preferred request schema when a model has generation and edit bindings', () => {
    const planner = new InvocationPlanner(
      createRepositories({
        profiles: [
          {
            id: 'provider-a',
            name: 'Provider A',
            providerType: 'openai-compatible',
            baseUrl: 'https://api.openai.com/v1',
            apiKey: 'key-a',
            authType: 'bearer',
          },
        ],
        bindings: [
          {
            id: 'gpt-generation',
            profileId: 'provider-a',
            modelId: 'gpt-image-2',
            operation: 'image',
            protocol: 'openai.images.generations',
            requestSchema: 'openai.image.gpt-generation-json',
            responseSchema: 'openai.image.data',
            submitPath: '/images/generations',
            priority: 320,
            confidence: 'high',
            source: 'template',
          },
          {
            id: 'gpt-edit',
            profileId: 'provider-a',
            modelId: 'gpt-image-2',
            operation: 'image',
            protocol: 'openai.images.edits',
            requestSchema: 'openai.image.gpt-edit-form',
            responseSchema: 'openai.image.data',
            submitPath: '/images/edits',
            priority: 319,
            confidence: 'high',
            source: 'template',
          },
        ],
      })
    );

    const editPlan = planner.plan({
      operation: 'image',
      modelRef: {
        profileId: 'provider-a',
        modelId: 'gpt-image-2',
      },
      preferredRequestSchema: ['missing.schema', 'openai.image.gpt-edit-form'],
    });
    const fallbackPlan = planner.plan({
      operation: 'image',
      modelRef: {
        profileId: 'provider-a',
        modelId: 'gpt-image-2',
      },
      preferredRequestSchema: 'missing.schema',
    });

    expect(editPlan.binding.id).toBe('gpt-edit');
    expect(editPlan.binding.submitPath).toBe('/images/edits');
    expect(fallbackPlan.binding.id).toBe('gpt-generation');
  });

  it('keeps same model ids separate across different providers', () => {
    const planner = new InvocationPlanner(
      createRepositories({
        profiles: [
          {
            id: 'provider-a',
            name: 'Provider A',
            providerType: 'openai-compatible',
            baseUrl: 'https://api-a.example.com/v1',
            apiKey: 'key-a',
            authType: 'bearer',
          },
          {
            id: 'provider-b',
            name: 'Provider B',
            providerType: 'gemini-compatible',
            baseUrl: 'https://generativelanguage.googleapis.com',
            apiKey: 'key-b',
            authType: 'bearer',
          },
        ],
        bindings: [
          {
            id: 'provider-a-image',
            profileId: 'provider-a',
            modelId: 'gemini-3-pro-image-preview',
            operation: 'image',
            protocol: 'openai.images.generations',
            requestSchema: 'openai.image.basic-json',
            responseSchema: 'openai.image.basic',
            submitPath: '/images/generations',
            priority: 100,
            confidence: 'high',
            source: 'template',
          },
          {
            id: 'provider-b-image',
            profileId: 'provider-b',
            modelId: 'gemini-3-pro-image-preview',
            operation: 'image',
            protocol: 'google.generateContent',
            requestSchema: 'google.gemini.generate-content.image',
            responseSchema: 'google.gemini.generate-content',
            submitPath: '/v1beta/models/{model}:generateContent',
            baseUrlStrategy: 'trim-v1',
            priority: 100,
            confidence: 'high',
            source: 'template',
          },
        ],
      })
    );

    const plan = planner.plan({
      operation: 'image',
      modelRef: {
        profileId: 'provider-b',
        modelId: 'gemini-3-pro-image-preview',
      },
    });

    expect(plan.binding.id).toBe('provider-b-image');
    expect(plan.binding.protocol).toBe('google.generateContent');
    expect(plan.provider.profileId).toBe('provider-b');
    expect(plan.provider.authType).toBe('bearer');
  });

  it('plans GPT generation, GPT edit, and Gemini image bindings within one auto profile', () => {
    const profile: ProviderProfileSnapshot = {
      id: 'provider-auto',
      name: 'Mixed Image Provider',
      providerType: 'auto',
      baseUrl: 'https://gateway.example.com/v1',
      apiKey: 'key-auto',
      authType: 'bearer',
      imageApiCompatibility: 'openai-gpt-image',
    };
    const gptModel: ModelConfig = {
      id: 'gpt-image-2',
      label: 'GPT Image 2',
      type: 'image',
      vendor: ModelVendor.GPT,
    };
    const geminiModel: ModelConfig = {
      id: 'gemini-3-pro-image-preview',
      label: 'Gemini Image',
      type: 'image',
      vendor: ModelVendor.GEMINI,
    };
    const bindings = [
      ...inferBindingsForProviderModel(profile, gptModel),
      ...inferBindingsForProviderModel(profile, geminiModel),
    ];
    const planner = new InvocationPlanner(
      createRepositories({ profiles: [profile], bindings })
    );

    const gptGeneration = planner.plan({
      operation: 'image',
      modelRef: { profileId: profile.id, modelId: gptModel.id },
    });
    const gptEdit = planner.plan({
      operation: 'image',
      modelRef: { profileId: profile.id, modelId: gptModel.id },
      preferredRequestSchema: 'openai.image.gpt-edit-form',
    });
    const geminiGeneration = planner.plan({
      operation: 'image',
      modelRef: { profileId: profile.id, modelId: geminiModel.id },
    });

    expect(gptGeneration.binding).toMatchObject({
      protocol: 'openai.images.generations',
      requestSchema: 'openai.image.gpt-generation-json',
      submitPath: '/images/generations',
    });
    expect(gptEdit.binding).toMatchObject({
      protocol: 'openai.images.edits',
      requestSchema: 'openai.image.gpt-edit-form',
      submitPath: '/images/edits',
    });
    expect(geminiGeneration.binding).toMatchObject({
      protocol: 'google.generateContent',
      requestSchema: 'google.generate-content.image-inline',
      submitPath: '/v1beta/models/{model}:generateContent',
    });
    expect(
      bindings.filter((binding) => binding.modelId === geminiModel.id)
    ).toHaveLength(1);
  });

  it('rejects equally ranked incompatible bindings for auto profiles', () => {
    const profile: ProviderProfileSnapshot = {
      id: 'provider-auto',
      name: 'Ambiguous Provider',
      providerType: 'auto',
      baseUrl: 'https://gateway.example.com/v1',
      apiKey: 'key-auto',
      authType: 'bearer',
    };
    const bindings: ProviderModelBinding[] = [
      {
        id: 'discovered-google',
        profileId: profile.id,
        modelId: 'unknown-image-model',
        operation: 'image',
        protocol: 'google.generateContent',
        requestSchema: 'google.generate-content.image-inline',
        responseSchema: 'google.generate-content.parts',
        submitPath: '/v1beta/models/{model}:generateContent',
        priority: 140,
        confidence: 'medium',
        source: 'discovered',
      },
      {
        id: 'discovered-google-alternate',
        profileId: profile.id,
        modelId: 'unknown-image-model',
        operation: 'image',
        protocol: 'google.generateContent',
        requestSchema: 'google.generate-content.image-inline',
        responseSchema: 'google.generate-content.parts',
        submitPath: '/custom/models/{model}:generateContent',
        priority: 140,
        confidence: 'medium',
        source: 'discovered',
      },
    ];
    const planner = new InvocationPlanner(
      createRepositories({ profiles: [profile], bindings })
    );

    expect(() =>
      planner.plan({
        operation: 'image',
        modelRef: {
          profileId: profile.id,
          modelId: 'unknown-image-model',
        },
      })
    ).toThrowError(
      expect.objectContaining({
        name: 'InvocationPlanningError',
        reason: 'AMBIGUOUS_BINDING',
        details: expect.objectContaining({
          profileId: profile.id,
          modelId: 'unknown-image-model',
          operation: 'image',
          bindingIds: expect.arrayContaining([
            'discovered-google',
            'discovered-google-alternate',
          ]),
        }),
      })
    );
    expect(
      planner.plan({
        operation: 'image',
        modelRef: {
          profileId: profile.id,
          modelId: 'unknown-image-model',
        },
        bindingId: 'discovered-google',
      }).binding.id
    ).toBe('discovered-google');
  });

  it('throws when no binding exists for the selected operation', () => {
    const planner = new InvocationPlanner(
      createRepositories({
        profiles: [
          {
            id: 'provider-a',
            name: 'Provider A',
            providerType: 'openai-compatible',
            baseUrl: 'https://api-a.example.com/v1',
            apiKey: 'key-a',
            authType: 'bearer',
          },
        ],
      })
    );

    expect(() =>
      planner.plan({
        operation: 'video',
        modelRef: {
          profileId: 'provider-a',
          modelId: 'gemini-3-pro-image-preview',
        },
      })
    ).toThrowError(
      expect.objectContaining({
        name: 'InvocationPlanningError',
        reason: 'BINDING_NOT_FOUND',
        details: {
          profileId: 'provider-a',
          modelId: 'gemini-3-pro-image-preview',
          operation: 'video',
        },
      })
    );
  });

  it('prepares bearer-auth transport requests', () => {
    const prepared = providerTransport.prepareRequest(
      {
        profileId: 'provider-a',
        profileName: 'Provider A',
        providerType: 'openai-compatible',
        baseUrl: 'https://api.example.com/v1/',
        apiKey: 'secret',
        authType: 'bearer',
      },
      {
        path: '/images/generations',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );

    expect(prepared.url).toBe('https://api.example.com/v1/images/generations');
    expect(prepared.headers.Authorization).toBe('Bearer secret');
    expect(prepared.headers['Content-Type']).toBe('application/json');
  });

  it('prepares query-auth transport requests', () => {
    const prepared = providerTransport.prepareRequest(
      {
        profileId: 'provider-b',
        profileName: 'Provider B',
        providerType: 'gemini-compatible',
        baseUrl: 'https://generativelanguage.googleapis.com',
        apiKey: 'secret',
        authType: 'query',
      },
      {
        path: '/v1beta/models/test:generateContent',
      }
    );

    expect(prepared.url).toBe(
      'https://generativelanguage.googleapis.com/v1beta/models/test:generateContent?key=secret'
    );
  });

  it('uses the binding query-key contract for auto profiles', () => {
    const context = {
      profileId: 'provider-auto',
      profileName: 'Auto Provider',
      providerType: 'auto',
      baseUrl: 'https://gateway.example.com/v1',
      apiKey: 'secret',
      authType: 'query' as const,
      extraHeaders: { 'X-Tenant': 'tenant-a' },
    };
    const googleRequest = providerTransport.prepareRequest(context, {
      path: '/v1beta/models/test:generateContent',
      baseUrlStrategy: 'trim-v1',
      authQueryKey: 'key',
      query: { alt: 'sse' },
    });
    const openaiRequest = providerTransport.prepareRequest(context, {
      path: '/images/generations',
      authQueryKey: 'api_key',
    });

    expect(googleRequest.url).toBe(
      'https://gateway.example.com/v1beta/models/test:generateContent?alt=sse&key=secret'
    );
    expect(googleRequest.headers['X-Tenant']).toBe('tenant-a');
    expect(openaiRequest.url).toBe(
      'https://gateway.example.com/v1/images/generations?api_key=secret'
    );
  });

  it('trims a trailing /v1 for google-compatible protocol roots', () => {
    const prepared = providerTransport.prepareRequest(
      {
        profileId: 'provider-b',
        profileName: 'Provider B',
        providerType: 'gemini-compatible',
        baseUrl: 'https://foropencode.com/v1/',
        apiKey: 'secret',
        authType: 'query',
      },
      {
        path: '/v1beta/models/test:generateContent',
        baseUrlStrategy: 'trim-v1',
      }
    );

    expect(prepared.url).toBe(
      'https://foropencode.com/v1beta/models/test:generateContent?key=secret'
    );
  });

  it('infers different bindings for the same model across provider types', () => {
    const model: ModelConfig = {
      id: 'gemini-3-pro-image-preview',
      label: 'Gemini Image',
      type: 'image',
      vendor: ModelVendor.GEMINI,
    };

    const openaiBindings = inferBindingsForProviderModel(
      {
        id: 'provider-a',
        name: 'Provider A',
        providerType: 'openai-compatible',
        baseUrl: 'https://api-a.example.com/v1',
        apiKey: 'key-a',
        authType: 'bearer',
      },
      model
    );
    const geminiBindings = inferBindingsForProviderModel(
      {
        id: 'provider-b',
        name: 'Provider B',
        providerType: 'gemini-compatible',
        baseUrl: 'https://generativelanguage.googleapis.com',
        apiKey: 'key-b',
        authType: 'bearer',
      },
      model
    );

    expect(openaiBindings.map((binding) => binding.protocol)).toContain(
      'openai.images.generations'
    );
    expect(geminiBindings.map((binding) => binding.protocol)).toContain(
      'google.generateContent'
    );
    expect(
      geminiBindings.find(
        (binding) => binding.protocol === 'google.generateContent'
      )?.baseUrlStrategy
    ).toBe('trim-v1');
  });

  it('routes the same GPT Image model by profile image compatibility', () => {
    const model: ModelConfig = {
      id: 'gpt-image-2',
      label: 'GPT Image 2',
      type: 'image',
      vendor: ModelVendor.GPT,
    };

    const officialBindings = inferBindingsForProviderModel(
      {
        id: 'provider-openai',
        name: 'OpenAI',
        providerType: 'openai-compatible',
        baseUrl: 'https://api.openai.com/v1',
        apiKey: 'openai-key',
        authType: 'bearer',
        imageApiCompatibility: 'auto',
      },
      model
    );
    const forBindings = inferBindingsForProviderModel(
      {
        id: 'provider-for',
        name: 'For',
        providerType: 'openai-compatible',
        baseUrl: 'https://foropencode.com/v1',
        apiKey: 'for-key',
        authType: 'bearer',
        imageApiCompatibility: 'auto',
      },
      model
    );
    const genericBindings = inferBindingsForProviderModel(
      {
        id: 'provider-generic',
        name: 'Generic',
        providerType: 'openai-compatible',
        baseUrl: 'https://gateway.example.com/v1',
        apiKey: 'generic-key',
        authType: 'bearer',
        imageApiCompatibility: 'openai-gpt-image',
      },
      model
    );

    expect(officialBindings.map((binding) => binding.requestSchema)).toEqual([
      'openai.image.gpt-generation-json',
      'openai.image.gpt-edit-form',
    ]);
    expect(officialBindings[0]?.metadata?.image).toMatchObject({
      action: 'generation',
      imageApiCompatibility: 'auto',
      resolvedImageApiCompatibility: 'openai-gpt-image',
    });
    expect(officialBindings[1]?.metadata?.image).toMatchObject({
      action: 'edit',
      maxImageCount: 16,
      supportsMask: true,
      imageApiCompatibility: 'auto',
      resolvedImageApiCompatibility: 'openai-gpt-image',
    });
    expect(forBindings.map((binding) => binding.requestSchema)).toEqual([
      'openai.image.basic-json',
    ]);
    expect(forBindings[0]?.metadata?.image).toMatchObject({
      action: 'generation',
      imageApiCompatibility: 'auto',
      resolvedImageApiCompatibility: 'openai-compatible-basic',
    });
    expect(genericBindings.map((binding) => binding.requestSchema)).toEqual([
      'openai.image.gpt-generation-json',
      'openai.image.gpt-edit-form',
    ]);
  });

  it('routes for gemini image models through generateContent', () => {
    const profile = {
      id: 'provider-b',
      name: 'Provider B',
      providerType: 'gemini-compatible' as const,
      baseUrl: 'https://foropencode.com/v1',
      apiKey: 'key-b',
      authType: 'query' as const,
    };
    const model: ModelConfig = {
      id: 'gemini-3.1-flash-image-preview-4k',
      label: 'Gemini Image 4K',
      type: 'image',
      vendor: ModelVendor.GEMINI,
    };
    const bindings = inferBindingsForProviderModel(profile, model);
    const planner = new InvocationPlanner(
      createRepositories({
        profiles: [profile],
        bindings,
      })
    );

    const plan = planner.plan({
      operation: 'image',
      modelRef: {
        profileId: profile.id,
        modelId: model.id,
      },
    });

    expect(bindings.map((binding) => binding.protocol)).toEqual([
      'google.generateContent',
    ]);
    expect(plan.binding.protocol).toBe('google.generateContent');
    expect(plan.binding.submitPath).toBe(
      '/v1beta/models/{model}:generateContent'
    );
  });

  it('keeps third-party for gemini image models on generateContent', () => {
    const profile = {
      id: 'provider-c',
      name: 'Provider C',
      providerType: 'gemini-compatible' as const,
      baseUrl: 'https://foropencode.com/v1',
      apiKey: 'key-c',
      authType: 'bearer' as const,
    };
    const model: ModelConfig = {
      id: 'gemini-3-pro-image-preview',
      label: 'Gemini Image',
      type: 'image',
      vendor: ModelVendor.GEMINI,
    };
    const bindings = inferBindingsForProviderModel(profile, model);
    const planner = new InvocationPlanner(
      createRepositories({
        profiles: [profile],
        bindings,
      })
    );

    const plan = planner.plan({
      operation: 'image',
      modelRef: {
        profileId: profile.id,
        modelId: model.id,
      },
    });

    expect(bindings.map((binding) => binding.protocol)).toEqual([
      'google.generateContent',
    ]);
    expect(plan.binding.protocol).toBe('google.generateContent');
    expect(plan.binding.submitPath).toBe(
      '/v1beta/models/{model}:generateContent'
    );
  });

  it('routes third-party GPT Image models in auto mode through the generic fallback', () => {
    const model: ModelConfig = {
      id: 'gpt-image-2',
      label: 'GPT Image 2',
      type: 'image',
      vendor: ModelVendor.GPT,
    };

    const bindings = inferBindingsForProviderModel(
      {
        id: 'provider-third-party',
        name: 'Third-party Provider',
        providerType: 'openai-compatible',
        baseUrl: 'https://foropencode.com/v1',
        apiKey: 'business-key',
        authType: 'bearer',
        imageApiCompatibility: 'auto',
      },
      model
    );

    expect(bindings.map((binding) => binding.requestSchema)).toEqual([
      'openai.image.basic-json',
    ]);
    expect(bindings[0]?.metadata?.image).toMatchObject({
      imageApiCompatibility: 'auto',
      resolvedImageApiCompatibility: 'openai-compatible-basic',
    });
  });

  it('keeps image compatibility auto semantics for auto provider profiles', () => {
    const bindings = inferBindingsForProviderModel(
      {
        id: 'provider-auto',
        name: 'Auto Provider',
        providerType: 'auto',
        baseUrl: 'https://foropencode.com/v1',
        apiKey: 'business-key',
        authType: 'bearer',
        imageApiCompatibility: 'auto',
      },
      {
        id: 'gpt-image-2',
        label: 'GPT Image 2',
        type: 'image',
        vendor: ModelVendor.GPT,
      }
    );

    expect(bindings.map((binding) => binding.requestSchema)).toEqual([
      'openai.image.basic-json',
    ]);
  });

  it('does not invent an image protocol for unknown auto-profile models', () => {
    const bindings = inferBindingsForProviderModel(
      {
        id: 'provider-auto',
        name: 'Auto Provider',
        providerType: 'auto',
        baseUrl: 'https://gateway.example.com/v1',
        apiKey: 'key',
        authType: 'bearer',
      },
      {
        id: 'unknown-image-model',
        label: 'Unknown Image',
        type: 'image',
        vendor: ModelVendor.OTHER,
      }
    );

    expect(bindings).toEqual([]);
  });

  it('keeps known async image models on model-scoped bindings for auto profiles', () => {
    const profile: ProviderProfileSnapshot = {
      id: 'provider-auto',
      name: 'Auto Provider',
      providerType: 'auto',
      baseUrl: 'https://gateway.example.com/v1',
      apiKey: 'key',
      authType: 'bearer',
    };
    const model: ModelConfig = {
      id: 'gemini-3-pro-image-preview-async',
      label: 'Gemini Async Image',
      type: 'image',
      vendor: ModelVendor.GEMINI,
    };
    const bindings = inferBindingsForProviderModel(profile, model);
    const plan = new InvocationPlanner(
      createRepositories({ profiles: [profile], bindings })
    ).plan({
      operation: 'image',
      modelRef: { profileId: profile.id, modelId: model.id },
    });

    expect(bindings).toHaveLength(1);
    expect(plan.binding).toMatchObject({
      protocol: 'openai.async.media',
      requestSchema: 'openai.async.image.form',
      submitPath: '/videos',
      pollPathTemplate: '/videos/{taskId}',
    });
  });

  it('preserves real discovered path candidates so auto planning can reject same-schema ambiguity', () => {
    const profile: ProviderProfileSnapshot = {
      id: 'provider-auto',
      name: 'Auto Provider',
      providerType: 'auto',
      baseUrl: 'https://gateway.example.com/v1',
      apiKey: 'key',
      authType: 'bearer',
    };
    const model: ModelConfig = {
      id: 'unknown-image-model',
      label: 'Unknown Image',
      type: 'image',
      vendor: ModelVendor.OTHER,
    };
    const bindings = inferBindingsForProviderModel(profile, model, {
      primary: {
        path: '/v1beta/models/{model}:generateContent',
        method: 'POST',
      },
      alternate: {
        path: '/custom/models/{model}:generateContent',
        method: 'POST',
      },
    });
    const planner = new InvocationPlanner(
      createRepositories({ profiles: [profile], bindings })
    );

    expect(bindings).toHaveLength(2);
    expect(new Set(bindings.map((binding) => binding.id)).size).toBe(2);
    expect(() =>
      planner.plan({
        operation: 'image',
        modelRef: { profileId: profile.id, modelId: model.id },
        preferredRequestSchema: 'google.generate-content.image-inline',
      })
    ).toThrow(/Ambiguous protocol bindings/);
  });

  it('selects model-scoped custom GPT generation and edit endpoints by request schema', () => {
    const profile: ProviderProfileSnapshot = {
      id: 'provider-auto-gpt-custom',
      name: 'Auto GPT Custom Provider',
      providerType: 'auto',
      baseUrl: 'https://gateway.example.com/v1',
      apiKey: 'key',
      authType: 'bearer',
      imageApiCompatibility: 'openai-gpt-image',
    };
    const model: ModelConfig = {
      id: 'gpt-image-2',
      label: 'GPT Image 2',
      type: 'image',
      vendor: ModelVendor.GPT,
    };
    const bindings = inferBindingsForProviderModel(profile, model, {
      generation: {
        path: '/gateway/v2/images/generations',
        method: 'PATCH',
      },
      edit: {
        path: '/gateway/v2/images/edits',
        method: 'POST',
      },
    });
    const planner = new InvocationPlanner(
      createRepositories({ profiles: [profile], bindings })
    );

    const generationPlan = planner.plan({
      operation: 'image',
      modelRef: { profileId: profile.id, modelId: model.id },
      preferredRequestSchema: 'openai.image.gpt-generation-json',
    });
    const editPlan = planner.plan({
      operation: 'image',
      modelRef: { profileId: profile.id, modelId: model.id },
      preferredRequestSchema: 'openai.image.gpt-edit-form',
    });

    expect(generationPlan.binding).toMatchObject({
      source: 'discovered',
      protocol: 'openai.images.generations',
      requestSchema: 'openai.image.gpt-generation-json',
      submitPath: '/gateway/v2/images/generations',
      submitMethod: 'PATCH',
      metadata: {
        image: {
          action: 'generation',
          serialization: {
            omitDefaultResponseFormat: true,
            defaultResolution: '1k',
          },
        },
      },
    });
    expect(editPlan.binding).toMatchObject({
      source: 'discovered',
      protocol: 'openai.images.edits',
      requestSchema: 'openai.image.gpt-edit-form',
      submitPath: '/gateway/v2/images/edits',
      submitMethod: 'POST',
      metadata: { image: { action: 'edit' } },
    });
    expect(() =>
      planner.plan({
        operation: 'image',
        modelRef: { profileId: profile.id, modelId: model.id },
      })
    ).toThrow(/Ambiguous protocol bindings/);
  });

  it('does not attach chat, video, or audio endpoint hints to an image model', () => {
    const profile: ProviderProfileSnapshot = {
      id: 'provider-auto-modal-filter',
      name: 'Auto Modal Filter Provider',
      providerType: 'auto',
      baseUrl: 'https://gateway.example.com/v1',
      apiKey: 'key',
      authType: 'bearer',
    };
    const bindings = inferBindingsForProviderModel(
      profile,
      {
        id: 'runtime-image-model',
        label: 'Runtime Image Model',
        type: 'image',
        vendor: ModelVendor.OTHER,
      },
      {
        image: {
          path: '/custom/images/generations',
          method: 'POST',
        },
        chat: {
          path: '/v1/chat/completions',
          method: 'POST',
        },
        video: {
          path: '/v1/videos',
          method: 'POST',
          scenario: 'video',
        },
        kling: {
          path: '/kling/v1/videos/text2video',
          method: 'POST',
        },
        audio: {
          path: '/suno/submit/music',
          method: 'POST',
        },
      }
    );

    expect(bindings).toHaveLength(1);
    expect(bindings[0]).toMatchObject({
      operation: 'image',
      protocol: 'openai.images.generations',
      requestSchema: 'openai.image.basic-json',
      submitPath: '/custom/images/generations',
      source: 'discovered',
    });
  });

  it('does not attach image endpoint hints to manual non-image model bindings', () => {
    const profile: ProviderProfileSnapshot = {
      id: 'provider-manual-modal-filter',
      name: 'Manual Modal Filter Provider',
      providerType: 'openai-compatible',
      baseUrl: 'https://gateway.example.com/v1',
      apiKey: 'key',
      authType: 'bearer',
    };
    const imageEndpoint = {
      generation: {
        path: '/custom/images/generations',
        method: 'POST',
      },
    };
    const textBindings = inferBindingsForProviderModel(
      profile,
      {
        id: 'runtime-chat-model',
        label: 'Runtime Chat Model',
        type: 'text',
        vendor: ModelVendor.OTHER,
      },
      imageEndpoint
    );
    const videoBindings = inferBindingsForProviderModel(
      profile,
      {
        id: 'runtime-video-model',
        label: 'Runtime Video Model',
        type: 'video',
        vendor: ModelVendor.OTHER,
      },
      imageEndpoint
    );

    expect(textBindings.map((binding) => binding.protocol)).toEqual([
      'openai.chat.completions',
    ]);
    expect(videoBindings.map((binding) => binding.protocol)).toEqual([
      'openai.async.video',
    ]);
  });

  it('keeps discovered generateContent bindings below template image bindings for For endpoints', () => {
    const profile = {
      id: 'provider-b',
      name: 'Provider B',
      providerType: 'openai-compatible' as const,
      baseUrl: 'https://foropencode.com/v1',
      apiKey: 'key-b',
      authType: 'bearer' as const,
    };
    const model: ModelConfig = {
      id: 'gemini-2.5-flash-image',
      label: 'Gemini Image',
      type: 'image',
      vendor: ModelVendor.GEMINI,
    };
    const bindings = inferBindingsForProviderModel(profile, model, {
      image: {
        path: '/v1beta/models/gemini-2.5-flash-image:generateContent',
      },
    });
    const planner = new InvocationPlanner(
      createRepositories({
        profiles: [profile],
        bindings,
      })
    );

    const plan = planner.plan({
      operation: 'image',
      modelRef: {
        profileId: profile.id,
        modelId: model.id,
      },
    });

    expect(bindings.map((binding) => binding.protocol)).toContain(
      'google.generateContent'
    );
    expect(plan.binding.protocol).toBe('openai.images.generations');
    expect(plan.binding.submitPath).toBe('/images/generations');
  });

  it('does not infer discovered official GPT edit bindings for generic compatibility profiles', () => {
    const profile = {
      id: 'provider-for',
      name: 'Provider For',
      providerType: 'openai-compatible' as const,
      baseUrl: 'https://foropencode.com/v1',
      apiKey: 'key-b',
      authType: 'bearer' as const,
      imageApiCompatibility: 'openai-compatible-basic' as const,
    };
    const model: ModelConfig = {
      id: 'gpt-image-2',
      label: 'GPT Image 2',
      type: 'image',
      vendor: ModelVendor.GPT,
    };

    const bindings = inferBindingsForProviderModel(profile, model, {
      edit: {
        path: '/images/edits',
      },
    });

    expect(bindings.map((binding) => binding.requestSchema)).toEqual([
      'openai.image.basic-json',
    ]);
  });

  it('prefers pricing async-image /v1/videos binding for image models', () => {
    const profile = {
      id: 'provider-async',
      name: 'Async Provider',
      providerType: 'openai-compatible' as const,
      baseUrl: 'https://foropencode.com/v1',
      apiKey: 'key-a',
      authType: 'bearer' as const,
    };
    const model: ModelConfig = {
      id: 'gpt-image-1-vip',
      label: 'GPT Image',
      type: 'image',
      vendor: ModelVendor.GPT,
    };
    const bindings = inferBindingsForProviderModel(profile, model, {
      generate: {
        path: '/v1/images/generations',
        method: 'POST',
      },
      'openai-video': {
        path: '/v1/videos',
        method: 'POST',
        scenario: 'async-image',
      },
    });
    const planner = new InvocationPlanner(
      createRepositories({
        profiles: [profile],
        bindings,
      })
    );

    const plan = planner.plan({
      operation: 'image',
      modelRef: {
        profileId: profile.id,
        modelId: model.id,
      },
    });

    expect(bindings.map((binding) => binding.protocol)).toContain(
      'openai.async.media'
    );
    expect(plan.binding.protocol).toBe('openai.async.media');
    expect(plan.binding.requestSchema).toBe('openai.async.image.form');
    expect(plan.binding.submitPath).toBe('/videos');
    expect(plan.binding.pollPathTemplate).toBe('/videos/{taskId}');
  });

  it('keeps a known async model when the requested edit schema is unavailable', () => {
    const profile = {
      id: 'provider-async',
      name: 'Async Provider',
      providerType: 'openai-compatible' as const,
      baseUrl: 'https://foropencode.com/v1',
      apiKey: 'key-a',
      authType: 'bearer' as const,
    };
    const model: ModelConfig = {
      id: 'gemini-3-pro-image-preview-async',
      label: 'Gemini Async Image',
      type: 'image',
      vendor: ModelVendor.GEMINI,
    };
    const bindings = inferBindingsForProviderModel(profile, model, {
      'openai-video': {
        path: '/v1/videos',
        method: 'POST',
        scenario: 'async-image',
      },
    });
    const planner = new InvocationPlanner(
      createRepositories({
        profiles: [profile],
        bindings,
      })
    );

    const plan = planner.plan({
      operation: 'image',
      modelRef: {
        profileId: profile.id,
        modelId: model.id,
      },
      preferredRequestSchema: 'openai.image.gpt-edit-form',
    });

    expect(bindings.map((binding) => binding.requestSchema)).toContain(
      'openai.async.image.form'
    );
    expect(plan.binding.protocol).toBe('openai.async.media');
    expect(plan.binding.requestSchema).toBe('openai.async.image.form');
    expect(plan.binding.submitPath).toBe('/videos');
  });

  it('honors an available GPT edit schema over an async generation candidate', () => {
    const profile = {
      id: 'provider-gpt-edit',
      name: 'GPT Edit Provider',
      providerType: 'openai-compatible' as const,
      baseUrl: 'https://foropencode.com/v1',
      apiKey: 'key-a',
      authType: 'bearer' as const,
      imageApiCompatibility: 'openai-gpt-image' as const,
    };
    const model: ModelConfig = {
      id: 'gpt-image-2',
      label: 'GPT Image 2',
      type: 'image',
      vendor: ModelVendor.GPT,
    };
    const bindings = inferBindingsForProviderModel(profile, model, {
      async: {
        path: '/v1/videos',
        method: 'POST',
        scenario: 'async-image',
      },
    });
    const plan = new InvocationPlanner(
      createRepositories({ profiles: [profile], bindings })
    ).plan({
      operation: 'image',
      modelRef: { profileId: profile.id, modelId: model.id },
      preferredRequestSchema: 'openai.image.gpt-edit-form',
    });

    expect(bindings.map((binding) => binding.protocol)).toContain(
      'openai.async.media'
    );
    expect(plan.binding).toMatchObject({
      protocol: 'openai.images.edits',
      requestSchema: 'openai.image.gpt-edit-form',
      submitPath: '/images/edits',
    });
  });

  it('prefers async image binding for async-listed image models', () => {
    const profile = {
      id: 'provider-async',
      name: 'Async Provider',
      providerType: 'openai-compatible' as const,
      baseUrl: 'https://foropencode.com/v1',
      apiKey: 'key-a',
      authType: 'bearer' as const,
    };
    const model: ModelConfig = {
      id: 'gemini-3-pro-image-preview-async',
      label: 'Gemini Async Image',
      type: 'image',
      vendor: ModelVendor.GEMINI,
    };
    const bindings = inferBindingsForProviderModel(profile, model, {
      'openai-video': {
        path: '/v1/videos',
        method: 'POST',
        scenario: 'async-image',
      },
    });
    const plan = new InvocationPlanner(
      createRepositories({
        profiles: [profile],
        bindings,
      })
    ).plan({
      operation: 'image',
      modelRef: {
        profileId: profile.id,
        modelId: model.id,
      },
    });

    expect(plan.binding.protocol).toBe('openai.async.media');
    expect(plan.binding.submitPath).toBe('/videos');
  });

  it('routes generic image models through an explicitly discovered async endpoint', () => {
    const profile = {
      id: 'provider-async',
      name: 'Async Provider',
      providerType: 'openai-compatible' as const,
      baseUrl: 'https://foropencode.com/v1',
      apiKey: 'key-a',
      authType: 'bearer' as const,
    };
    const model: ModelConfig = {
      id: 'qwen-image-2.0',
      label: 'Qwen Image 2.0',
      type: 'image',
      vendor: ModelVendor.QWEN,
    };
    const bindings = inferBindingsForProviderModel(profile, model, {
      'openai-video': {
        path: '/v1/videos',
        method: 'POST',
        scenario: 'async-image',
      },
    });
    const plan = new InvocationPlanner(
      createRepositories({
        profiles: [profile],
        bindings,
      })
    ).plan({
      operation: 'image',
      modelRef: {
        profileId: profile.id,
        modelId: model.id,
      },
    });

    expect(plan.binding.protocol).toBe('openai.async.media');
    expect(plan.binding.submitPath).toBe('/videos');
  });

  it('keeps ordinary image models on their normal binding without async evidence', () => {
    const profile = {
      id: 'provider-standard',
      name: 'Standard Provider',
      providerType: 'openai-compatible' as const,
      baseUrl: 'https://foropencode.com/v1',
      apiKey: 'key-a',
      authType: 'bearer' as const,
    };
    const model: ModelConfig = {
      id: 'qwen-image-2.0',
      label: 'Qwen Image 2.0',
      type: 'image',
      vendor: ModelVendor.QWEN,
    };
    const bindings = inferBindingsForProviderModel(profile, model);
    const plan = new InvocationPlanner(
      createRepositories({ profiles: [profile], bindings })
    ).plan({
      operation: 'image',
      modelRef: { profileId: profile.id, modelId: model.id },
    });

    expect(bindings.map((binding) => binding.protocol)).not.toContain(
      'openai.async.media'
    );
    expect(plan.binding).toMatchObject({
      protocol: 'openai.images.generations',
      submitPath: '/images/generations',
    });
  });

  it('routes mj-imagine through an explicitly discovered async endpoint', () => {
    const profile = {
      id: 'provider-async',
      name: 'Async Provider',
      providerType: 'openai-compatible' as const,
      baseUrl: 'https://foropencode.com/v1',
      apiKey: 'key-a',
      authType: 'bearer' as const,
    };
    const model: ModelConfig = {
      id: 'mj-imagine',
      label: 'Midjourney',
      type: 'image',
      vendor: ModelVendor.MIDJOURNEY,
      tags: ['mj'],
    };
    const bindings = inferBindingsForProviderModel(profile, model, {
      'openai-video': {
        path: '/v1/videos',
        method: 'POST',
        scenario: 'async-image',
      },
    });
    const plan = new InvocationPlanner(
      createRepositories({
        profiles: [profile],
        bindings,
      })
    ).plan({
      operation: 'image',
      modelRef: {
        profileId: profile.id,
        modelId: model.id,
      },
    });

    expect(bindings.map((binding) => binding.protocol)).toContain(
      'openai.async.media'
    );
    expect(plan.binding.protocol).toBe('openai.async.media');
    expect(plan.binding.requestSchema).toBe('openai.async.image.form');
    expect(plan.binding.submitPath).toBe('/videos');
  });

  it('infers multiple candidate bindings for multi-interface video models', () => {
    const bindings = inferBindingsForProviderModel(
      {
        id: 'provider-a',
        name: 'Provider A',
        providerType: 'openai-compatible',
        baseUrl: 'https://api-a.example.com/v1',
        apiKey: 'key-a',
        authType: 'bearer',
      },
      {
        id: 'seedance-1.5-pro',
        label: 'Seedance',
        type: 'video',
        vendor: ModelVendor.DOUBAO,
      }
    );

    expect(bindings.map((binding) => binding.protocol)).toEqual([
      'seedance.task',
      'openai.async.video',
    ]);
    expect(bindings.map((binding) => binding.requestSchema)).toEqual([
      'seedance.video.form-auto',
      'openai.video.form-input-reference',
    ]);
  });

  it('keeps pricing /v1/videos binding as video when scenario is not async-image', () => {
    const bindings = inferBindingsForProviderModel(
      {
        id: 'provider-a',
        name: 'Provider A',
        providerType: 'openai-compatible',
        baseUrl: 'https://api-a.example.com/v1',
        apiKey: 'key-a',
        authType: 'bearer',
      },
      {
        id: 'sora-2-pro',
        label: 'Sora',
        type: 'video',
        vendor: ModelVendor.GPT,
      },
      {
        'openai-video': {
          path: '/v1/videos',
          method: 'POST',
          scenario: 'video',
        },
      }
    );

    expect(bindings.map((binding) => binding.protocol)).toContain(
      'openai.async.video'
    );
    expect(bindings.map((binding) => binding.protocol)).not.toContain(
      'openai.async.media'
    );
  });

  it('infers HappyHorse video JSON bindings before generic video routing', () => {
    const bindings = inferBindingsForProviderModel(
      {
        id: 'provider-happyhorse',
        name: 'HappyHorse Provider',
        providerType: 'openai-compatible',
        baseUrl: 'https://vexrouter.com/v1',
        apiKey: 'key-a',
        authType: 'bearer',
      },
      {
        id: 'happyhorse-1.0-r2v',
        label: 'HappyHorse R2V',
        type: 'video',
        vendor: ModelVendor.OTHER,
      }
    );

    expect(bindings.map((binding) => binding.protocol)).toEqual([
      'happyhorse.video',
      'openai.async.video',
    ]);
    expect(bindings[0]?.requestSchema).toBe('happyhorse.video.json');
    expect(bindings[0]?.metadata?.video?.downloadPathTemplate).toBe(
      '/videos/{taskId}/content'
    );
  });

  it('infers trim-v1 transport for suno audio bindings', () => {
    const [binding] = inferBindingsForProviderModel(
      {
        id: 'provider-a',
        name: 'Provider A',
        providerType: 'openai-compatible',
        baseUrl: 'https://foropencode.com/v1',
        apiKey: 'key-a',
        authType: 'bearer',
      },
      {
        id: 'suno_music',
        label: 'Suno Music',
        type: 'audio',
        vendor: ModelVendor.SUNO,
        tags: ['suno', 'audio', 'music'],
      }
    );

    expect(binding?.protocol).toBe('for.suno.music');
    expect(binding?.submitPath).toBe('/suno/submit/music');
    expect(binding?.pollPathTemplate).toBe('/suno/fetch/{taskId}');
    expect(binding?.baseUrlStrategy).toBe('trim-v1');
    expect(binding?.metadata?.audio?.defaultAction).toBe('music');
    expect(binding?.metadata?.audio?.submitPathByAction).toEqual({
      music: '/suno/submit/music',
      lyrics: '/suno/submit/lyrics',
    });
    expect(binding?.metadata?.audio?.versionOptions).toEqual([
      'chirp-v5-5',
      'chirp-v5',
      'chirp-v4-5',
      'chirp-v4',
      'chirp-v3-0',
      'chirp-v3-5',
    ]);
    expect(binding?.metadata?.audio?.defaultVersion).toBe('chirp-v3-5');
  });

  it('infers Kling capability bindings with action-scoped version metadata', () => {
    const [binding] = inferBindingsForProviderModel(
      {
        id: 'provider-kling',
        name: 'Kling Provider',
        providerType: 'openai-compatible',
        baseUrl: 'https://foropencode.com/v1',
        apiKey: 'key-a',
        authType: 'bearer',
      },
      {
        id: 'kling_video',
        label: 'Kling',
        type: 'video',
        vendor: ModelVendor.KLING,
      }
    );

    expect(binding?.protocol).toBe('kling.video');
    expect(binding?.requestSchema).toBe('kling.video.auto-action-json');
    expect(binding?.submitPath).toBe('/kling/v1/videos/{action}');
    expect(binding?.pollPathTemplate).toBe(
      '/kling/v1/videos/{action}/{taskId}'
    );
    expect(binding?.metadata?.video?.versionField).toBe('model_name');
    expect(binding?.metadata?.video?.defaultVersion).toBe('kling-v1-6');
    expect(
      binding?.metadata?.video?.versionOptionsByAction?.text2video
    ).toEqual([
      'kling-v3',
      'kling-v2-6',
      'kling-v2-1',
      'kling-v1-6',
      'kling-v1-5',
    ]);
    expect(
      binding?.metadata?.video?.versionOptionsByAction?.image2video
    ).toEqual([
      'kling-v3',
      'kling-v2-6',
      'kling-v2-1',
      'kling-v1-6',
      'kling-v1-5',
    ]);
  });

  it('excludes Kling O1 models from standard kling.video routing', () => {
    const bindings = inferBindingsForProviderModel(
      {
        id: 'provider-kling',
        name: 'Kling Provider',
        providerType: 'openai-compatible',
        baseUrl: 'https://foropencode.com/v1',
        apiKey: 'key-a',
        authType: 'bearer',
      },
      {
        id: 'kling-video-o1',
        label: 'Kling Video O1',
        type: 'video',
        vendor: ModelVendor.KLING,
      }
    );

    expect(bindings.some((binding) => binding.protocol === 'kling.video')).toBe(
      false
    );
    expect(
      bindings.some((binding) => binding.protocol === 'openai.async.video')
    ).toBe(true);
  });

  it('marks gemini text bindings as image-capable for gemini-family models', () => {
    const [binding] = inferBindingsForProviderModel(
      {
        id: 'provider-gemini',
        name: 'Gemini Provider',
        providerType: 'gemini-compatible',
        baseUrl: 'https://api.example.com/v1',
        apiKey: 'key',
        authType: 'bearer',
      },
      {
        id: 'gemini-2.5-flash',
        label: 'Gemini 2.5 Flash',
        type: 'text',
        vendor: ModelVendor.GEMINI,
      }
    );

    expect(binding?.protocol).toBe('google.generateContent');
    expect(supportsTextBindingImageInput(binding)).toBe(true);
    expect(getTextBindingMaxImageCount(binding)).toBe(6);
  });

  it('routes for gemini text models through google generateContent', () => {
    const bindings = inferBindingsForProviderModel(
      {
        id: 'provider-for',
        name: 'For Provider',
        providerType: 'openai-compatible',
        baseUrl: 'https://foropencode.com/v1',
        apiKey: 'key',
        authType: 'bearer',
      },
      {
        id: 'gemini-3.1-pro-preview-thinking',
        label: 'Gemini 3.1 Pro Preview Thinking',
        type: 'text',
        vendor: ModelVendor.GOOGLE,
      }
    );

    expect(bindings[0]?.protocol).toBe('google.generateContent');
    expect(bindings[0]?.requestSchema).toBe(
      'google.generate-content.chat-basic'
    );
    expect(bindings[0]?.baseUrlStrategy).toBe('trim-v1');
    expect(
      bindings.some((binding) => binding.protocol === 'openai.chat.completions')
    ).toBe(true);
  });

  it('defaults openai chat bindings to image-capable input mode', () => {
    const [binding] = inferBindingsForProviderModel(
      {
        id: 'provider-openai',
        name: 'OpenAI Provider',
        providerType: 'openai-compatible',
        baseUrl: 'https://api.example.com/v1',
        apiKey: 'key',
        authType: 'bearer',
      },
      {
        id: 'deepseek-chat',
        label: 'DeepSeek Chat',
        type: 'text',
        vendor: ModelVendor.DEEPSEEK,
      }
    );

    expect(binding?.protocol).toBe('openai.chat.completions');
    expect(supportsTextBindingImageInput(binding)).toBe(true);
  });

  it('keeps auto-profile non-image models on existing gateway bindings', () => {
    const profile: ProviderProfileSnapshot = {
      id: 'provider-auto',
      name: 'Auto Provider',
      providerType: 'auto',
      baseUrl: 'https://gateway.example.com/v1',
      apiKey: 'key',
      authType: 'bearer',
    };
    const textBindings = inferBindingsForProviderModel(profile, {
      id: 'deepseek-chat',
      label: 'DeepSeek Chat',
      type: 'text',
      vendor: ModelVendor.DEEPSEEK,
    });
    const videoBindings = inferBindingsForProviderModel(profile, {
      id: 'qwen-video',
      label: 'Qwen Video',
      type: 'video',
      vendor: ModelVendor.QWEN,
    });
    const audioBindings = inferBindingsForProviderModel(profile, {
      id: 'suno-music',
      label: 'Suno Music',
      type: 'audio',
      vendor: ModelVendor.SUNO,
    });

    expect(textBindings[0]?.protocol).toBe('openai.chat.completions');
    expect(videoBindings[0]?.protocol).toBe('openai.async.video');
    expect(audioBindings[0]?.protocol).toBe('for.suno.music');
  });
});
