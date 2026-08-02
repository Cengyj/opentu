import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DRAWNIX_SETTINGS_KEY } from '../../constants/storage';
import {
  buildProviderCatalogDiscoverySignature,
  buildProviderCredentialIdentity,
  IMAGE_ROUTING_EVIDENCE_VERSION,
} from '../image-routing-evidence';

function createStorageMock(): Storage {
  const store = new Map<string, string>();

  return {
    get length() {
      return store.size;
    },
    clear() {
      store.clear();
    },
    getItem(key: string) {
      return store.get(key) ?? null;
    },
    key(index: number) {
      return Array.from(store.keys())[index] ?? null;
    },
    removeItem(key: string) {
      store.delete(key);
    },
    setItem(key: string, value: string) {
      store.set(key, value);
    },
  } as Storage;
}

function mockSettingsManagerDeps() {
  vi.doMock('../crypto-utils', () => ({
    CryptoUtils: {
      testCrypto: async () => false,
      isEncrypted: () => false,
      decrypt: async (value: string) => value,
      encrypt: async (value: string) => value,
    },
  }));

  vi.doMock('../config-indexeddb-writer', () => ({
    configIndexedDBWriter: {
      saveConfig: async () => {},
    },
  }));
}

describe('settings-manager', () => {
  beforeEach(() => {
    vi.resetModules();

    if (typeof globalThis.localStorage?.clear !== 'function') {
      Object.defineProperty(globalThis, 'localStorage', {
        value: createStorageMock(),
        configurable: true,
      });
    }

    if (typeof window === 'undefined') {
      vi.stubGlobal('window', {
        location: {
          search: '',
          href: 'https://example.com/app',
        },
        history: {
          replaceState: () => {},
        },
        dispatchEvent: () => true,
      });
    } else {
      Object.assign(window, {
        location: {
          search: '',
          href: 'https://example.com/app',
        },
        history: {
          replaceState: () => {},
        },
        dispatchEvent: () => true,
      });
    }

    localStorage.clear();
  });

  it('初始化完成前的设置写入会等待加密能力而不会落盘原始凭据', async () => {
    let resolveCryptoAvailability: ((available: boolean) => void) | undefined;
    const cryptoAvailability = new Promise<boolean>((resolve) => {
      resolveCryptoAvailability = resolve;
    });
    const encrypt = vi.fn(async (value: string) => `encrypted:${value}`);
    vi.doMock('../crypto-utils', () => ({
      CryptoUtils: {
        testCrypto: () => cryptoAvailability,
        isEncrypted: () => false,
        decrypt: async (value: string) => value,
        encrypt,
      },
    }));
    vi.doMock('../config-indexeddb-writer', () => ({
      configIndexedDBWriter: {
        saveConfig: async () => {},
      },
    }));

    const { settingsManager } = await import('../settings-manager');
    const update = settingsManager.updateSetting(
      'gemini.apiKey',
      'early-secret-key'
    );
    queueMicrotask(() => resolveCryptoAvailability?.(true));

    await Promise.all([settingsManager.waitForInitialization(), update]);

    expect(encrypt).toHaveBeenCalledWith('early-secret-key');
    expect(
      JSON.parse(localStorage.getItem(DRAWNIX_SETTINGS_KEY) || '{}').gemini
        .apiKey
    ).toBe('encrypted:early-secret-key');
  });

  it('并发设置保存按调用顺序提交且旧加密快照不能覆盖新值', async () => {
    let releaseSlowEncryption: ((value: string) => void) | undefined;
    const slowEncryption = new Promise<string>((resolve) => {
      releaseSlowEncryption = resolve;
    });
    const encrypt = vi.fn((value: string) => {
      if (value === 'slow-key') {
        return slowEncryption;
      }
      return Promise.resolve(`encrypted:${value}`);
    });
    vi.doMock('../crypto-utils', () => ({
      CryptoUtils: {
        testCrypto: async () => true,
        isEncrypted: () => false,
        decrypt: async (value: string) => value,
        encrypt,
      },
    }));
    const saveConfig = vi.fn(
      async (_geminiConfig: { apiKey: string }, _videoConfig: unknown) => {}
    );
    vi.doMock('../config-indexeddb-writer', () => ({
      configIndexedDBWriter: {
        saveConfig,
      },
    }));

    const { settingsManager } = await import('../settings-manager');
    await settingsManager.waitForInitialization();
    saveConfig.mockClear();
    const observedKeys: Array<{ notified: string; current: string }> = [];
    settingsManager.addListener<string>('gemini.apiKey', (notified) => {
      observedKeys.push({
        notified,
        current: settingsManager.getSetting<string>('gemini.apiKey'),
      });
    });
    const slowUpdate = settingsManager.updateSetting(
      'gemini.apiKey',
      'slow-key'
    );
    await vi.waitFor(() => expect(encrypt).toHaveBeenCalledWith('slow-key'));

    const latestUpdate = settingsManager.updateSetting(
      'gemini.apiKey',
      'latest-key'
    );
    await Promise.resolve();
    expect(encrypt).not.toHaveBeenCalledWith('latest-key');
    expect(observedKeys).toEqual([
      { notified: 'slow-key', current: 'slow-key' },
      { notified: 'latest-key', current: 'latest-key' },
    ]);

    releaseSlowEncryption?.('encrypted:slow-key');
    await Promise.all([slowUpdate, latestUpdate]);

    expect(
      JSON.parse(localStorage.getItem(DRAWNIX_SETTINGS_KEY) || '{}').gemini
        .apiKey
    ).toBe('encrypted:latest-key');
    expect(saveConfig.mock.calls.map(([config]) => config.apiKey)).toEqual([
      'slow-key',
      'latest-key',
    ]);
  });

  it('pricing 持久化排队期间监听器始终按内存变更顺序前进', async () => {
    let releaseFirstIndexedDBWrite: (() => void) | undefined;
    const firstIndexedDBWrite = new Promise<void>((resolve) => {
      releaseFirstIndexedDBWrite = resolve;
    });
    let blockNextWrite = false;
    const saveConfig = vi.fn(async () => {
      if (blockNextWrite) {
        blockNextWrite = false;
        await firstIndexedDBWrite;
      }
    });
    vi.doMock('../crypto-utils', () => ({
      CryptoUtils: {
        testCrypto: async () => false,
        isEncrypted: () => false,
        decrypt: async (value: string) => value,
        encrypt: async (value: string) => value,
      },
    }));
    vi.doMock('../config-indexeddb-writer', () => ({
      configIndexedDBWriter: { saveConfig },
    }));

    const { providerPricingCacheSettings, settingsManager } = await import(
      '../settings-manager'
    );
    await settingsManager.waitForInitialization();
    blockNextWrite = true;

    const observedModelIds: string[][] = [];
    providerPricingCacheSettings.addListener((caches) => {
      observedModelIds.push(Object.keys(caches[0]?.prices || {}).sort());
    });
    const firstUpdate = providerPricingCacheSettings.update([
      {
        profileId: 'pricing-provider',
        fetchedAt: 1,
        groups: [],
        prices: {
          'old-model': {
            inputCnyMtok: null,
            outputCnyMtok: null,
            flatCny: 1,
            billingType: 'flat',
          },
        },
      },
    ]);
    const latestUpdate = providerPricingCacheSettings.update([
      {
        profileId: 'pricing-provider',
        fetchedAt: 2,
        groups: [],
        prices: {
          'latest-model': {
            inputCnyMtok: null,
            outputCnyMtok: null,
            flatCny: 2,
            billingType: 'flat',
          },
        },
      },
    ]);

    expect(observedModelIds).toEqual([['old-model'], ['latest-model']]);
    expect(
      Object.keys(providerPricingCacheSettings.get()[0]?.prices || {})
    ).toEqual(['latest-model']);

    releaseFirstIndexedDBWrite?.();
    await Promise.all([firstUpdate, latestUpdate]);

    expect(
      JSON.parse(localStorage.getItem(DRAWNIX_SETTINGS_KEY) || '{}')
        .providerPricingCache[0].prices
    ).toHaveProperty('latest-model');
  });

  it('keeps an explicitly selected manual provider type in routing and reloads', async () => {
    mockSettingsManagerDeps();

    const modelRef = {
      profileId: 'manual-provider',
      modelId: 'manual-image-model',
    };
    localStorage.setItem(
      DRAWNIX_SETTINGS_KEY,
      JSON.stringify({
        gemini: {
          apiKey: '',
          baseUrl: 'https://foropencode.com/v1',
        },
        providerProfiles: [
          {
            id: modelRef.profileId,
            name: 'Manual Provider',
            providerType: 'auto',
            baseUrl: 'https://provider.example.com/v1',
            apiKey: 'manual-key',
            authType: 'bearer',
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
        ],
        providerCatalogs: [
          {
            profileId: modelRef.profileId,
            discoveredAt: Date.now(),
            discoveredModels: [
              {
                id: modelRef.modelId,
                label: 'Manual Image Model',
                type: 'image',
                vendor: 'OTHER',
              },
            ],
            selectedModelIds: [modelRef.modelId],
          },
        ],
      })
    );

    let loadedSettings = await import('../settings-manager');
    const manualTypes = [
      'openai-compatible',
      'gemini-compatible',
      'custom',
    ] as const;

    for (const providerType of manualTypes) {
      await loadedSettings.providerProfilesSettings.update(
        loadedSettings.providerProfilesSettings
          .get()
          .map((profile) =>
            profile.id === modelRef.profileId
              ? { ...profile, providerType }
              : profile
          )
      );

      expect(
        loadedSettings.resolveInvocationRoute('image', modelRef).providerType
      ).toBe(providerType);

      vi.resetModules();
      mockSettingsManagerDeps();

      loadedSettings = await import('../settings-manager');
      expect(
        loadedSettings.providerProfilesSettings
          .get()
          .find((profile) => profile.id === modelRef.profileId)?.providerType
      ).toBe(providerType);
      expect(
        loadedSettings.resolveInvocationRoute('image', modelRef).providerType
      ).toBe(providerType);
    }
  });

  it('preserves existing provider pricing data after the settings controls are removed', async () => {
    mockSettingsManagerDeps();

    localStorage.setItem(
      DRAWNIX_SETTINGS_KEY,
      JSON.stringify({
        gemini: {
          apiKey: '',
          baseUrl: 'https://foropencode.com/v1',
        },
        providerProfiles: [
          {
            id: 'pricing-profile',
            name: 'Pricing Profile',
            providerType: 'custom',
            baseUrl: 'https://provider.example.com/v1',
            apiKey: '',
            authType: 'bearer',
            enabled: true,
            capabilities: {},
            pricingUrl: 'https://pricing.example.com/api/pricing',
            cnyPerUsd: 7.25,
            pricingGroup: 'business',
          },
        ],
      })
    );

    const firstLoad = await import('../settings-manager');
    const profile = firstLoad.providerProfilesSettings
      .get()
      .find((candidate) => candidate.id === 'pricing-profile');
    expect(profile).toMatchObject({
      pricingUrl: 'https://pricing.example.com/api/pricing',
      cnyPerUsd: 7.25,
      pricingGroup: 'business',
    });

    await firstLoad.providerProfilesSettings.update(
      firstLoad.providerProfilesSettings.get()
    );
    vi.resetModules();
    mockSettingsManagerDeps();

    const reloaded = await import('../settings-manager');
    expect(
      reloaded.providerProfilesSettings
        .get()
        .find((candidate) => candidate.id === 'pricing-profile')
    ).toMatchObject({
      pricingUrl: 'https://pricing.example.com/api/pricing',
      cnyPerUsd: 7.25,
      pricingGroup: 'business',
    });
  });

  it('reloads stale routing evidence without losing profiles, selections, or pricing data', async () => {
    mockSettingsManagerDeps();

    localStorage.setItem(
      DRAWNIX_SETTINGS_KEY,
      JSON.stringify({
        gemini: {
          apiKey: '',
          baseUrl: 'https://foropencode.com/v1',
        },
        providerProfiles: [
          {
            id: 'auto-provider',
            name: 'Auto Provider',
            providerType: 'auto',
            baseUrl: 'https://provider.example.com/v1',
            apiKey: 'provider-key',
            authType: 'query',
            extraHeaders: { 'X-Tenant': 'tenant-a' },
            enabled: true,
            capabilities: { supportsImage: true },
          },
        ],
        providerCatalogs: [
          {
            profileId: 'auto-provider',
            discoveredAt: 123,
            sourceBaseUrl: 'https://provider.example.com/v1',
            signature: 'legacy-signature',
            discoveredModels: [
              {
                id: 'legacy-image-model',
                label: 'Legacy Image Model',
                type: 'image',
                vendor: 'OTHER',
              },
            ],
            selectedModelIds: ['legacy-image-model'],
          },
        ],
        providerPricingCache: [
          {
            profileId: 'auto-provider',
            fetchedAt: 456,
            sourceSignature: 'legacy-pricing-source',
            groups: [{ name: 'default', displayName: 'Default', ratio: 1 }],
            prices: {
              'legacy-image-model': {
                inputCnyMtok: null,
                outputCnyMtok: null,
                flatCny: 0.5,
                billingType: 'flat',
              },
            },
            modelEndpoints: {
              'legacy-image-model': {
                image: {
                  path: '/stale/images/generations',
                  method: 'POST',
                },
              },
            },
          },
        ],
      })
    );

    const firstLoad = await import('../settings-manager');
    const assertPreserved = (
      settings: ReturnType<typeof firstLoad.settingsManager.getSettings>
    ) => {
      expect(
        settings.providerProfiles.find(
          (profile) => profile.id === 'auto-provider'
        )
      ).toMatchObject({
        providerType: 'auto',
        baseUrl: 'https://provider.example.com/v1',
        apiKey: 'provider-key',
        authType: 'query',
        extraHeaders: { 'X-Tenant': 'tenant-a' },
      });
      const catalog = settings.providerCatalogs.find(
        (candidate) => candidate.profileId === 'auto-provider'
      );
      expect(catalog).not.toHaveProperty('routingEvidenceVersion');
      expect(catalog).toMatchObject({
        selectedModelIds: ['legacy-image-model'],
        discoveredModels: [{ id: 'legacy-image-model' }],
      });
      const pricingCache = settings.providerPricingCache.find(
        (cache) => cache.profileId === 'auto-provider'
      );
      expect(pricingCache).not.toHaveProperty('routingEvidenceVersion');
      expect(pricingCache).toMatchObject({
        groups: [{ name: 'default' }],
        prices: { 'legacy-image-model': { flatCny: 0.5 } },
        modelEndpoints: {
          'legacy-image-model': {
            image: { path: '/stale/images/generations' },
          },
        },
      });
    };

    const firstSettings = firstLoad.settingsManager.getSettings();
    assertPreserved(firstSettings);
    expect(
      firstLoad.resolveInvocationRoute('image', {
        profileId: 'auto-provider',
        modelId: 'legacy-image-model',
      })
    ).toMatchObject({
      profileId: null,
      modelId: '',
    });
    await firstLoad.settingsManager.updateSettings({
      providerProfiles: firstSettings.providerProfiles,
      providerCatalogs: firstSettings.providerCatalogs,
      providerPricingCache: firstSettings.providerPricingCache,
    });

    vi.resetModules();
    mockSettingsManagerDeps();
    const reloaded = await import('../settings-manager');
    assertPreserved(reloaded.settingsManager.getSettings());
  });

  it('keeps current endpoint evidence executable after settings save and reload', async () => {
    mockSettingsManagerDeps();
    const fetchedAt = Date.now();
    localStorage.setItem(
      DRAWNIX_SETTINGS_KEY,
      JSON.stringify({
        gemini: {
          apiKey: '',
          baseUrl: 'https://foropencode.com/v1',
        },
        providerProfiles: [
          {
            id: 'auto-provider',
            name: 'Auto Provider',
            providerType: 'auto',
            baseUrl: 'https://provider.example.com/v1',
            apiKey: 'provider-key',
            authType: 'bearer',
            pricingUrl: 'https://pricing.example.com/api/pricing',
            pricingGroup: 'default',
            cnyPerUsd: 1,
            enabled: true,
            capabilities: { supportsImage: true },
          },
        ],
        providerCatalogs: [
          {
            profileId: 'auto-provider',
            routingEvidenceVersion: IMAGE_ROUTING_EVIDENCE_VERSION,
            discoveredAt: fetchedAt,
            sourceBaseUrl: 'https://provider.example.com/v1',
            signature: buildProviderCatalogDiscoverySignature(
              'https://provider.example.com/v1',
              'provider-key'
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
        providerPricingCache: [
          {
            profileId: 'auto-provider',
            routingEvidenceVersion: IMAGE_ROUTING_EVIDENCE_VERSION,
            fetchedAt,
            sourceSignature: `https://pricing.example.com/api/pricing\ndefault\n1\ncredential:${buildProviderCredentialIdentity(
              'provider-key'
            )}`,
            groups: [],
            prices: {},
            modelEndpoints: {
              'opaque-renderer-v2': {
                image: {
                  path: '/custom/images/generations',
                  method: 'POST',
                },
              },
            },
          },
        ],
      })
    );

    const firstLoad = await import('../settings-manager');
    const firstSettings = firstLoad.settingsManager.getSettings();
    await firstLoad.settingsManager.updateSettings({
      providerProfiles: firstSettings.providerProfiles,
      providerCatalogs: firstSettings.providerCatalogs,
      providerPricingCache: firstSettings.providerPricingCache,
    });

    vi.resetModules();
    mockSettingsManagerDeps();
    const reloaded = await import('../settings-manager');
    expect(reloaded.providerPricingCacheSettings.get()[0]).toMatchObject({
      routingEvidenceVersion: IMAGE_ROUTING_EVIDENCE_VERSION,
      sourceSignature: `https://pricing.example.com/api/pricing\ndefault\n1\ncredential:${buildProviderCredentialIdentity(
        'provider-key'
      )}`,
      modelEndpoints: {
        'opaque-renderer-v2': {
          image: { path: '/custom/images/generations' },
        },
      },
    });

    const { listSettingsModelBindings } = await import(
      '../../services/provider-routing/settings-repository'
    );
    expect(
      listSettingsModelBindings({ includeLegacyProfile: false }).some(
        (binding) =>
          binding.profileId === 'auto-provider' &&
          binding.modelId === 'opaque-renderer-v2' &&
          binding.submitPath === '/custom/images/generations'
      )
    ).toBe(true);
  });

  it('preserves stored legacy text model IDs without migration', async () => {
    mockSettingsManagerDeps();

    localStorage.setItem(
      DRAWNIX_SETTINGS_KEY,
      JSON.stringify({
        gemini: {
          apiKey: 'legacy-key',
          baseUrl: 'https://foropencode.com/v1',
          textModelName: 'gpt-5.4',
          chatModel: 'gpt-5.4',
        },
      })
    );

    const { settingsManager } = await import('../settings-manager');
    const settings = settingsManager.getSettings();

    expect(settings.gemini.textModelName).toBe('gpt-5.4');
    expect(settings.gemini.chatModel).toBe('gpt-5.4');
    expect(settings.invocationPresets[0]?.text.defaultModelRef).toEqual({
      profileId: 'legacy-default',
      modelId: 'gpt-5.4',
    });
    expect(settings.migrations).not.toHaveProperty('defaultTextModelsV1');
  });

  it('routes stale preset model references to a model selected for the current credential', async () => {
    mockSettingsManagerDeps();

    localStorage.setItem(
      DRAWNIX_SETTINGS_KEY,
      JSON.stringify({
        gemini: {
          apiKey: 'legacy-key',
          baseUrl: 'https://legacy.example.com/v1',
          textModelName: 'gpt-5.6-sol',
        },
        providerProfiles: [
          {
            id: 'custom-provider',
            name: 'Custom Provider',
            providerType: 'openai-compatible',
            baseUrl: 'https://new-key.example.com/v1',
            apiKey: 'new-key',
            authType: 'bearer',
            enabled: true,
            capabilities: { supportsText: true },
          },
        ],
        providerCatalogs: [
          {
            profileId: 'custom-provider',
            discoveredAt: Date.now(),
            signature: 'new-key-signature',
            discoveredModels: [
              {
                id: 'new-key-text-model',
                label: 'New Key Text Model',
                type: 'text',
                vendor: 'OTHER',
              },
            ],
            selectedModelIds: ['new-key-text-model'],
          },
        ],
        invocationPresets: [
          {
            id: 'default',
            name: 'Default',
            isDefault: true,
            image: { defaultModelRef: null },
            video: { defaultModelRef: null },
            audio: { defaultModelRef: null },
            text: {
              defaultModelRef: {
                profileId: 'custom-provider',
                modelId: 'old-key-text-model',
              },
            },
          },
        ],
        activePresetId: 'default',
      })
    );

    const { hasInvocationRouteCredentials, resolveInvocationRoute } =
      await import('../settings-manager');

    expect(resolveInvocationRoute('text')).toMatchObject({
      modelId: 'new-key-text-model',
      profileId: 'custom-provider',
      baseUrl: 'https://new-key.example.com/v1',
      apiKey: 'new-key',
    });
    expect(
      resolveInvocationRoute('text', {
        profileId: 'custom-provider',
        modelId: 'old-key-text-model',
      })
    ).toMatchObject({
      modelId: 'new-key-text-model',
      profileId: 'custom-provider',
    });
    expect(resolveInvocationRoute('text', 'gpt-5.6-sol')).toMatchObject({
      modelId: 'new-key-text-model',
      profileId: 'custom-provider',
      baseUrl: 'https://new-key.example.com/v1',
      apiKey: 'new-key',
    });
    expect(resolveInvocationRoute('image')).toMatchObject({
      modelId: '',
      profileId: null,
      baseUrl: '',
      apiKey: '',
    });
    expect(hasInvocationRouteCredentials('image')).toBe(false);
  });

  it('keeps only default and codex built-in profiles while preserving custom providers', async () => {
    mockSettingsManagerDeps();

    localStorage.setItem(
      DRAWNIX_SETTINGS_KEY,
      JSON.stringify({
        gemini: {
          apiKey: 'legacy-key',
          baseUrl: 'https://foropencode.com/v1',
        },
        providerProfiles: [
          {
            id: 'legacy-default',
            name: 'For AI',
            providerType: 'custom',
            baseUrl: 'https://foropencode.com/v1',
            apiKey: 'legacy-key',
            authType: 'query',
            enabled: true,
            capabilities: {},
          },
          {
            id: 'for-codex',
            name: 'codex 分组',
            providerType: 'openai-compatible',
            baseUrl: 'https://codex.example.com/v1',
            apiKey: 'codex-key',
            authType: 'bearer',
            imageApiCompatibility: 'openai-gpt-image',
            enabled: true,
            capabilities: {},
            pricingGroup: 'codex-custom',
          },
          {
            id: 'custom-auto',
            name: '自定义自动',
            providerType: 'openai-compatible',
            baseUrl: 'https://gateway-auto.example.com/v1',
            apiKey: 'auto-key',
            authType: 'bearer',
            imageApiCompatibility: 'auto',
            enabled: true,
            capabilities: {},
          },
          {
            id: 'custom-missing',
            name: '自定义缺省',
            providerType: 'openai-compatible',
            baseUrl: 'https://gateway-missing.example.com/v1',
            apiKey: 'missing-key',
            authType: 'bearer',
            enabled: true,
            capabilities: {},
          },
          {
            id: 'custom-provider',
            name: '自定义供应商',
            providerType: 'openai-compatible',
            baseUrl: 'https://gateway.example.com/v1',
            apiKey: 'custom-key',
            authType: 'bearer',
            imageApiCompatibility: 'removed-image-format',
            enabled: true,
            capabilities: {},
          },
          {
            id: 'invalid-provider',
            name: '错误配置供应商',
            providerType: 'openai-compatible',
            baseUrl: 'https://invalid.example.com/v1',
            apiKey: 'invalid-key',
            authType: 'bearer',
            imageApiCompatibility: 'unknown-mode',
            enabled: true,
            capabilities: {},
          },
        ],
        providerCatalogs: [
          {
            profileId: 'missing-provider',
            discoveredAt: '2026-01-01T00:00:00.000Z',
            discoveredModels: [],
            selectedModelIds: ['orphan-model'],
            sourceBaseUrl: 'https://foropencode.com/v1',
            error: null,
          },
          {
            profileId: 'custom-auto',
            discoveredAt: '2026-01-01T00:00:00.000Z',
            discoveredModels: [],
            selectedModelIds: ['custom-model'],
            sourceBaseUrl: 'https://gateway-auto.example.com/v1',
            error: null,
          },
        ],
        invocationPresets: [
          {
            id: 'custom-preset',
            name: '自定义预设',
            text: {
              defaultModelRef: {
                profileId: 'missing-provider',
                modelId: 'orphan-text-model',
              },
            },
            image: {
              defaultModelRef: {
                profileId: 'for-codex',
                modelId: 'gpt-image-2',
              },
            },
            video: {
              defaultModelRef: {
                profileId: 'custom-auto',
                modelId: 'custom-video-model',
              },
            },
            audio: {
              defaultModelRef: {
                profileId: 'missing-provider',
                modelId: 'orphan-audio-model',
              },
            },
          },
        ],
      })
    );

    const {
      providerProfilesSettings,
      providerCatalogsSettings,
      invocationPresetsSettings,
      DEFAULT_PROVIDER_IMAGE_API_COMPATIBILITY,
      LEGACY_DEFAULT_PROVIDER_PROFILE_ID,
      FOR_CODEX_PROVIDER_PROFILE_ID,
      isBuiltInDefaultProviderProfileId,
    } = await import('../settings-manager');

    const profiles = providerProfilesSettings.get();
    const profileIds = profiles.map((profile) => profile.id);
    const legacyProfile = profiles.find(
      (profile) => profile.id === LEGACY_DEFAULT_PROVIDER_PROFILE_ID
    );
    const forCodexProfile = profiles.find(
      (profile) => profile.id === FOR_CODEX_PROVIDER_PROFILE_ID
    );

    expect(profileIds).toEqual([
      LEGACY_DEFAULT_PROVIDER_PROFILE_ID,
      FOR_CODEX_PROVIDER_PROFILE_ID,
      'custom-auto',
      'custom-missing',
      'custom-provider',
      'invalid-provider',
    ]);
    expect(
      isBuiltInDefaultProviderProfileId(LEGACY_DEFAULT_PROVIDER_PROFILE_ID)
    ).toBe(true);
    expect(
      isBuiltInDefaultProviderProfileId(FOR_CODEX_PROVIDER_PROFILE_ID)
    ).toBe(true);
    expect(isBuiltInDefaultProviderProfileId('missing-provider')).toBe(false);
    expect(isBuiltInDefaultProviderProfileId('custom-auto')).toBe(false);

    expect(legacyProfile).toMatchObject({
      providerType: 'custom',
      authType: 'query',
      imageApiCompatibility: DEFAULT_PROVIDER_IMAGE_API_COMPATIBILITY,
    });
    expect(forCodexProfile).toMatchObject({
      baseUrl: 'https://codex.example.com/v1',
      pricingGroup: 'codex-custom',
      imageApiCompatibility: 'openai-gpt-image',
    });
    expect(
      profiles.find((profile) => profile.id === 'custom-auto')
    ).toMatchObject({
      imageApiCompatibility: 'auto',
    });
    expect(
      profiles.find((profile) => profile.id === 'custom-missing')
    ).toMatchObject({
      imageApiCompatibility: DEFAULT_PROVIDER_IMAGE_API_COMPATIBILITY,
    });
    expect(
      profiles.find((profile) => profile.id === 'custom-provider')
    ).toMatchObject({
      imageApiCompatibility: DEFAULT_PROVIDER_IMAGE_API_COMPATIBILITY,
    });
    expect(
      profiles.find((profile) => profile.id === 'invalid-provider')
    ).toMatchObject({
      imageApiCompatibility: DEFAULT_PROVIDER_IMAGE_API_COMPATIBILITY,
    });

    await providerProfilesSettings.update([
      ...profiles.filter((profile) => profile.id !== 'custom-provider'),
      {
        id: 'custom-provider',
        name: '自定义供应商',
        providerType: 'openai-compatible',
        baseUrl: 'https://gateway.example.com/v1',
        apiKey: 'custom-key',
        authType: 'bearer',
        imageApiCompatibility: 'removed-image-format' as any,
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

    const updatedCustomProfile = providerProfilesSettings
      .get()
      .find((profile) => profile.id === 'custom-provider');

    expect(updatedCustomProfile).toMatchObject({
      imageApiCompatibility: DEFAULT_PROVIDER_IMAGE_API_COMPATIBILITY,
    });

    expect(
      providerCatalogsSettings.get().map((catalog) => catalog.profileId)
    ).toEqual([
      LEGACY_DEFAULT_PROVIDER_PROFILE_ID,
      'custom-auto',
      FOR_CODEX_PROVIDER_PROFILE_ID,
    ]);

    const customPreset = invocationPresetsSettings
      .get()
      .find((preset) => preset.id === 'custom-preset');
    expect(customPreset?.text.defaultModelRef).toEqual({
      profileId: null,
      modelId: 'orphan-text-model',
    });
    expect(customPreset?.audio.defaultModelRef).toEqual({
      profileId: null,
      modelId: 'orphan-audio-model',
    });
    expect(customPreset?.image.defaultModelRef).toEqual({
      profileId: FOR_CODEX_PROVIDER_PROFILE_ID,
      modelId: 'gpt-image-2',
    });
    expect(customPreset?.video.defaultModelRef).toEqual({
      profileId: 'custom-auto',
      modelId: 'custom-video-model',
    });
  });

  it('normalizes stored default-profile image compatibility to the current default', async () => {
    mockSettingsManagerDeps();

    localStorage.setItem(
      DRAWNIX_SETTINGS_KEY,
      JSON.stringify({
        gemini: {
          apiKey: 'legacy-key',
          baseUrl: 'https://foropencode.com/v1',
        },
        providerProfiles: [
          {
            id: 'legacy-default',
            name: 'default 分组',
            providerType: 'openai-compatible',
            baseUrl: 'https://foropencode.com/v1',
            apiKey: 'legacy-key',
            authType: 'bearer',
            imageApiCompatibility: 'openai-gpt-image',
            enabled: true,
            capabilities: {},
          },
        ],
      })
    );

    const {
      providerProfilesSettings,
      settingsManager,
      LEGACY_DEFAULT_PROVIDER_PROFILE_ID,
    } = await import('../settings-manager');

    const normalizedProfile = providerProfilesSettings
      .get()
      .find((profile) => profile.id === LEGACY_DEFAULT_PROVIDER_PROFILE_ID);

    expect(normalizedProfile).toMatchObject({
      imageApiCompatibility: 'openai-gpt-image',
    });
    expect(settingsManager.getSettings().migrations).toEqual({
      legacyDefaultImageModelV1: true,
    });

    await providerProfilesSettings.update(
      providerProfilesSettings.get().map((profile) =>
        profile.id === LEGACY_DEFAULT_PROVIDER_PROFILE_ID
          ? {
              ...profile,
              imageApiCompatibility: 'openai-gpt-image' as const,
            }
          : profile
      )
    );

    vi.resetModules();
    mockSettingsManagerDeps();

    const reloaded = await import('../settings-manager');
    const reloadedLegacyProfile = reloaded.providerProfilesSettings
      .get()
      .find(
        (profile) => profile.id === reloaded.LEGACY_DEFAULT_PROVIDER_PROFILE_ID
      );

    expect(reloadedLegacyProfile).toMatchObject({
      imageApiCompatibility: 'openai-gpt-image',
    });
    expect(reloaded.settingsManager.getSettings().migrations).toEqual({
      legacyDefaultImageModelV1: true,
    });
  });

  it('persists auto provider intent and preserves profile transport settings while switching models', async () => {
    mockSettingsManagerDeps();

    localStorage.setItem(
      DRAWNIX_SETTINGS_KEY,
      JSON.stringify({
        gemini: {
          apiKey: 'legacy-key',
          baseUrl: 'https://foropencode.com/v1',
        },
        providerProfiles: [
          {
            id: 'profile-auto',
            name: 'default',
            providerType: 'auto',
            baseUrl: 'https://gateway.example.com/v1',
            apiKey: 'profile-key',
            authType: 'query',
            imageApiCompatibility: 'openai-gpt-image',
            extraHeaders: {
              'X-Provider-Group': 'default',
            },
            enabled: true,
            capabilities: {},
          },
        ],
        invocationPresets: [
          {
            id: 'default',
            name: '默认方案',
            isDefault: true,
            text: { defaultModelRef: null },
            audio: { defaultModelRef: null },
            video: { defaultModelRef: null },
            image: {
              defaultModelRef: {
                profileId: 'profile-auto',
                modelId: 'gpt-image-2',
              },
            },
          },
        ],
        activePresetId: 'default',
      })
    );

    const { settingsManager, providerProfilesSettings } = await import(
      '../settings-manager'
    );
    const beforeSwitch = providerProfilesSettings
      .get()
      .find((profile) => profile.id === 'profile-auto');

    expect(beforeSwitch).toMatchObject({
      name: 'default',
      providerType: 'auto',
      baseUrl: 'https://gateway.example.com/v1',
      authType: 'query',
      imageApiCompatibility: 'openai-gpt-image',
      extraHeaders: {
        'X-Provider-Group': 'default',
      },
    });

    await settingsManager.updateActiveInvocationRouteModel('image', {
      profileId: 'profile-auto',
      modelId: 'gemini-3.1-flash-image-preview',
    });

    expect(
      providerProfilesSettings
        .get()
        .find((profile) => profile.id === 'profile-auto')?.providerType
    ).toBe('auto');

    vi.resetModules();
    mockSettingsManagerDeps();

    const reloaded = await import('../settings-manager');
    const reloadedProfile = reloaded.providerProfilesSettings
      .get()
      .find((profile) => profile.id === 'profile-auto');

    expect(reloadedProfile).toMatchObject({
      name: 'default',
      providerType: 'auto',
      baseUrl: 'https://gateway.example.com/v1',
      authType: 'query',
      imageApiCompatibility: 'openai-gpt-image',
      extraHeaders: {
        'X-Provider-Group': 'default',
      },
    });
    expect(
      reloaded.settingsManager.getActiveInvocationPreset()?.image
        .defaultModelRef
    ).toEqual({
      profileId: 'profile-auto',
      modelId: 'gemini-3.1-flash-image-preview',
    });
  });

  it('reloads auto and explicit headers for the managed legacy default profile', async () => {
    mockSettingsManagerDeps();

    localStorage.setItem(
      DRAWNIX_SETTINGS_KEY,
      JSON.stringify({
        gemini: {
          apiKey: 'legacy-key',
          baseUrl: 'https://gateway.example.com/v1',
          imageModelName: 'gpt-image-2',
        },
        providerProfiles: [
          {
            id: 'legacy-default',
            name: 'default 分组',
            providerType: 'auto',
            baseUrl: 'https://gateway.example.com/v1',
            apiKey: 'legacy-key',
            authType: 'query',
            imageApiCompatibility: 'openai-gpt-image',
            extraHeaders: { 'X-Tenant': 'tenant-a' },
            enabled: true,
            capabilities: {},
          },
        ],
      })
    );

    const firstLoad = await import('../settings-manager');
    const profileId = firstLoad.LEGACY_DEFAULT_PROVIDER_PROFILE_ID;
    const profile = firstLoad.providerProfilesSettings
      .get()
      .find((candidate) => candidate.id === profileId);

    expect(profile).toMatchObject({
      providerType: 'auto',
      baseUrl: 'https://gateway.example.com/v1',
      authType: 'query',
      imageApiCompatibility: 'openai-gpt-image',
      extraHeaders: { 'X-Tenant': 'tenant-a' },
    });

    await firstLoad.providerProfilesSettings.update(
      firstLoad.providerProfilesSettings.get()
    );
    vi.resetModules();
    mockSettingsManagerDeps();

    const reloaded = await import('../settings-manager');
    expect(
      reloaded.providerProfilesSettings
        .get()
        .find((candidate) => candidate.id === profileId)
    ).toMatchObject({
      providerType: 'auto',
      baseUrl: 'https://gateway.example.com/v1',
      authType: 'query',
      imageApiCompatibility: 'openai-gpt-image',
      extraHeaders: { 'X-Tenant': 'tenant-a' },
    });
  });

  it('migrates legacy default image model only once', async () => {
    mockSettingsManagerDeps();

    localStorage.setItem(
      DRAWNIX_SETTINGS_KEY,
      JSON.stringify({
        gemini: {
          apiKey: 'legacy-key',
          baseUrl: 'https://foropencode.com/v1',
          imageModelName: 'gpt-image-2-vip',
        },
        invocationPresets: [
          {
            id: 'default',
            name: '默认方案',
            isDefault: true,
            text: {
              defaultModelRef: {
                profileId: 'legacy-default',
                modelId: 'gemini-2.5-pro-all',
              },
            },
            audio: {
              defaultModelRef: {
                profileId: 'legacy-default',
                modelId: 'suno_music',
              },
            },
            image: {
              defaultModelRef: {
                profileId: 'legacy-default',
                modelId: 'gpt-image-2-vip',
              },
            },
            video: {
              defaultModelRef: {
                profileId: 'legacy-default',
                modelId: 'seedance-1.5-pro',
              },
            },
          },
        ],
      })
    );

    const { settingsManager } = await import('../settings-manager');
    const settings = settingsManager.getSettings();

    expect(settings.gemini.imageModelName).toBe('gpt-image-2');
    expect(settings.invocationPresets[0]?.image.defaultModelRef).toMatchObject({
      profileId: 'legacy-default',
      modelId: 'gpt-image-2',
    });
    expect(settings.migrations).toMatchObject({
      legacyDefaultImageModelV1: true,
    });

    await settingsManager.updateActiveInvocationRouteModel('image', {
      profileId: 'legacy-default',
      modelId: 'gpt-image-2-vip',
    });

    vi.resetModules();
    mockSettingsManagerDeps();

    const reloaded = await import('../settings-manager');
    const reloadedSettings = reloaded.settingsManager.getSettings();

    expect(reloadedSettings.gemini.imageModelName).toBe('gpt-image-2-vip');
    expect(
      reloadedSettings.invocationPresets[0]?.image.defaultModelRef
    ).toMatchObject({
      profileId: 'legacy-default',
      modelId: 'gpt-image-2-vip',
    });
    expect(reloadedSettings.migrations).toMatchObject({
      legacyDefaultImageModelV1: true,
    });
  });

  it('keeps current default compatibility for OpenAI legacy profiles', async () => {
    mockSettingsManagerDeps();

    localStorage.setItem(
      DRAWNIX_SETTINGS_KEY,
      JSON.stringify({
        gemini: {
          apiKey: 'openai-key',
          baseUrl: 'https://api.openai.com/v1',
        },
        providerProfiles: [
          {
            id: 'legacy-default',
            name: 'default 分组',
            providerType: 'openai-compatible',
            baseUrl: 'https://api.openai.com/v1',
            apiKey: 'openai-key',
            authType: 'bearer',
            imageApiCompatibility: 'openai-gpt-image',
            enabled: true,
            capabilities: {},
          },
        ],
      })
    );

    const {
      providerProfilesSettings,
      settingsManager,
      LEGACY_DEFAULT_PROVIDER_PROFILE_ID,
    } = await import('../settings-manager');

    const legacyProfile = providerProfilesSettings
      .get()
      .find((profile) => profile.id === LEGACY_DEFAULT_PROVIDER_PROFILE_ID);

    expect(legacyProfile).toMatchObject({
      imageApiCompatibility: 'openai-gpt-image',
    });
    expect(settingsManager.getSettings().migrations).toEqual({
      legacyDefaultImageModelV1: true,
    });
  });

  it('preserves managed profile compatibility overrides after reload', async () => {
    mockSettingsManagerDeps();

    localStorage.setItem(
      DRAWNIX_SETTINGS_KEY,
      JSON.stringify({
        gemini: {
          apiKey: 'legacy-key',
          baseUrl: 'https://foropencode.com/v1',
        },
      })
    );

    const {
      providerProfilesSettings,
      LEGACY_DEFAULT_PROVIDER_PROFILE_ID,
      FOR_CODEX_PROVIDER_PROFILE_ID,
    } = await import('../settings-manager');

    const profiles = providerProfilesSettings.get();

    await providerProfilesSettings.update(
      profiles.map((profile) => {
        if (profile.id === LEGACY_DEFAULT_PROVIDER_PROFILE_ID) {
          return {
            ...profile,
            imageApiCompatibility: 'openai-gpt-image' as const,
          };
        }

        if (profile.id === FOR_CODEX_PROVIDER_PROFILE_ID) {
          return {
            ...profile,
            imageApiCompatibility: 'openai-gpt-image' as const,
          };
        }

        return profile;
      })
    );

    vi.resetModules();
    mockSettingsManagerDeps();

    const reloaded = await import('../settings-manager');
    const reloadedProfiles = reloaded.providerProfilesSettings.get();

    expect(
      reloadedProfiles.find(
        (profile) => profile.id === LEGACY_DEFAULT_PROVIDER_PROFILE_ID
      )
    ).toMatchObject({
      imageApiCompatibility: 'openai-gpt-image',
    });
    expect(
      reloadedProfiles.find(
        (profile) => profile.id === FOR_CODEX_PROVIDER_PROFILE_ID
      )
    ).toMatchObject({
      imageApiCompatibility: 'openai-gpt-image',
    });
  });

  it('ignores and removes the retired async image profile preference', async () => {
    mockSettingsManagerDeps();

    localStorage.setItem(
      DRAWNIX_SETTINGS_KEY,
      JSON.stringify({
        gemini: {
          apiKey: 'legacy-key',
          baseUrl: 'https://foropencode.com/v1',
        },
        providerProfiles: [
          {
            id: 'legacy-default',
            name: 'default 分组',
            providerType: 'openai-compatible',
            baseUrl: 'https://foropencode.com/v1',
            apiKey: 'legacy-key',
            authType: 'bearer',
            imageApiCompatibility: 'openai-gpt-image',
            preferAsyncImageEndpoint: true,
            enabled: true,
            capabilities: {},
          },
          {
            id: 'for-codex',
            name: 'codex 分组',
            providerType: 'openai-compatible',
            baseUrl: 'https://foropencode.com/v1',
            apiKey: 'codex-key',
            authType: 'bearer',
            imageApiCompatibility: 'openai-gpt-image',
            preferAsyncImageEndpoint: true,
            enabled: true,
            capabilities: {},
            pricingGroup: 'codex',
          },
        ],
      })
    );

    const {
      providerProfilesSettings,
      LEGACY_DEFAULT_PROVIDER_PROFILE_ID,
      FOR_CODEX_PROVIDER_PROFILE_ID,
    } = await import('../settings-manager');

    const profiles = providerProfilesSettings.get();
    const legacyProfile = profiles.find(
      (profile) => profile.id === LEGACY_DEFAULT_PROVIDER_PROFILE_ID
    );
    const forCodexProfile = profiles.find(
      (profile) => profile.id === FOR_CODEX_PROVIDER_PROFILE_ID
    );

    expect(legacyProfile).not.toHaveProperty('preferAsyncImageEndpoint');
    expect(forCodexProfile).not.toHaveProperty('preferAsyncImageEndpoint');
    expect(legacyProfile).toMatchObject({
      baseUrl: 'https://foropencode.com/v1',
      imageApiCompatibility: 'openai-gpt-image',
    });
    expect(forCodexProfile).toMatchObject({
      baseUrl: 'https://foropencode.com/v1',
      imageApiCompatibility: 'openai-gpt-image',
      pricingGroup: 'codex',
    });

    await providerProfilesSettings.update(profiles);
    const persisted = JSON.parse(
      localStorage.getItem(DRAWNIX_SETTINGS_KEY) || '{}'
    );
    expect(persisted.providerProfiles).toEqual(
      expect.arrayContaining([
        expect.not.objectContaining({ preferAsyncImageEndpoint: true }),
      ])
    );
    expect(
      persisted.providerProfiles.some(
        (profile: Record<string, unknown>) =>
          'preferAsyncImageEndpoint' in profile
      )
    ).toBe(false);

    vi.resetModules();
    mockSettingsManagerDeps();

    const reloaded = await import('../settings-manager');
    const reloadedLegacyProfile = reloaded.providerProfilesSettings
      .get()
      .find(
        (profile) => profile.id === reloaded.LEGACY_DEFAULT_PROVIDER_PROFILE_ID
      );
    const reloadedForCodexProfile = reloaded.providerProfilesSettings
      .get()
      .find((profile) => profile.id === reloaded.FOR_CODEX_PROVIDER_PROFILE_ID);

    expect(reloadedLegacyProfile).not.toHaveProperty(
      'preferAsyncImageEndpoint'
    );
    expect(reloadedForCodexProfile).not.toHaveProperty(
      'preferAsyncImageEndpoint'
    );
  });
});
