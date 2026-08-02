import 'fake-indexeddb/auto';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ModelVendor, type ModelConfig } from '../../constants/model-config';
import { TaskStatus, TaskType } from '../../types/task.types';
import type {
  ProviderCatalog,
  ProviderProfile,
} from '../../utils/settings-manager';
import {
  buildProviderCatalogDiscoverySignature,
  buildProviderCredentialIdentity,
  IMAGE_ROUTING_EVIDENCE_VERSION,
} from '../../utils/image-routing-evidence';
import type { ProviderPricingCache } from '../../utils/model-pricing-types';

const PROFILE: ProviderProfile = {
  id: 'default-task-contract-profile',
  name: 'default',
  providerType: 'auto',
  baseUrl: 'https://gateway.example.com/v1',
  apiKey: 'contract-key',
  authType: 'bearer',
  imageApiCompatibility: 'openai-gpt-image',
  extraHeaders: {
    'X-Contract': 'task-queue',
  },
  enabled: true,
  capabilities: {
    supportsModelsEndpoint: true,
    supportsText: true,
    supportsImage: true,
    supportsVideo: true,
    supportsAudio: true,
    supportsTools: true,
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

const OPAQUE_IMAGE_MODEL: ModelConfig = {
  id: 'opaque-image-model',
  label: 'Opaque Image Model',
  type: 'image',
  vendor: ModelVendor.OTHER,
};

const CATALOG: ProviderCatalog = {
  profileId: PROFILE.id,
  routingEvidenceVersion: IMAGE_ROUTING_EVIDENCE_VERSION,
  discoveredAt: 1,
  discoveredModels: [GPT_MODEL, GEMINI_MODEL],
  selectedModelIds: [GPT_MODEL.id, GEMINI_MODEL.id],
  sourceBaseUrl: PROFILE.baseUrl,
  signature: buildProviderCatalogDiscoverySignature(
    PROFILE.baseUrl,
    PROFILE.apiKey
  ),
};

const TINY_PNG_DATA_URL =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

type TaskContractCase = {
  name: string;
  model: ModelConfig;
  params: Record<string, unknown>;
  expected: {
    protocol: string;
    requestSchema: string;
    submitPath: string;
    url: string;
    bodyKind: 'json' | 'form' | 'google-json';
  };
};

const CASES: TaskContractCase[] = [
  {
    name: 'GPT generation',
    model: GPT_MODEL,
    params: {
      generationMode: 'text_to_image',
    },
    expected: {
      protocol: 'openai.images.generations',
      requestSchema: 'openai.image.gpt-generation-json',
      submitPath: '/images/generations',
      url: 'https://gateway.example.com/v1/images/generations',
      bodyKind: 'json',
    },
  },
  {
    name: 'GPT edit',
    model: GPT_MODEL,
    params: {
      uploadedImage: { url: TINY_PNG_DATA_URL },
    },
    expected: {
      protocol: 'openai.images.edits',
      requestSchema: 'openai.image.gpt-edit-form',
      submitPath: '/images/edits',
      url: 'https://gateway.example.com/v1/images/edits',
      bodyKind: 'form',
    },
  },
  {
    name: 'Gemini generation',
    model: GEMINI_MODEL,
    params: {
      generationMode: 'text_to_image',
    },
    expected: {
      protocol: 'google.generateContent',
      requestSchema: 'google.generate-content.image-inline',
      submitPath: '/v1beta/models/{model}:generateContent',
      url: `https://gateway.example.com/v1beta/models/${GEMINI_MODEL.id}:generateContent`,
      bodyKind: 'google-json',
    },
  },
];

async function waitForTerminalTask(
  getTask: () => { status: TaskStatus } | undefined
): Promise<void> {
  const deadline = Date.now() + 5000;
  while (Date.now() < deadline) {
    if (
      getTask()?.status === TaskStatus.COMPLETED ||
      getTask()?.status === TaskStatus.FAILED
    ) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  throw new Error('Timed out waiting for task-backed image contract');
}

describe('auto image routing contract: real task queue', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it.each(CASES)(
    '$name',
    async (contractCase) => {
      vi.resetModules();
      const providerFetch = vi.fn(
        async (input: RequestInfo | URL, init?: RequestInit) => {
          const url = String(input);
          if (url.startsWith('https://cdn.example.com/')) {
            expect(init).toMatchObject({
              credentials: 'omit',
              cache: 'no-store',
              referrerPolicy: 'no-referrer',
            });
            return new Response(new Uint8Array([137, 80, 78, 71]), {
              status: 200,
              headers: { 'Content-Type': 'image/png' },
            });
          }

          expect(url).toBe(contractCase.expected.url);
          expect(init?.method).toBe('POST');
          expect(init?.headers).toMatchObject({
            Authorization: `Bearer ${PROFILE.apiKey}`,
            'X-Contract': 'task-queue',
          });

          if (contractCase.expected.bodyKind === 'form') {
            expect(init?.body).toBeInstanceOf(FormData);
            const formData = init?.body as FormData;
            expect(formData.get('model')).toBe(GPT_MODEL.id);
            expect(formData.getAll('image[]')).toHaveLength(1);
          } else {
            const body = JSON.parse(String(init?.body)) as Record<
              string,
              unknown
            >;
            if (contractCase.expected.bodyKind === 'google-json') {
              expect(body).toHaveProperty('contents');
              expect(body).not.toHaveProperty('model');
              expect(body).not.toHaveProperty('prompt');
            } else {
              expect(body).toMatchObject({
                model: GPT_MODEL.id,
                prompt: expect.any(String),
              });
            }
          }

          if (contractCase.expected.bodyKind === 'google-json') {
            return new Response(
              JSON.stringify({
                candidates: [
                  {
                    content: {
                      parts: [
                        {
                          fileData: {
                            fileUri:
                              'https://cdn.example.com/gemini-generation.png',
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
            JSON.stringify({
              data: [
                {
                  url:
                    contractCase.expected.bodyKind === 'form'
                      ? 'https://cdn.example.com/gpt-edit.png'
                      : 'https://cdn.example.com/gpt-generation.png',
                },
              ],
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } }
          );
        }
      );
      vi.stubGlobal('fetch', providerFetch);

      const {
        providerCatalogsSettings,
        providerProfilesSettings,
        settingsManager,
      } = await import('../../utils/settings-manager');
      await settingsManager.waitForInitialization();
      await providerProfilesSettings.update([PROFILE]);
      await providerCatalogsSettings.update([CATALOG]);

      const { resolveInvocationPlanFromRoute } = await import(
        '../provider-routing'
      );
      const modelRef = {
        profileId: PROFILE.id,
        modelId: contractCase.model.id,
      };
      const directPlan = resolveInvocationPlanFromRoute('image', modelRef, {
        preferredRequestSchema:
          contractCase.expected.bodyKind === 'form'
            ? ['openai.image.gpt-edit-form']
            : undefined,
      });
      expect(directPlan).not.toBeNull();

      const { taskQueueService } = await import('../task-queue-service');
      const task = taskQueueService.createTask(
        {
          prompt: `task-backed ${contractCase.name}`,
          model: contractCase.model.id,
          modelRef,
          size: '1:1',
          ...contractCase.params,
        },
        TaskType.IMAGE
      );

      await waitForTerminalTask(() => taskQueueService.getTask(task.id));
      const completedTask = taskQueueService.getTask(task.id);

      expect(completedTask?.status).toBe(TaskStatus.COMPLETED);
      expect(completedTask?.invocationRoute).toMatchObject({
        providerProfileId: PROFILE.id,
        providerType: 'auto',
        providerBaseUrl: PROFILE.baseUrl,
        modelId: contractCase.model.id,
        binding: {
          id: directPlan?.binding.id,
          protocol: contractCase.expected.protocol,
          requestSchema: contractCase.expected.requestSchema,
          submitPath: contractCase.expected.submitPath,
          submitMethod: 'POST',
        },
      });
      expect(completedTask?.params.modelRef).toEqual({
        profileId: PROFILE.id,
        modelId: contractCase.model.id,
      });
      expect(JSON.stringify(completedTask?.invocationRoute)).not.toContain(
        PROFILE.apiKey
      );
      expect(JSON.stringify(completedTask?.invocationRoute)).not.toContain(
        'X-Contract'
      );
      const providerRequests = providerFetch.mock.calls.filter(
        ([input]) => String(input) === contractCase.expected.url
      );
      const cacheRequests = providerFetch.mock.calls.filter(([input]) =>
        String(input).startsWith('https://cdn.example.com/')
      );
      expect(providerRequests).toHaveLength(1);
      expect(cacheRequests).toHaveLength(1);
    },
    15000
  );

  it('rejects previous-credential image evidence before task creation or transport', async () => {
    vi.resetModules();
    const providerFetch = vi.fn();
    vi.stubGlobal('fetch', providerFetch);

    const {
      providerCatalogsSettings,
      providerPricingCacheSettings,
      providerProfilesSettings,
      settingsManager,
    } = await import('../../utils/settings-manager');
    await settingsManager.waitForInitialization();
    await providerProfilesSettings.update([PROFILE]);
    await providerCatalogsSettings.update([
      {
        profileId: PROFILE.id,
        routingEvidenceVersion: IMAGE_ROUTING_EVIDENCE_VERSION,
        discoveredAt: Date.now(),
        discoveredModels: [OPAQUE_IMAGE_MODEL],
        selectedModelIds: [OPAQUE_IMAGE_MODEL.id],
        sourceBaseUrl: PROFILE.baseUrl,
        signature: buildProviderCatalogDiscoverySignature(
          PROFILE.baseUrl,
          'previous-contract-key'
        ),
      },
    ]);

    const stalePricingCache: ProviderPricingCache = {
      profileId: PROFILE.id,
      routingEvidenceVersion: IMAGE_ROUTING_EVIDENCE_VERSION,
      fetchedAt: Date.now(),
      sourceSignature:
        `https://gateway.example.com/api/pricing\ndefault\n1\ncredential:${buildProviderCredentialIdentity(
          PROFILE.apiKey
        )}`,
      groups: [],
      prices: {},
      modelEndpoints: {
        [OPAQUE_IMAGE_MODEL.id]: {
          image: {
            path: '/stale/images/generations',
            method: 'POST',
          },
        },
      },
    };
    await providerPricingCacheSettings.update([stalePricingCache]);

    const { taskQueueService } = await import('../task-queue-service');
    const modelRef = {
      profileId: PROFILE.id,
      modelId: OPAQUE_IMAGE_MODEL.id,
    };

    expect(() =>
      taskQueueService.createTask(
        {
          prompt: 'must fail before provider transport',
          model: OPAQUE_IMAGE_MODEL.id,
          modelRef,
          size: '1:1',
          generationMode: 'text_to_image',
        },
        TaskType.IMAGE
      )
    ).toThrowError(
      expect.objectContaining({
        name: 'ImageInvocationError',
        code: 'IMAGE_BINDING_UNAVAILABLE',
        stage: 'planning',
      })
    );
    expect(providerFetch).not.toHaveBeenCalled();
  });
});
