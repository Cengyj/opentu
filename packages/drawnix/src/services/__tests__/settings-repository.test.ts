import { beforeEach, describe, expect, it, vi } from 'vitest';

describe('settings-repository', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('uses the saved legacy provider type and auth type in snapshots', async () => {
    vi.doMock('../../utils/settings-manager', () => ({
      DEFAULT_PROVIDER_IMAGE_API_COMPATIBILITY: 'openai-gpt-image',
      LEGACY_DEFAULT_PROVIDER_PROFILE_ID: 'legacy-default',
      FOR_DEFAULT_PROVIDER_NAME: 'default 分组',
      FOR_PROVIDER_DEFAULT_BASE_URL: 'https://foropencode.com/v1',
      createModelRef: (profileId?: string | null, modelId?: string | null) => ({
        profileId: profileId ?? null,
        modelId: modelId ?? null,
      }),
      geminiSettings: {
        get: () => ({
          apiKey: 'legacy-key',
          baseUrl: 'https://foropencode.com/v1',
          textModelName: 'text-model',
          imageModelName: 'image-model',
          videoModelName: 'video-model',
        }),
      },
      providerProfilesSettings: {
        get: () => [
          {
            id: 'legacy-default',
            name: 'default 分组',
            providerType: 'custom',
            baseUrl: 'https://foropencode.com/v1',
            apiKey: 'legacy-key',
            authType: 'query',
            enabled: true,
            capabilities: {
              supportsModelsEndpoint: true,
              supportsText: true,
              supportsImage: true,
              supportsVideo: true,
              supportsTools: true,
            },
          },
        ],
      },
      providerCatalogsSettings: {
        get: () => [],
      },
      providerPricingCacheSettings: {
        get: () => [],
      },
      resolveInvocationRoute: () => {
        throw new Error('resolveInvocationRoute should not be called');
      },
    }));

    const { listSettingsProviderProfiles } = await import(
      '../provider-routing/settings-repository'
    );

    const profiles = listSettingsProviderProfiles();

    expect(profiles[0]).toMatchObject({
      id: 'legacy-default',
      name: 'default 分组',
      providerType: 'custom',
      authType: 'query',
      imageApiCompatibility: 'openai-gpt-image',
    });
  });

  it('preserves saved generic image compatibility overrides in snapshots', async () => {
    vi.doMock('../../utils/settings-manager', () => ({
      DEFAULT_PROVIDER_IMAGE_API_COMPATIBILITY: 'openai-gpt-image',
      LEGACY_DEFAULT_PROVIDER_PROFILE_ID: 'legacy-default',
      FOR_DEFAULT_PROVIDER_NAME: 'default 分组',
      FOR_PROVIDER_DEFAULT_BASE_URL: 'https://foropencode.com/v1',
      createModelRef: (profileId?: string | null, modelId?: string | null) => ({
        profileId: profileId ?? null,
        modelId: modelId ?? null,
      }),
      geminiSettings: {
        get: () => ({
          apiKey: 'legacy-key',
          baseUrl: 'https://foropencode.com/v1',
          textModelName: 'text-model',
          imageModelName: 'image-model',
          videoModelName: 'video-model',
        }),
      },
      providerProfilesSettings: {
        get: () => [
          {
            id: 'legacy-default',
            name: 'default 分组',
            providerType: 'custom',
            baseUrl: 'https://foropencode.com/v1',
            apiKey: 'legacy-key',
            authType: 'query',
            imageApiCompatibility: 'openai-compatible-basic',
            enabled: true,
            capabilities: {
              supportsModelsEndpoint: true,
              supportsText: true,
              supportsImage: true,
              supportsVideo: true,
              supportsTools: true,
            },
          },
        ],
      },
      providerCatalogsSettings: {
        get: () => [],
      },
      providerPricingCacheSettings: {
        get: () => [],
      },
      resolveInvocationRoute: () => {
        throw new Error('resolveInvocationRoute should not be called');
      },
    }));

    const { listSettingsProviderProfiles } = await import(
      '../provider-routing/settings-repository'
    );

    const profiles = listSettingsProviderProfiles();

    expect(profiles[0]).toMatchObject({
      imageApiCompatibility: 'openai-compatible-basic',
    });
  });

  it('preserves auto and legacy extra headers in provider snapshots', async () => {
    vi.doMock('../../utils/settings-manager', () => ({
      DEFAULT_PROVIDER_IMAGE_API_COMPATIBILITY: 'openai-gpt-image',
      LEGACY_DEFAULT_PROVIDER_PROFILE_ID: 'legacy-default',
      FOR_DEFAULT_PROVIDER_NAME: 'default 分组',
      FOR_PROVIDER_DEFAULT_BASE_URL: 'https://foropencode.com/v1',
      createModelRef: (profileId?: string | null, modelId?: string | null) => ({
        profileId: profileId ?? null,
        modelId: modelId ?? null,
      }),
      geminiSettings: {
        get: () => ({
          apiKey: 'legacy-key',
          baseUrl: 'https://foropencode.com/v1',
          imageModelName: 'gpt-image-2',
        }),
      },
      providerProfilesSettings: {
        get: () => [
          {
            id: 'legacy-default',
            name: 'default 分组',
            providerType: 'auto',
            baseUrl: 'https://foropencode.com/v1',
            apiKey: 'legacy-key',
            authType: 'query',
            imageApiCompatibility: 'openai-gpt-image',
            extraHeaders: { 'X-Tenant': 'tenant-a' },
            enabled: true,
          },
        ],
      },
      providerCatalogsSettings: { get: () => [] },
      providerPricingCacheSettings: { get: () => [] },
      resolveInvocationRoute: () => {
        throw new Error('resolveInvocationRoute should not be called');
      },
    }));

    const { listSettingsProviderProfiles } = await import(
      '../provider-routing/settings-repository'
    );

    expect(listSettingsProviderProfiles()[0]).toMatchObject({
      id: 'legacy-default',
      providerType: 'auto',
      authType: 'query',
      extraHeaders: { 'X-Tenant': 'tenant-a' },
    });
  });

  it('rethrows planning errors for auto profiles but keeps manual resolution nullable', async () => {
    let providerType: 'auto' | 'openai-compatible' = 'auto';
    vi.doMock('../../utils/settings-manager', () => ({
      DEFAULT_PROVIDER_IMAGE_API_COMPATIBILITY: 'openai-gpt-image',
      LEGACY_DEFAULT_PROVIDER_PROFILE_ID: 'legacy-default',
      FOR_DEFAULT_PROVIDER_NAME: 'default 分组',
      FOR_PROVIDER_DEFAULT_BASE_URL: 'https://foropencode.com/v1',
      createModelRef: (profileId?: string | null, modelId?: string | null) =>
        profileId && modelId ? { profileId, modelId } : null,
      geminiSettings: {
        get: () => ({
          apiKey: 'legacy-key',
          baseUrl: 'https://foropencode.com/v1',
          imageModelName: 'known-image-model',
        }),
      },
      providerProfilesSettings: {
        get: () => [
          {
            id: 'legacy-default',
            name: 'default 分组',
            providerType,
            baseUrl: 'https://foropencode.com/v1',
            apiKey: 'legacy-key',
            authType: 'bearer',
            preferAsyncImageEndpoint: true,
            enabled: true,
          },
        ],
      },
      providerCatalogsSettings: { get: () => [] },
      providerPricingCacheSettings: { get: () => [] },
      resolveInvocationRoute: () => ({
        profileId: 'legacy-default',
        modelId: 'unknown-image-model',
        providerType,
      }),
    }));

    const { resolveInvocationPlanFromRoute } = await import(
      '../provider-routing/settings-repository'
    );

    expect(() =>
      resolveInvocationPlanFromRoute('image', {
        profileId: 'legacy-default',
        modelId: 'unknown-image-model',
      })
    ).toThrow(/No protocol binding/);

    providerType = 'openai-compatible';
    expect(
      resolveInvocationPlanFromRoute('video', {
        profileId: 'legacy-default',
        modelId: 'unknown-image-model',
      })
    ).toBeNull();
  });

  it('does not reconstruct a retired profile-preference binding identity', async () => {
    vi.doMock('../../utils/settings-manager', () => ({
      DEFAULT_PROVIDER_IMAGE_API_COMPATIBILITY: 'openai-gpt-image',
      LEGACY_DEFAULT_PROVIDER_PROFILE_ID: 'legacy-default',
      FOR_DEFAULT_PROVIDER_NAME: 'default 分组',
      FOR_PROVIDER_DEFAULT_BASE_URL: 'https://foropencode.com/v1',
      createModelRef: (profileId?: string | null, modelId?: string | null) =>
        profileId && modelId ? { profileId, modelId } : null,
      geminiSettings: {
        get: () => ({
          apiKey: 'legacy-key',
          baseUrl: 'https://foropencode.com/v1',
          imageModelName: 'qwen-image-2.0',
        }),
      },
      providerProfilesSettings: {
        get: () => [
          {
            id: 'legacy-default',
            name: 'default 分组',
            providerType: 'openai-compatible',
            baseUrl: 'https://foropencode.com/v1',
            apiKey: 'legacy-key',
            authType: 'bearer',
            enabled: true,
          },
        ],
      },
      providerCatalogsSettings: { get: () => [] },
      providerPricingCacheSettings: { get: () => [] },
      resolveInvocationRoute: () => ({
        profileId: 'legacy-default',
        profileName: 'default 分组',
        providerType: 'openai-compatible',
        modelId: 'qwen-image-2.0',
        baseUrl: 'https://foropencode.com/v1',
        apiKey: 'legacy-key',
      }),
    }));

    const { resolveInvocationPlanFromRoute } = await import(
      '../provider-routing/settings-repository'
    );
    const modelRef = {
      profileId: 'legacy-default',
      modelId: 'qwen-image-2.0',
    };
    const persistedBindingId = [
      modelRef.profileId,
      modelRef.modelId,
      'image',
      'openai.async.media',
      'openai.async.image.form',
      'preserve',
    ].join(':');

    expect(
      resolveInvocationPlanFromRoute('image', modelRef)?.binding
    ).toMatchObject({
      protocol: 'openai.images.generations',
      submitPath: '/images/generations',
    });
    expect(
      resolveInvocationPlanFromRoute('image', modelRef, {
        bindingId: persistedBindingId,
      })
    ).toBeNull();
    expect(
      resolveInvocationPlanFromRoute('image', modelRef, {
        bindingId: `${persistedBindingId}:wrong`,
      })
    ).toBeNull();
  });

  it('builds one settings/binding snapshot and preserves text, video, and audio plans', async () => {
    const getProfiles = vi.fn(() => [
      {
        id: 'provider-a',
        name: 'Provider A',
        providerType: 'custom' as const,
        baseUrl: 'https://provider.example/v1',
        apiKey: 'secret',
        authType: 'header' as const,
        enabled: true,
        capabilities: {
          supportsModelsEndpoint: true,
          supportsText: true,
          supportsImage: true,
          supportsVideo: true,
          supportsAudio: true,
          supportsTools: true,
        },
      },
    ]);
    const getCatalogs = vi.fn(() => [
      {
        profileId: 'provider-a',
        discoveredAt: null,
        discoveredModels: [],
        selectedModelIds: [],
      },
    ]);
    const getLegacySettings = vi.fn(() => ({
      apiKey: 'legacy-key',
      baseUrl: 'https://legacy.example/v1',
    }));
    const getPricingCache = vi.fn(() => null);
    vi.doMock('../../utils/settings-manager', () => ({
      DEFAULT_PROVIDER_IMAGE_API_COMPATIBILITY: 'openai-gpt-image',
      LEGACY_DEFAULT_PROVIDER_PROFILE_ID: 'legacy-default',
      FOR_DEFAULT_PROVIDER_NAME: 'default 分组',
      FOR_PROVIDER_DEFAULT_BASE_URL: 'https://foropencode.com/v1',
      createModelRef: (profileId?: string | null, modelId?: string | null) =>
        profileId && modelId ? { profileId, modelId } : null,
      geminiSettings: { get: getLegacySettings },
      providerProfilesSettings: { get: getProfiles },
      providerCatalogsSettings: { get: getCatalogs },
      resolveInvocationRoute: () => {
        throw new Error('resolveInvocationRoute should not be called');
      },
    }));
    vi.doMock('../../utils/model-pricing-service', () => ({
      modelPricingService: { getCache: getPricingCache },
    }));

    const {
      createSettingsInvocationPlannerRepositories,
    } = await import('../provider-routing/settings-repository');
    const { InvocationPlanner } = await import(
      '../provider-routing/invocation-planner'
    );
    const createBinding = (
      operation: 'text' | 'video' | 'audio',
      modelId: string
    ) => ({
      id: `provider-a:${modelId}:${operation}`,
      profileId: 'provider-a',
      modelId,
      operation,
      protocol: `test.${operation}`,
      requestSchema: `test.${operation}.request`,
      responseSchema: `test.${operation}.response`,
      submitPath: `/${operation}`,
      priority: 100,
      confidence: 'high' as const,
      source: 'manual' as const,
    });
    const repositories = createSettingsInvocationPlannerRepositories({
      includeLegacyProfile: false,
      manualBindings: [
        createBinding('text', 'text-model'),
        createBinding('video', 'video-model'),
        createBinding('audio', 'audio-model'),
      ],
    });
    const planner = new InvocationPlanner(repositories);

    const textPlan = planner.plan({
      operation: 'text',
      modelRef: { profileId: 'provider-a', modelId: 'text-model' },
    });
    const videoPlan = planner.plan({
      operation: 'video',
      modelRef: { profileId: 'provider-a', modelId: 'video-model' },
    });
    const audioPlan = planner.plan({
      operation: 'audio',
      modelRef: { profileId: 'provider-a', modelId: 'audio-model' },
    });

    expect(textPlan.binding.protocol).toBe('test.text');
    expect(videoPlan.binding.protocol).toBe('test.video');
    expect(audioPlan.binding.protocol).toBe('test.audio');
    expect(textPlan.provider).toMatchObject({
      providerType: 'custom',
      authType: 'header',
    });
    expect(getProfiles).toHaveBeenCalledTimes(1);
    expect(getCatalogs).toHaveBeenCalledTimes(1);
    expect(getPricingCache).toHaveBeenCalledTimes(1);
    expect(getLegacySettings).not.toHaveBeenCalled();
  });

  it('does not let legacy catalog or endpoint caches create an auto image binding', async () => {
    const {
      buildProviderCatalogDiscoverySignature,
      IMAGE_ROUTING_EVIDENCE_VERSION,
    } = await import('../../utils/image-routing-evidence');
    const getFreshRoutingModelEndpoints = vi.fn(() => null);
    vi.doMock('../../utils/settings-manager', () => ({
      DEFAULT_PROVIDER_IMAGE_API_COMPATIBILITY: 'openai-gpt-image',
      LEGACY_DEFAULT_PROVIDER_PROFILE_ID: 'legacy-default',
      FOR_DEFAULT_PROVIDER_NAME: 'default 分组',
      FOR_PROVIDER_DEFAULT_BASE_URL: 'https://foropencode.com/v1',
      geminiSettings: { get: () => ({}) },
      providerProfilesSettings: {
        get: () => [
          {
            id: 'auto-provider',
            name: 'Auto Provider',
            providerType: 'auto',
            baseUrl: 'https://provider.example.com/v1',
            apiKey: 'provider-key',
            authType: 'bearer',
            enabled: true,
          },
        ],
      },
      providerCatalogsSettings: {
        get: () => [
          {
            profileId: 'auto-provider',
            routingEvidenceVersion: IMAGE_ROUTING_EVIDENCE_VERSION,
            discoveredAt: Date.now(),
            sourceBaseUrl: 'https://provider.example.com/v1',
            signature: buildProviderCatalogDiscoverySignature(
              'https://provider.example.com/v1',
              'previous-provider-key'
            ),
            discoveredModels: [
              {
                id: 'opaque-renderer-v2',
                label: 'Opaque Renderer',
                type: 'image',
                vendor: 'OTHER',
              },
              {
                id: 'legacy-text-model',
                label: 'Legacy Text Model',
                type: 'text',
                vendor: 'OTHER',
              },
            ],
            selectedModelIds: ['opaque-renderer-v2', 'legacy-text-model'],
          },
        ],
      },
    }));
    vi.doMock('../../utils/model-pricing-service', () => ({
      modelPricingService: {
        getCache: () => ({
          modelEndpoints: {
            'opaque-renderer-v2': {
              image: {
                path: '/stale/images/generations',
                method: 'POST',
              },
            },
            'legacy-text-model': {
              generateContent: {
                path: '/stale/models/legacy-text-model:generateContent',
                method: 'POST',
              },
            },
          },
        }),
        getFreshRoutingModelEndpoints,
      },
    }));

    const { listSettingsModelBindings } = await import(
      '../provider-routing/settings-repository'
    );

    const bindings = listSettingsModelBindings({
      includeLegacyProfile: false,
    });
    expect(bindings.filter((binding) => binding.operation === 'image')).toEqual(
      []
    );
    expect(
      bindings.some(
        (binding) =>
          binding.operation === 'text' &&
          binding.submitPath ===
            '/stale/models/legacy-text-model:generateContent'
      )
    ).toBe(true);
    expect(getFreshRoutingModelEndpoints).toHaveBeenCalledTimes(1);
  });

  it('uses current catalog and fresh source-matched endpoint evidence for auto images', async () => {
    const {
      buildProviderCatalogDiscoverySignature,
      IMAGE_ROUTING_EVIDENCE_VERSION,
    } = await import('../../utils/image-routing-evidence');
    const profile = {
      id: 'auto-provider',
      name: 'Auto Provider',
      providerType: 'auto' as const,
      baseUrl: 'https://provider.example.com/v1',
      apiKey: 'provider-key',
      authType: 'bearer' as const,
      enabled: true,
    };
    vi.doMock('../../utils/settings-manager', () => ({
      DEFAULT_PROVIDER_IMAGE_API_COMPATIBILITY: 'openai-gpt-image',
      LEGACY_DEFAULT_PROVIDER_PROFILE_ID: 'legacy-default',
      FOR_DEFAULT_PROVIDER_NAME: 'default 分组',
      FOR_PROVIDER_DEFAULT_BASE_URL: 'https://foropencode.com/v1',
      geminiSettings: { get: () => ({}) },
      providerProfilesSettings: { get: () => [profile] },
      providerCatalogsSettings: {
        get: () => [
          {
            profileId: profile.id,
            routingEvidenceVersion: IMAGE_ROUTING_EVIDENCE_VERSION,
            discoveredAt: Date.now(),
            sourceBaseUrl: profile.baseUrl,
            signature: buildProviderCatalogDiscoverySignature(
              profile.baseUrl,
              profile.apiKey
            ),
            discoveredModels: [
              {
                id: 'opaque-renderer-v2',
                label: 'Opaque Renderer',
                type: 'image',
                vendor: 'OTHER',
              },
            ],
            selectedModelIds: ['opaque-renderer-v2'],
          },
        ],
      },
    }));
    vi.doMock('../../utils/model-pricing-service', () => ({
      modelPricingService: {
        getCache: () => null,
        getFreshRoutingModelEndpoints: () => ({
          'opaque-renderer-v2': {
            image: {
              path: '/custom/images/generations',
              method: 'POST',
            },
          },
        }),
      },
    }));

    const { listSettingsModelBindings } = await import(
      '../provider-routing/settings-repository'
    );
    const imageBindings = listSettingsModelBindings({
      includeLegacyProfile: false,
    }).filter((binding) => binding.operation === 'image');

    expect(imageBindings).toHaveLength(1);
    expect(imageBindings[0]).toMatchObject({
      profileId: profile.id,
      modelId: 'opaque-renderer-v2',
      source: 'discovered',
      submitPath: '/custom/images/generations',
    });
  });

  it.each([
    {
      providerType: 'openai-compatible' as const,
      expectedProtocol: 'openai.images.generations',
    },
    {
      providerType: 'gemini-compatible' as const,
      expectedProtocol: 'google.generateContent',
    },
    {
      providerType: 'custom' as const,
      expectedProtocol: 'openai.images.generations',
    },
  ])(
    'keeps $providerType image inference unchanged for legacy caches',
    async ({ providerType, expectedProtocol }) => {
      const getCache = vi.fn(() => ({
        modelEndpoints: {
          'gemini-image-model': {
            image: {
              path: '/manual/images/generations',
              method: 'POST',
            },
          },
        },
      }));
      vi.doMock('../../utils/settings-manager', () => ({
        DEFAULT_PROVIDER_IMAGE_API_COMPATIBILITY: 'openai-gpt-image',
        LEGACY_DEFAULT_PROVIDER_PROFILE_ID: 'legacy-default',
        FOR_DEFAULT_PROVIDER_NAME: 'default 分组',
        FOR_PROVIDER_DEFAULT_BASE_URL: 'https://foropencode.com/v1',
        geminiSettings: { get: () => ({}) },
        providerProfilesSettings: {
          get: () => [
            {
              id: 'manual-provider',
              name: 'Manual Provider',
              providerType,
              baseUrl: 'https://provider.example.com/v1',
              apiKey: 'provider-key',
              authType: 'bearer',
              enabled: true,
            },
          ],
        },
        providerCatalogsSettings: {
          get: () => [
            {
              profileId: 'manual-provider',
              discoveredAt: Date.now(),
              discoveredModels: [
                {
                  id: 'gemini-image-model',
                  label: 'Gemini Image Model',
                  type: 'image',
                  vendor: 'GEMINI',
                },
              ],
              selectedModelIds: ['gemini-image-model'],
            },
          ],
        },
      }));
      const getFreshRoutingModelEndpoints = vi.fn(() => null);
      vi.doMock('../../utils/model-pricing-service', () => ({
        modelPricingService: {
          getCache,
          getFreshRoutingModelEndpoints,
        },
      }));

      const { listSettingsModelBindings } = await import(
        '../provider-routing/settings-repository'
      );
      const imageBindings = listSettingsModelBindings({
        includeLegacyProfile: false,
      }).filter((binding) => binding.operation === 'image');

      expect(
        imageBindings.some((binding) => binding.protocol === expectedProtocol)
      ).toBe(true);
      expect(getCache).toHaveBeenCalledTimes(1);
      expect(getFreshRoutingModelEndpoints).not.toHaveBeenCalled();
    }
  );
});
