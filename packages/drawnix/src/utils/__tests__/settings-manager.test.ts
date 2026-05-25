import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DRAWNIX_SETTINGS_KEY } from '../../constants/storage';

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
      saveConfig: async () => undefined,
    },
  }));
}

const LEGACY_FOROPENCODE_GROUP_PROFILE_IDS = [
  'tuzi-origin',
  'tuzi-mix',
  'tuzi-codex',
  'tuzi-business',
];

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
          replaceState: () => undefined,
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
          replaceState: () => undefined,
        },
        dispatchEvent: () => true,
      });
    }

    localStorage.clear();
  });

  it('initializes only the legacy default provider profile and catalog', async () => {
    mockSettingsManagerDeps();

    const {
      providerProfilesSettings,
      providerCatalogsSettings,
      LEGACY_DEFAULT_PROVIDER_PROFILE_ID,
      FOROPENCODE_DEFAULT_PROVIDER_NAME,
      LEGACY_DEFAULT_PROVIDER_IMAGE_API_COMPATIBILITY,
    } = await import('../settings-manager');

    const profiles = providerProfilesSettings.get();
    const catalogs = providerCatalogsSettings.get();

    expect(profiles.map((profile) => profile.id)).toEqual([
      LEGACY_DEFAULT_PROVIDER_PROFILE_ID,
    ]);
    expect(catalogs.map((catalog) => catalog.profileId)).toEqual([
      LEGACY_DEFAULT_PROVIDER_PROFILE_ID,
    ]);
    expect(profiles[0]).toMatchObject({
      id: LEGACY_DEFAULT_PROVIDER_PROFILE_ID,
      name: FOROPENCODE_DEFAULT_PROVIDER_NAME,
      imageApiCompatibility: LEGACY_DEFAULT_PROVIDER_IMAGE_API_COMPATIBILITY,
    });
    expect(profiles[0].pricingGroup).toBeUndefined();
    expect(
      profiles.some((profile) =>
        LEGACY_FOROPENCODE_GROUP_PROFILE_IDS.includes(profile.id)
      )
    ).toBe(false);
    expect(
      catalogs.some((catalog) =>
        LEGACY_FOROPENCODE_GROUP_PROFILE_IDS.includes(catalog.profileId)
      )
    ).toBe(false);
  });

  it('does not rebuild historical system ForOpenCode group profiles/catalogs and preserves custom providers', async () => {
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
            name: 'Default Provider',
            providerType: 'openai-compatible',
            baseUrl: 'https://foropencode.com/v1',
            apiKey: 'legacy-key',
            authType: 'bearer',
            enabled: true,
            capabilities: {},
          },
          ...LEGACY_FOROPENCODE_GROUP_PROFILE_IDS.map((id) => ({
            id,
            name: `system ${id}`,
            providerType: 'openai-compatible',
            baseUrl: 'https://foropencode.com/v1',
            apiKey: `${id}-key`,
            authType: 'bearer',
            enabled: true,
            capabilities: {},
            pricingGroup: id.replace('tuzi-', '') || 'default',
          })),
          {
            id: 'custom-provider',
            name: 'Custom Provider',
            providerType: 'openai-compatible',
            baseUrl: 'https://gateway.example.com/v1',
            apiKey: 'custom-key',
            authType: 'bearer',
            imageApiCompatibility: 'tuzi-compatible',
            enabled: true,
            capabilities: {},
            pricingGroup: 'codex',
          },
        ],
        providerCatalogs: [
          {
            profileId: 'legacy-default',
            discoveredAt: null,
            discoveredModels: [],
            selectedModelIds: [],
            sourceBaseUrl: 'https://foropencode.com/v1',
            error: null,
          },
          ...LEGACY_FOROPENCODE_GROUP_PROFILE_IDS.map((profileId) => ({
            profileId,
            discoveredAt: null,
            discoveredModels: [],
            selectedModelIds: [],
            sourceBaseUrl: 'https://foropencode.com/v1',
            error: null,
          })),
          {
            profileId: 'custom-provider',
            discoveredAt: 123,
            discoveredModels: [],
            selectedModelIds: ['custom-model'],
            sourceBaseUrl: 'https://gateway.example.com/v1',
            error: null,
          },
        ],
      })
    );

    const {
      providerProfilesSettings,
      providerCatalogsSettings,
      LEGACY_DEFAULT_PROVIDER_IMAGE_API_COMPATIBILITY,
      LEGACY_DEFAULT_PROVIDER_PROFILE_ID,
    } = await import('../settings-manager');

    const profiles = providerProfilesSettings.get();
    const catalogs = providerCatalogsSettings.get();

    expect(profiles.map((profile) => profile.id)).toEqual([
      LEGACY_DEFAULT_PROVIDER_PROFILE_ID,
      'custom-provider',
    ]);
    expect(catalogs.map((catalog) => catalog.profileId)).toEqual([
      LEGACY_DEFAULT_PROVIDER_PROFILE_ID,
      'custom-provider',
    ]);
    expect(
      profiles.some((profile) =>
        LEGACY_FOROPENCODE_GROUP_PROFILE_IDS.includes(profile.id)
      )
    ).toBe(false);
    expect(
      catalogs.some((catalog) =>
        LEGACY_FOROPENCODE_GROUP_PROFILE_IDS.includes(catalog.profileId)
      )
    ).toBe(false);
    expect(profiles.find((profile) => profile.id === 'custom-provider')).toMatchObject({
      name: 'Custom Provider',
      pricingGroup: 'codex',
      imageApiCompatibility: 'openai-gpt-image',
    });
    expect(catalogs.find((catalog) => catalog.profileId === 'custom-provider')).toMatchObject({
      selectedModelIds: ['custom-model'],
      sourceBaseUrl: 'https://gateway.example.com/v1',
    });
    expect(profiles.find((profile) => profile.id === 'legacy-default')).toMatchObject({
      imageApiCompatibility: LEGACY_DEFAULT_PROVIDER_IMAGE_API_COMPATIBILITY,
    });
  });

  it('preserves a user-selected non-default pricingGroup after save and reload', async () => {
    mockSettingsManagerDeps();

    const { providerProfilesSettings } = await import('../settings-manager');
    await providerProfilesSettings.update([
      ...providerProfilesSettings.get(),
      {
        id: 'user-provider',
        name: 'User Provider',
        providerType: 'openai-compatible',
        baseUrl: 'https://gateway.example.com/v1',
        apiKey: 'user-key',
        authType: 'bearer',
        imageApiCompatibility: 'openai-gpt-image',
        enabled: true,
        capabilities: {
          supportsModelsEndpoint: true,
          supportsText: true,
          supportsImage: true,
          supportsVideo: true,
          supportsAudio: true,
          supportsTools: true,
        },
        pricingGroup: 'business',
      },
    ]);

    vi.resetModules();
    mockSettingsManagerDeps();

    const reloaded = await import('../settings-manager');
    expect(
      reloaded.providerProfilesSettings
        .get()
        .find((profile) => profile.id === 'user-provider')
    ).toMatchObject({
      pricingGroup: 'business',
    });
  });

  it('migrates legacy For GPT image compatibility values to OpenAI GPT Image', async () => {
    mockSettingsManagerDeps();

    localStorage.setItem(
      DRAWNIX_SETTINGS_KEY,
      JSON.stringify({
        providerProfiles: [
          {
            id: 'legacy-for-profile',
            name: 'Legacy For Profile',
            providerType: 'openai-compatible',
            baseUrl: 'https://foropencode.com/v1',
            apiKey: 'legacy-key',
            authType: 'bearer',
            imageApiCompatibility: 'tuzi-gpt-image',
            enabled: true,
            capabilities: {},
          },
          {
            id: 'legacy-compatible-profile',
            name: 'Legacy Compatible Profile',
            providerType: 'openai-compatible',
            baseUrl: 'https://foropencode.com/v1',
            apiKey: 'legacy-key',
            authType: 'bearer',
            imageApiCompatibility: 'tuzi-compatible',
            enabled: true,
            capabilities: {},
          },
        ],
      })
    );

    const { providerProfilesSettings } = await import('../settings-manager');
    const profiles = providerProfilesSettings.get();

    expect(
      profiles.find((profile) => profile.id === 'legacy-for-profile')
    ).toMatchObject({
      imageApiCompatibility: 'openai-gpt-image',
    });
    expect(
      profiles.find((profile) => profile.id === 'legacy-compatible-profile')
    ).toMatchObject({
      imageApiCompatibility: 'openai-gpt-image',
    });
  });

  it('keeps the legacy default profile on OpenAI GPT Image compatibility', async () => {
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
            name: 'default group',
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

    const migratedProfile = providerProfilesSettings
      .get()
      .find((profile) => profile.id === LEGACY_DEFAULT_PROVIDER_PROFILE_ID);

    expect(migratedProfile).toMatchObject({
      imageApiCompatibility: 'openai-gpt-image',
    });
    expect(settingsManager.getSettings().migrations).toMatchObject({
      legacyDefaultImageApiCompatibilityV1: true,
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
    expect(reloaded.settingsManager.getSettings().migrations).toMatchObject({
      legacyDefaultImageApiCompatibilityV1: true,
    });
  });

  it('does not migrate legacy default compatibility when the default baseUrl is not ForOpenCode', async () => {
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
            name: 'default group',
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
    expect(settingsManager.getSettings().migrations).toMatchObject({
      legacyDefaultImageApiCompatibilityV1: true,
    });
  });

  it('migrates retired gpt-image-2-vip defaults to gpt-image-2', async () => {
    mockSettingsManagerDeps();

    localStorage.setItem(
      DRAWNIX_SETTINGS_KEY,
      JSON.stringify({
        gemini: {
          apiKey: 'legacy-key',
          baseUrl: 'https://foropencode.com/v1',
          imageModelName: 'gpt-image-2-vip',
        },
        providerCatalogs: [
          {
            profileId: 'legacy-default',
            discoveredAt: 123,
            discoveredModels: [
              {
                id: 'gpt-image-2',
                label: 'gpt-image-2',
                type: 'image',
                vendor: 'GPT',
              },
              {
                id: 'gpt-image-2-vip',
                label: 'gpt-image-2-vip',
                type: 'image',
                vendor: 'GPT',
              },
            ],
            selectedModelIds: ['gpt-image-2-vip'],
            sourceBaseUrl: 'https://foropencode.com/v1',
            error: null,
          },
        ],
        invocationPresets: [
          {
            id: 'default',
            name: 'Default',
            isDefault: true,
            text: {
              defaultModelRef: {
                profileId: 'legacy-default',
                modelId: 'gpt-5.5',
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
            audio: {
              defaultModelRef: {
                profileId: 'legacy-default',
                modelId: 'suno_music',
              },
            },
          },
        ],
      })
    );

    const {
      geminiSettings,
      getActiveInvocationPreset,
      getRouteModelId,
      providerCatalogsSettings,
      settingsManager,
    } = await import('../settings-manager');

    expect(geminiSettings.get().imageModelName).toBe('gpt-image-2');
    expect(getRouteModelId(getActiveInvocationPreset()?.image)).toBe(
      'gpt-image-2'
    );
    expect(
      providerCatalogsSettings.get()[0]?.selectedModelIds
    ).toEqual(['gpt-image-2']);

    await settingsManager.waitForInitialization();

    const storedSettings = JSON.parse(
      localStorage.getItem(DRAWNIX_SETTINGS_KEY) || '{}'
    );
    expect(storedSettings.gemini?.imageModelName).toBe('gpt-image-2');
    expect(
      storedSettings.providerCatalogs?.[0]?.selectedModelIds
    ).toEqual(['gpt-image-2']);
    expect(
      storedSettings.invocationPresets?.[0]?.image?.defaultModelRef?.modelId
    ).toBe('gpt-image-2');
  });
});
