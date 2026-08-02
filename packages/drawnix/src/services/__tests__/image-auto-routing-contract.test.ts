import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ModelVendor, type ModelConfig } from '../../constants/model-config';
import { geminiImageAdapter } from '../model-adapters/default-adapters';
import { gptImageAdapter } from '../model-adapters/gpt-image-adapter';
import {
  clearModelAdapters,
  registerModelAdapter,
  resolveAdapterForBinding,
} from '../model-adapters/registry';
import type { ImageGenerationRequest } from '../model-adapters/types';
import {
  inferBindingsForProviderModel,
  InvocationPlanner,
  type InvocationPlan,
  type InvocationPlanRequest,
  type InvocationPlannerRepositories,
  type ProviderModelBinding,
  type ProviderProfileSnapshot,
} from '../provider-routing';

const PROFILE: ProviderProfileSnapshot = {
  id: 'default-contract-profile',
  name: 'default',
  providerType: 'auto',
  baseUrl: 'https://gateway.example.com/v1',
  apiKey: 'contract-key',
  authType: 'bearer',
  imageApiCompatibility: 'openai-gpt-image',
  extraHeaders: {
    'X-Contract': 'auto-routing',
  },
};

const GPT_MODEL: ModelConfig = {
  id: 'gpt-image-2',
  label: 'GPT Image 2',
  type: 'image',
  vendor: ModelVendor.GPT,
};

const GEMINI_MODEL: ModelConfig = {
  id: 'gemini-3-pro-image-preview',
  label: 'Gemini Image',
  type: 'image',
  vendor: ModelVendor.GEMINI,
};

const TINY_PNG_DATA_URL =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

const bindings = [
  ...inferBindingsForProviderModel(PROFILE, GPT_MODEL),
  ...inferBindingsForProviderModel(PROFILE, GEMINI_MODEL),
];

const repositories: InvocationPlannerRepositories = {
  getProviderProfile(profileId) {
    return profileId === PROFILE.id ? PROFILE : null;
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

const planner = new InvocationPlanner(repositories);

type ContractCase = {
  name: string;
  planRequest: InvocationPlanRequest;
  expected: Pick<
    ProviderModelBinding,
    'protocol' | 'requestSchema' | 'submitPath'
  > & {
    adapterId: string;
    url: string;
    bodyKind: 'json' | 'form' | 'google-json';
  };
  imageRequest: ImageGenerationRequest;
};

const contractCases: ContractCase[] = [
  {
    name: 'GPT generation',
    planRequest: {
      operation: 'image',
      modelRef: { profileId: PROFILE.id, modelId: GPT_MODEL.id },
      preferredRequestSchema: 'openai.image.gpt-generation-json',
    },
    expected: {
      protocol: 'openai.images.generations',
      requestSchema: 'openai.image.gpt-generation-json',
      submitPath: '/images/generations',
      adapterId: 'gpt-image-adapter',
      url: 'https://gateway.example.com/v1/images/generations',
      bodyKind: 'json',
    },
    imageRequest: {
      model: GPT_MODEL.id,
      modelRef: { profileId: PROFILE.id, modelId: GPT_MODEL.id },
      prompt: 'contract GPT generation',
      operationIntent: 'generation',
      size: '1x1',
      generationMode: 'text_to_image',
    },
  },
  {
    name: 'GPT edit',
    planRequest: {
      operation: 'image',
      modelRef: { profileId: PROFILE.id, modelId: GPT_MODEL.id },
      preferredRequestSchema: 'openai.image.gpt-edit-form',
    },
    expected: {
      protocol: 'openai.images.edits',
      requestSchema: 'openai.image.gpt-edit-form',
      submitPath: '/images/edits',
      adapterId: 'gpt-image-adapter',
      url: 'https://gateway.example.com/v1/images/edits',
      bodyKind: 'form',
    },
    imageRequest: {
      model: GPT_MODEL.id,
      modelRef: { profileId: PROFILE.id, modelId: GPT_MODEL.id },
      prompt: 'contract GPT edit',
      operationIntent: 'edit',
      size: '1x1',
      generationMode: 'image_edit',
      referenceImages: [TINY_PNG_DATA_URL],
    },
  },
  {
    name: 'Gemini generation',
    planRequest: {
      operation: 'image',
      modelRef: { profileId: PROFILE.id, modelId: GEMINI_MODEL.id },
    },
    expected: {
      protocol: 'google.generateContent',
      requestSchema: 'google.generate-content.image-inline',
      submitPath: '/v1beta/models/{model}:generateContent',
      adapterId: 'gemini-image-adapter',
      url: `https://gateway.example.com/v1beta/models/${GEMINI_MODEL.id}:generateContent`,
      bodyKind: 'google-json',
    },
    imageRequest: {
      model: GEMINI_MODEL.id,
      modelRef: { profileId: PROFILE.id, modelId: GEMINI_MODEL.id },
      prompt: 'contract Gemini generation',
      operationIntent: 'generation',
      size: '1:1',
      generationMode: 'text_to_image',
    },
  },
];

function createSuccessfulFetcher(contractCase: ContractCase): typeof fetch {
  return vi.fn(async () => {
    if (contractCase.expected.bodyKind === 'google-json') {
      return new Response(
        JSON.stringify({
          candidates: [
            {
              content: {
                parts: [
                  {
                    inlineData: {
                      mimeType: 'image/png',
                      data: TINY_PNG_DATA_URL.split(',')[1],
                    },
                  },
                ],
              },
            },
          ],
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ data: [{ url: 'https://example.com/result.png' }] }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  }) as typeof fetch;
}

function replanFromTaskBindingSnapshot(
  initialPlan: InvocationPlan,
  request: InvocationPlanRequest
): InvocationPlan {
  const invocationRouteSnapshot = {
    modelRef: initialPlan.modelRef,
    binding: { id: initialPlan.binding.id },
  };
  const resumedPlan = planner.plan({
    operation: request.operation,
    modelRef: invocationRouteSnapshot.modelRef,
    bindingId: invocationRouteSnapshot.binding.id,
    preferredRequestSchema: request.preferredRequestSchema,
  });

  expect(resumedPlan.modelRef).toEqual(initialPlan.modelRef);
  expect(resumedPlan.binding).toEqual(initialPlan.binding);
  return resumedPlan;
}

function assertRequestBody(
  contractCase: ContractCase,
  body: BodyInit | null | undefined
): void {
  if (contractCase.expected.bodyKind === 'form') {
    expect(body).toBeInstanceOf(FormData);
    const formData = body as FormData;
    expect(formData.get('model')).toBe(GPT_MODEL.id);
    expect(formData.get('prompt')).toBe(contractCase.imageRequest.prompt);
    expect(formData.getAll('image[]')).toHaveLength(1);
    return;
  }

  expect(typeof body).toBe('string');
  const json = JSON.parse(String(body)) as Record<string, unknown>;
  if (contractCase.expected.bodyKind === 'google-json') {
    expect(json).toMatchObject({
      contents: [
        {
          role: 'user',
          parts: [{ text: contractCase.imageRequest.prompt }],
        },
      ],
      generationConfig: {
        responseModalities: ['IMAGE'],
        imageConfig: { aspectRatio: '1:1' },
      },
    });
    expect(json).not.toHaveProperty('model');
    expect(json).not.toHaveProperty('prompt');
    return;
  }

  expect(json).toMatchObject({
    model: GPT_MODEL.id,
    prompt: contractCase.imageRequest.prompt,
    size: '1024x1024',
  });
}

describe.each(['direct', 'binding-snapshot'] as const)(
  'auto image routing contract: %s',
  (executionPath) => {
    beforeEach(() => {
      clearModelAdapters();
      registerModelAdapter(gptImageAdapter);
      registerModelAdapter(geminiImageAdapter);
    });

    afterEach(() => {
      vi.unstubAllGlobals();
      clearModelAdapters();
    });

    it.each(contractCases)('$name', async (contractCase) => {
      const initialPlan = planner.plan(contractCase.planRequest);
      const plan =
        executionPath === 'binding-snapshot'
          ? replanFromTaskBindingSnapshot(initialPlan, contractCase.planRequest)
          : initialPlan;

      expect(plan.modelRef).toEqual(contractCase.planRequest.modelRef);
      expect(plan.provider).toMatchObject({
        profileId: PROFILE.id,
        providerType: 'auto',
      });
      expect(plan.binding).toMatchObject({
        profileId: PROFILE.id,
        modelId: contractCase.planRequest.modelRef?.modelId,
        operation: 'image',
        protocol: contractCase.expected.protocol,
        requestSchema: contractCase.expected.requestSchema,
        submitPath: contractCase.expected.submitPath,
      });

      const adapter = resolveAdapterForBinding(plan.binding, 'image');
      expect(adapter?.id).toBe(contractCase.expected.adapterId);
      if (!adapter || adapter.kind !== 'image') {
        throw new Error(`No image adapter for binding ${plan.binding.id}`);
      }

      const fetcher = createSuccessfulFetcher(contractCase);
      vi.stubGlobal('fetch', fetcher);
      await adapter.generateImage(
        {
          baseUrl: plan.provider.baseUrl,
          apiKey: plan.provider.apiKey,
          authType: plan.provider.authType,
          extraHeaders: plan.provider.extraHeaders,
          provider: plan.provider,
          binding: plan.binding,
          fetcher,
        },
        contractCase.imageRequest
      );

      expect(fetcher).toHaveBeenCalledTimes(1);
      const [url, init] = vi.mocked(fetcher).mock.calls[0];
      expect(String(url)).toBe(contractCase.expected.url);
      expect(init?.headers).toMatchObject({
        Authorization: `Bearer ${PROFILE.apiKey}`,
        'X-Contract': 'auto-routing',
      });
      assertRequestBody(contractCase, init?.body);
    });
  }
);
