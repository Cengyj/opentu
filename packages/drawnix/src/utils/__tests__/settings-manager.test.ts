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
            preferAsyncImageEndpoint: true,
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
    expect(isBuiltInDefaultProviderProfileId(LEGACY_DEFAULT_PROVIDER_PROFILE_ID)).toBe(
      true
    );
    expect(isBuiltInDefaultProviderProfileId(FOR_CODEX_PROVIDER_PROFILE_ID)).toBe(
      true
    );
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
      preferAsyncImageEndpoint: true,
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

  it('preserves managed profile async image preferences after reload', async () => {
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

    expect(legacyProfile).toMatchObject({
      preferAsyncImageEndpoint: true,
    });
    expect(forCodexProfile).toMatchObject({
      preferAsyncImageEndpoint: true,
    });

    await providerProfilesSettings.update(
      profiles.map((profile) => ({
        ...profile,
        preferAsyncImageEndpoint: false,
      }))
    );

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
      .find(
        (profile) => profile.id === reloaded.FOR_CODEX_PROVIDER_PROFILE_ID
      );

    expect(reloadedLegacyProfile).toMatchObject({
      preferAsyncImageEndpoint: false,
    });
    expect(reloadedForCodexProfile).toMatchObject({
      preferAsyncImageEndpoint: false,
    });
  });
});
