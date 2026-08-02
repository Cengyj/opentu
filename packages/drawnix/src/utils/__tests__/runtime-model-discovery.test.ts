import { beforeEach, describe, expect, it, vi } from 'vitest';

describe('runtime-model-discovery', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllGlobals();
  });

  const mockSettingsManager = ({
    catalogs = [],
    profiles = [],
  }: {
    catalogs?: Array<Record<string, unknown>>;
    profiles?: Array<Record<string, unknown>>;
  } = {}) => {
    vi.doMock('../settings-manager', () => ({
      LEGACY_DEFAULT_PROVIDER_PROFILE_ID: 'legacy-default',
      providerCatalogsSettings: {
        get: () => catalogs,
        addListener: () => {},
        removeListener: () => {},
        update: async () => {},
      },
      providerProfilesSettings: {
        get: () => profiles,
        addListener: () => {},
        removeListener: () => {},
      },
      invocationPresetsSettings: {
        addListener: () => {},
        removeListener: () => {},
      },
      settingsManager: {
        getSetting: () => ({}),
        addListener: () => {},
        removeListener: () => {},
      },
    }));
  };

  it('空 provider catalog 时文本选择器只展示精简默认模型', async () => {
    mockSettingsManager();

    const { getSelectableModels } = await import('../runtime-model-discovery');

    expect(getSelectableModels('text').map((model) => model.id)).toEqual([
      'gpt-5.6-sol',
      'gpt-5.6-terra',
      'gpt-5.6-luna',
    ]);
  });

  it('空 provider catalog 时图片选择器只展示 gpt-image-2', async () => {
    mockSettingsManager();

    const { getSelectableModels } = await import('../runtime-model-discovery');

    expect(getSelectableModels('image').map((model) => model.id)).toEqual([
      'gpt-image-2',
    ]);
  });

  it('空 provider catalog 时视频和音频选择器不展示默认模型', async () => {
    mockSettingsManager();

    const { getSelectableModels } = await import('../runtime-model-discovery');

    expect(getSelectableModels('video')).toEqual([]);
    expect(getSelectableModels('audio')).toEqual([]);
  });

  it('设置页 profile 模型候选同样使用精简默认展示列表', async () => {
    mockSettingsManager();

    const { getProfilePreferredModels } = await import(
      '../runtime-model-discovery'
    );

    expect(
      getProfilePreferredModels('legacy-default', 'text').map(
        (model) => model.id
      )
    ).toEqual(['gpt-5.6-sol', 'gpt-5.6-terra', 'gpt-5.6-luna']);
    expect(
      getProfilePreferredModels('legacy-default', 'image').map(
        (model) => model.id
      )
    ).toEqual(['gpt-image-2']);
    expect(getProfilePreferredModels('legacy-default', 'video')).toEqual([]);
    expect(getProfilePreferredModels('legacy-default', 'audio')).toEqual([]);
  });

  it('显式静态文本选择可 pin，其他类型仍受默认展示限制', async () => {
    mockSettingsManager();

    const { getPinnedSelectableModel } = await import(
      '../runtime-model-discovery'
    );

    expect(getPinnedSelectableModel('text', 'gpt-5.5')).toMatchObject({
      id: 'gpt-5.5',
    });
    expect(getPinnedSelectableModel('text', 'gpt-5.4')).toMatchObject({
      id: 'gpt-5.4',
    });
    expect(getPinnedSelectableModel('text', 'gpt-5.4-mini')).toMatchObject({
      id: 'gpt-5.4-mini',
    });
    expect(getPinnedSelectableModel('image', 'gpt-image-2')).toMatchObject({
      id: 'gpt-image-2',
    });
    expect(getPinnedSelectableModel('image', 'gpt-image-2-vip')).toBeNull();
    expect(getPinnedSelectableModel('video', 'seedance-1.5-pro')).toBeNull();
    expect(getPinnedSelectableModel('audio', 'suno_music')).toBeNull();
  });

  it('供应商模式只展示用户已选择的运行时模型', async () => {
    mockSettingsManager({
      profiles: [
        {
          id: 'custom-provider',
          name: 'Custom Provider',
          enabled: true,
        },
      ],
      catalogs: [
        {
          profileId: 'custom-provider',
          discoveredAt: Date.now(),
          discoveredModels: [
            {
              id: 'custom-text-model',
              label: 'Custom Text Model',
              shortLabel: 'Custom Text Model',
              type: 'text',
              vendor: 'OTHER',
            },
            {
              id: 'custom-video-model',
              label: 'Custom Video Model',
              shortLabel: 'Custom Video Model',
              type: 'video',
              vendor: 'OTHER',
            },
            {
              id: 'unselected-text-model',
              label: 'Unselected Text Model',
              type: 'text',
              vendor: 'OTHER',
            },
          ],
          selectedModelIds: ['custom-text-model', 'custom-video-model'],
        },
      ],
    });

    const { getSelectableModels } = await import('../runtime-model-discovery');

    expect(getSelectableModels('text').map((model) => model.id)).toEqual([
      'custom-text-model',
    ]);
    expect(getSelectableModels('video').map((model) => model.id)).toEqual([
      'custom-video-model',
    ]);
    expect(getSelectableModels('image')).toEqual([]);
    expect(getSelectableModels('audio')).toEqual([]);
  });

  it('供应商明确选择旧 GPT 模型后仍可显示和使用', async () => {
    mockSettingsManager({
      profiles: [
        {
          id: 'custom-provider',
          name: 'Custom Provider',
          enabled: true,
        },
      ],
      catalogs: [
        {
          profileId: 'custom-provider',
          discoveredAt: Date.now(),
          discoveredModels: [
            {
              id: 'gpt-5.5',
              label: 'gpt-5.5',
              type: 'text',
              vendor: 'OTHER',
            },
            {
              id: 'gpt-5.4',
              label: 'gpt-5.4',
              type: 'text',
              vendor: 'OTHER',
            },
          ],
          selectedModelIds: ['gpt-5.5', 'gpt-5.4'],
        },
      ],
    });

    const { getSelectableModels } = await import('../runtime-model-discovery');
    const selectableModels = getSelectableModels('text');

    expect(selectableModels.map((model) => model.id).sort()).toEqual([
      'gpt-5.4',
      'gpt-5.5',
    ]);
    expect(selectableModels.map((model) => model.selectionKey).sort()).toEqual([
      'custom-provider::gpt-5.4',
      'custom-provider::gpt-5.5',
    ]);
  });

  it('多供应商只合并启用供应商的已选模型', async () => {
    mockSettingsManager({
      profiles: [
        { id: 'provider-a', name: 'Provider A', enabled: true },
        { id: 'provider-b', name: 'Provider B', enabled: true },
        { id: 'provider-disabled', name: 'Disabled', enabled: false },
      ],
      catalogs: [
        {
          profileId: 'provider-a',
          discoveredAt: Date.now(),
          discoveredModels: [
            {
              id: 'shared-model',
              label: 'Shared A',
              type: 'text',
              vendor: 'OTHER',
            },
            {
              id: 'a-unselected',
              label: 'A Unselected',
              type: 'text',
              vendor: 'OTHER',
            },
          ],
          selectedModelIds: ['shared-model'],
        },
        {
          profileId: 'provider-b',
          discoveredAt: Date.now(),
          discoveredModels: [
            {
              id: 'shared-model',
              label: 'Shared B',
              type: 'text',
              vendor: 'OTHER',
            },
            {
              id: 'provider-b-model',
              label: 'Provider B Model',
              type: 'text',
              vendor: 'OTHER',
            },
          ],
          selectedModelIds: ['shared-model', 'provider-b-model'],
        },
        {
          profileId: 'provider-disabled',
          discoveredAt: Date.now(),
          discoveredModels: [
            {
              id: 'disabled-model',
              label: 'Disabled Model',
              type: 'text',
              vendor: 'OTHER',
            },
          ],
          selectedModelIds: ['disabled-model'],
        },
      ],
    });

    const { getPinnedSelectableModel, getSelectableModels } = await import(
      '../runtime-model-discovery'
    );
    const selectableModels = getSelectableModels('text');

    expect(selectableModels.map((model) => model.selectionKey).sort()).toEqual([
      'provider-a::shared-model',
      'provider-b::provider-b-model',
      'provider-b::shared-model',
    ]);
    expect(
      getPinnedSelectableModel('text', 'disabled-model', {
        profileId: 'provider-disabled',
        modelId: 'disabled-model',
      })
    ).toBeNull();
    expect(getPinnedSelectableModel('text', 'shared-model')).toBeNull();
  });

  it('用户选择的 GPT-5.6 运行时模型保留供应商来源', async () => {
    mockSettingsManager({
      profiles: [
        {
          id: 'custom-provider',
          name: 'Custom Provider',
          enabled: true,
        },
      ],
      catalogs: [
        {
          profileId: 'custom-provider',
          discoveredAt: Date.now(),
          discoveredModels: [
            {
              id: 'gpt-5.6-terra',
              label: 'gpt-5.6-terra',
              type: 'text',
              vendor: 'OTHER',
            },
          ],
          selectedModelIds: ['gpt-5.6-terra'],
        },
      ],
    });

    const { getSelectableModels, runtimeModelDiscovery } = await import(
      '../runtime-model-discovery'
    );
    const runtimeModel = getSelectableModels('text').find(
      (model) => model.selectionKey === 'custom-provider::gpt-5.6-terra'
    );

    expect(runtimeModel).toMatchObject({
      id: 'gpt-5.6-terra',
      label: 'GPT-5.6 Terra',
      type: 'text',
      vendor: 'GPT',
      sourceProfileId: 'custom-provider',
      selectionKey: 'custom-provider::gpt-5.6-terra',
    });
    expect(
      runtimeModelDiscovery.getSelectedModelIds('custom-provider')
    ).toEqual(['gpt-5.6-terra']);
  });

  it('新密钥目录生效后不会把旧密钥模型重新钉回选择器', async () => {
    mockSettingsManager({
      profiles: [
        {
          id: 'custom-provider',
          name: 'Custom Provider',
          enabled: true,
        },
      ],
      catalogs: [
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
    });

    const { getPinnedSelectableModel, getSelectableModels } = await import(
      '../runtime-model-discovery'
    );

    expect(getSelectableModels('text').map((model) => model.id)).toEqual([
      'new-key-text-model',
    ]);
    expect(
      getPinnedSelectableModel('text', 'old-key-text-model', {
        profileId: 'custom-provider',
        modelId: 'old-key-text-model',
      })
    ).toBeNull();
    expect(getPinnedSelectableModel('text', 'gpt-5.6-sol')).toBeNull();
  });

  it('清空供应商凭据和目录后恢复内置默认展示', async () => {
    mockSettingsManager({
      profiles: [
        {
          id: 'custom-provider',
          name: 'Custom Provider',
          enabled: true,
        },
      ],
      catalogs: [
        {
          profileId: 'custom-provider',
          discoveredAt: Date.now(),
          signature: 'old-key-signature',
          discoveredModels: [
            {
              id: 'old-key-text-model',
              label: 'Old Key Text Model',
              type: 'text',
              vendor: 'OTHER',
            },
          ],
          selectedModelIds: ['old-key-text-model'],
        },
      ],
    });

    const { getSelectableModels, runtimeModelDiscovery } = await import(
      '../runtime-model-discovery'
    );

    runtimeModelDiscovery.invalidateIfConfigChanged(
      'custom-provider',
      'https://api.example.com/v1',
      '',
      {
        force: true,
        targetProviderType: 'openai-compatible',
      }
    );

    expect(runtimeModelDiscovery.isProviderSelectionMode()).toBe(false);
    expect(getSelectableModels('text').map((model) => model.id)).toEqual([
      'gpt-5.6-sol',
      'gpt-5.6-terra',
      'gpt-5.6-luna',
    ]);
  });

  it('没有获取过模型目录的供应商仍允许保留手工模型引用', async () => {
    mockSettingsManager({
      profiles: [
        {
          id: 'manual-provider',
          name: 'Manual Provider',
          enabled: true,
        },
      ],
    });

    const { getPinnedSelectableModel } = await import(
      '../runtime-model-discovery'
    );

    expect(
      getPinnedSelectableModel('text', 'manual-text-model', {
        profileId: 'manual-provider',
        modelId: 'manual-text-model',
      })
    ).toMatchObject({
      id: 'manual-text-model',
      sourceProfileId: 'manual-provider',
    });
  });

  it('密钥改变后立即废弃旧目录，不等待下一次获取模型成功', async () => {
    mockSettingsManager({
      profiles: [
        {
          id: 'custom-provider',
          name: 'Custom Provider',
          enabled: true,
        },
      ],
      catalogs: [
        {
          profileId: 'custom-provider',
          discoveredAt: Date.now(),
          sourceBaseUrl: 'https://api.example.com/v1',
          discoveredModels: [
            {
              id: 'old-key-text-model',
              label: 'Old Key Text Model',
              type: 'text',
              vendor: 'OTHER',
            },
          ],
          selectedModelIds: ['old-key-text-model'],
        },
      ],
    });

    const { getPinnedSelectableModel, runtimeModelDiscovery } = await import(
      '../runtime-model-discovery'
    );

    runtimeModelDiscovery.invalidateIfConfigChanged(
      'custom-provider',
      'https://api.example.com/v1',
      'new-key',
      {
        force: true,
        targetProviderType: 'openai-compatible',
      }
    );

    const state = runtimeModelDiscovery.getState('custom-provider');
    expect(state.discoveredModels).toEqual([]);
    expect(state.selectedModelIds).toEqual([]);
    expect(state.signature).not.toBe('');
    expect(
      getPinnedSelectableModel('text', 'old-key-text-model', {
        profileId: 'custom-provider',
        modelId: 'old-key-text-model',
      })
    ).toBeNull();
  });

  it('不会把图片模型钉到音频类型列表里', async () => {
    vi.doMock('../settings-manager', () => ({
      LEGACY_DEFAULT_PROVIDER_PROFILE_ID: 'legacy-default',
      providerCatalogsSettings: {
        get: () => [
          {
            profileId: 'provider-image',
            discoveredAt: Date.now(),
            discoveredModels: [
              {
                id: 'gemini-3-pro-image-preview',
                label: 'Gemini Image',
                shortLabel: 'Gemini Image',
                shortCode: 'gmi',
                type: 'image',
                vendor: 'GEMINI',
              },
            ],
            selectedModelIds: ['gemini-3-pro-image-preview'],
          },
        ],
        addListener: () => {},
        removeListener: () => {},
        update: async () => {},
      },
      providerProfilesSettings: {
        get: () => [
          {
            id: 'provider-image',
            name: '图片供应商',
            enabled: true,
          },
        ],
        addListener: () => {},
        removeListener: () => {},
      },
      invocationPresetsSettings: {
        addListener: () => {},
        removeListener: () => {},
      },
      settingsManager: {
        getSetting: () => ({}),
        addListener: () => {},
        removeListener: () => {},
      },
    }));

    const { getPinnedSelectableModel } = await import(
      '../runtime-model-discovery'
    );

    expect(
      getPinnedSelectableModel('audio', 'gemini-3-pro-image-preview', {
        profileId: 'provider-image',
        modelId: 'gemini-3-pro-image-preview',
      })
    ).toBeNull();
  });

  it('auto 模式定向隔离旧图片目录证据并保留用户选择', async () => {
    mockSettingsManager({
      profiles: [
        {
          id: 'auto-provider',
          name: 'Auto Provider',
          providerType: 'auto',
          baseUrl: 'https://provider.example.com/v1',
          apiKey: '',
          enabled: true,
        },
      ],
      catalogs: [
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
            {
              id: 'legacy-text-model',
              label: 'Legacy Text Model',
              type: 'text',
              vendor: 'OTHER',
            },
          ],
          selectedModelIds: ['legacy-image-model', 'legacy-text-model'],
        },
      ],
    });

    const { runtimeModelDiscovery } = await import(
      '../runtime-model-discovery'
    );
    const state = runtimeModelDiscovery.getState('auto-provider');

    expect(state.discoveredModels.map((model) => model.id)).toEqual([
      'legacy-text-model',
    ]);
    expect(state.selectedModelIds).toEqual([
      'legacy-image-model',
      'legacy-text-model',
    ]);
    expect(
      runtimeModelDiscovery.getCatalogs(['auto-provider'])[0].selectedModelIds
    ).toEqual(['legacy-image-model', 'legacy-text-model']);
  });

  it('auto 模式接受当前版本且匹配当前凭据的图片目录证据', async () => {
    const {
      buildProviderCatalogDiscoverySignature,
      IMAGE_ROUTING_EVIDENCE_VERSION,
    } = await import('../image-routing-evidence');
    const baseUrl = 'https://provider.example.com/v1';
    const apiKey = 'current-key';
    mockSettingsManager({
      profiles: [
        {
          id: 'auto-provider',
          name: 'Auto Provider',
          providerType: 'auto',
          baseUrl,
          apiKey,
          enabled: true,
        },
      ],
      catalogs: [
        {
          profileId: 'auto-provider',
          routingEvidenceVersion: IMAGE_ROUTING_EVIDENCE_VERSION,
          discoveredAt: Date.now(),
          sourceBaseUrl: baseUrl,
          signature: buildProviderCatalogDiscoverySignature(baseUrl, apiKey),
          discoveredModels: [
            {
              id: 'current-image-model',
              label: 'Current Image Model',
              type: 'image',
              vendor: 'OTHER',
            },
          ],
          selectedModelIds: ['current-image-model'],
        },
      ],
    });

    const { runtimeModelDiscovery } = await import(
      '../runtime-model-discovery'
    );

    expect(
      runtimeModelDiscovery
        .getDiscoveredModels('auto-provider', 'image')
        .map((model) => model.id)
    ).toEqual(['current-image-model']);
  });

  it('凭据变化后原子刷新 auto 图片证据并恢复原模型选择', async () => {
    const {
      buildProviderCatalogDiscoverySignature,
      IMAGE_ROUTING_EVIDENCE_VERSION,
    } = await import('../image-routing-evidence');
    const baseUrl = 'https://provider.example.com/v1';
    const apiKey = 'current-key';
    const persistedCatalogs: Array<Array<Record<string, unknown>>> = [];
    const fetchMock = vi.fn(async () => ({
      ok: true,
      text: async () =>
        JSON.stringify({
          data: [{ id: 'selected-image-model', category: 'image' }],
        }),
    }));
    vi.stubGlobal('fetch', fetchMock);
    vi.doMock('../settings-manager', () => ({
      LEGACY_DEFAULT_PROVIDER_PROFILE_ID: 'legacy-default',
      providerCatalogsSettings: {
        get: () => [
          {
            profileId: 'auto-provider',
            routingEvidenceVersion: IMAGE_ROUTING_EVIDENCE_VERSION,
            discoveredAt: 123,
            sourceBaseUrl: baseUrl,
            signature: buildProviderCatalogDiscoverySignature(
              baseUrl,
              'previous-key'
            ),
            discoveredModels: [
              {
                id: 'selected-image-model',
                label: 'Selected Image Model',
                type: 'image',
                vendor: 'OTHER',
              },
            ],
            selectedModelIds: ['selected-image-model'],
          },
        ],
        addListener: vi.fn(),
        removeListener: vi.fn(),
        update: async (catalogs: Array<Record<string, unknown>>) => {
          persistedCatalogs.push(catalogs);
        },
      },
      providerProfilesSettings: {
        get: () => [
          {
            id: 'auto-provider',
            name: 'Auto Provider',
            providerType: 'auto',
            baseUrl,
            apiKey,
            enabled: true,
          },
        ],
        addListener: vi.fn(),
        removeListener: vi.fn(),
      },
      invocationPresetsSettings: {
        addListener: vi.fn(),
        removeListener: vi.fn(),
      },
      settingsManager: {
        getSetting: () => ({}),
        addListener: vi.fn(),
        removeListener: vi.fn(),
        waitForInitialization: () => Promise.resolve(),
      },
    }));

    const { runtimeModelDiscovery } = await import(
      '../runtime-model-discovery'
    );

    await vi.waitFor(() => expect(persistedCatalogs).toHaveLength(1));
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(runtimeModelDiscovery.getState('auto-provider').signature).toBe(
      buildProviderCatalogDiscoverySignature(baseUrl, apiKey)
    );
    expect(runtimeModelDiscovery.getSelectedModelIds('auto-provider')).toEqual([
      'selected-image-model',
    ]);
    expect(persistedCatalogs[0][0]).toMatchObject({
      routingEvidenceVersion: IMAGE_ROUTING_EVIDENCE_VERSION,
      signature: buildProviderCatalogDiscoverySignature(baseUrl, apiKey),
      selectedModelIds: ['selected-image-model'],
    });
  });

  it('启动时刷新没有签名和选择的 legacy image-only 目录', async () => {
    const baseUrl = 'https://provider.example.com/v1';
    const apiKey = 'current-key';
    const fetchMock = vi.fn(async () => ({
      ok: true,
      text: async () =>
        JSON.stringify({
          data: [{ id: 'legacy-image-model', category: 'image' }],
        }),
    }));
    vi.stubGlobal('fetch', fetchMock);
    mockSettingsManager({
      profiles: [
        {
          id: 'auto-provider',
          name: 'Auto Provider',
          providerType: 'auto',
          baseUrl,
          apiKey,
          enabled: true,
        },
      ],
      catalogs: [
        {
          profileId: 'auto-provider',
          discoveredAt: 123,
          sourceBaseUrl: baseUrl,
          discoveredModels: [
            {
              id: 'legacy-image-model',
              label: 'Legacy Image Model',
              type: 'image',
              vendor: 'OTHER',
            },
          ],
          selectedModelIds: [],
        },
      ],
    });

    const {
      buildProviderCatalogDiscoverySignature,
      IMAGE_ROUTING_EVIDENCE_VERSION,
    } = await import('../image-routing-evidence');
    const { runtimeModelDiscovery } = await import(
      '../runtime-model-discovery'
    );

    await vi.waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(runtimeModelDiscovery.getState('auto-provider')).toMatchObject({
        routingEvidenceVersion: IMAGE_ROUTING_EVIDENCE_VERSION,
        signature: buildProviderCatalogDiscoverySignature(baseUrl, apiKey),
      });
    });
    expect(
      runtimeModelDiscovery.getState('auto-provider').staleImageCatalogSnapshot
    ).toBeUndefined();
  });

  it('旧 auto 图片证据刷新失败时不会删除目录、选择或 Profile 配置', async () => {
    const profile = {
      id: 'auto-provider',
      name: 'Auto Provider',
      providerType: 'auto',
      baseUrl: 'https://provider.example.com/v1',
      apiKey: 'current-key',
      authType: 'query',
      extraHeaders: { 'X-Tenant': 'tenant-a' },
      enabled: true,
    };
    const persistedCatalogs: Array<Array<Record<string, unknown>>> = [];
    const fetchMock = vi.fn(async () => ({
      ok: false,
      status: 503,
      text: async () => JSON.stringify({ error: 'catalog unavailable' }),
    }));
    vi.stubGlobal('fetch', fetchMock);
    vi.doMock('../settings-manager', () => ({
      LEGACY_DEFAULT_PROVIDER_PROFILE_ID: 'legacy-default',
      providerCatalogsSettings: {
        get: () => [
          {
            profileId: profile.id,
            discoveredAt: 123,
            sourceBaseUrl: profile.baseUrl,
            signature: 'legacy-catalog-signature',
            discoveredModels: [
              {
                id: 'selected-image-model',
                label: 'Selected Image Model',
                type: 'image',
                vendor: 'OTHER',
              },
            ],
            selectedModelIds: ['selected-image-model'],
          },
        ],
        addListener: vi.fn(),
        removeListener: vi.fn(),
        update: async (catalogs: Array<Record<string, unknown>>) => {
          persistedCatalogs.push(catalogs);
        },
      },
      providerProfilesSettings: {
        get: () => [profile],
        addListener: vi.fn(),
        removeListener: vi.fn(),
      },
      invocationPresetsSettings: {
        addListener: vi.fn(),
        removeListener: vi.fn(),
      },
      settingsManager: {
        getSetting: () => ({}),
        addListener: vi.fn(),
        removeListener: vi.fn(),
        waitForInitialization: () => Promise.resolve(),
      },
    }));

    const { runtimeModelDiscovery } = await import(
      '../runtime-model-discovery'
    );

    await vi.waitFor(() => expect(persistedCatalogs).toHaveLength(1));
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(runtimeModelDiscovery.getState(profile.id)).toMatchObject({
      status: 'error',
      selectedModelIds: ['selected-image-model'],
    });
    expect(persistedCatalogs[0][0]).toMatchObject({
      discoveredAt: 123,
      discoveredModels: [{ id: 'selected-image-model', type: 'image' }],
      selectedModelIds: ['selected-image-model'],
      sourceBaseUrl: 'https://provider.example.com/v1',
      signature: 'legacy-catalog-signature',
    });
    expect(profile).toEqual({
      id: 'auto-provider',
      name: 'Auto Provider',
      providerType: 'auto',
      baseUrl: 'https://provider.example.com/v1',
      apiKey: 'current-key',
      authType: 'query',
      extraHeaders: { 'X-Tenant': 'tenant-a' },
      enabled: true,
    });
  });

  it('运行时修改 auto Profile 凭据后自动刷新目录证据并保留仍存在的模型选择', async () => {
    const {
      buildProviderCatalogDiscoverySignature,
      IMAGE_ROUTING_EVIDENCE_VERSION,
    } = await import('../image-routing-evidence');
    const baseUrl = 'https://provider.example.com/v1';
    const previousApiKey = 'previous-key';
    const nextApiKey = 'next-key';
    const profiles = [
      {
        id: 'auto-provider',
        name: 'Auto Provider',
        providerType: 'auto',
        baseUrl,
        apiKey: previousApiKey,
        enabled: true,
      },
    ];
    let profileListener: (() => void) | undefined;
    const persistedCatalogs: Array<Array<Record<string, unknown>>> = [];
    const fetchMock = vi.fn(async () => ({
      ok: true,
      text: async () =>
        JSON.stringify({
          data: [{ id: 'selected-image-model', category: 'image' }],
        }),
    }));
    vi.stubGlobal('fetch', fetchMock);
    vi.doMock('../settings-manager', () => ({
      LEGACY_DEFAULT_PROVIDER_PROFILE_ID: 'legacy-default',
      providerCatalogsSettings: {
        get: () => [
          {
            profileId: 'auto-provider',
            routingEvidenceVersion: IMAGE_ROUTING_EVIDENCE_VERSION,
            discoveredAt: 123,
            sourceBaseUrl: baseUrl,
            signature: buildProviderCatalogDiscoverySignature(
              baseUrl,
              previousApiKey
            ),
            discoveredModels: [
              {
                id: 'selected-image-model',
                label: 'Selected Image Model',
                type: 'image',
                vendor: 'OTHER',
              },
            ],
            selectedModelIds: ['selected-image-model'],
          },
        ],
        addListener: vi.fn(),
        removeListener: vi.fn(),
        update: async (catalogs: Array<Record<string, unknown>>) => {
          persistedCatalogs.push(catalogs);
        },
      },
      providerProfilesSettings: {
        get: () => profiles,
        addListener: (listener: () => void) => {
          profileListener = listener;
        },
        removeListener: vi.fn(),
      },
      invocationPresetsSettings: {
        addListener: vi.fn(),
        removeListener: vi.fn(),
      },
      settingsManager: {
        getSetting: () => ({}),
        addListener: vi.fn(),
        removeListener: vi.fn(),
        waitForInitialization: () => Promise.resolve(),
      },
    }));

    const { runtimeModelDiscovery } = await import(
      '../runtime-model-discovery'
    );
    await Promise.resolve();
    expect(fetchMock).not.toHaveBeenCalled();

    profiles[0] = { ...profiles[0], name: 'Renamed Provider' };
    profileListener?.();
    await Promise.resolve();
    expect(fetchMock).not.toHaveBeenCalled();

    profiles[0] = { ...profiles[0], apiKey: nextApiKey };
    profileListener?.();

    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    await vi.waitFor(() =>
      expect(runtimeModelDiscovery.getState('auto-provider')).toMatchObject({
        status: 'ready',
        signature: buildProviderCatalogDiscoverySignature(baseUrl, nextApiKey),
        selectedModelIds: ['selected-image-model'],
      })
    );
    expect(fetchMock).toHaveBeenCalledWith(`${baseUrl}/models`, {
      headers: { Authorization: `Bearer ${nextApiKey}` },
      signal: expect.any(AbortSignal),
    });
    expect(persistedCatalogs).toHaveLength(1);
  });

  it('同一 Profile 的旧凭据目录请求晚到时不会覆盖较新的成功结果', async () => {
    const pendingResponses = new Map<
      string,
      (response: { ok: true; text: () => Promise<string> }) => void
    >();
    const fetchMock = vi.fn(
      (_url: string, init?: { headers?: { Authorization?: string } }) =>
        new Promise<{ ok: true; text: () => Promise<string> }>((resolve) => {
          const authorization = init?.headers?.Authorization || '';
          pendingResponses.set(authorization, resolve);
        })
    );
    vi.stubGlobal('fetch', fetchMock);
    mockSettingsManager();

    const { runtimeModelDiscovery } = await import(
      '../runtime-model-discovery'
    );
    const oldDiscovery = runtimeModelDiscovery.discover(
      'provider-image',
      'https://api.example.com/v1',
      'old-key'
    );
    const newDiscovery = runtimeModelDiscovery.discover(
      'provider-image',
      'https://api.example.com/v1',
      'new-key'
    );

    pendingResponses.get('Bearer new-key')?.({
      ok: true,
      text: async () =>
        JSON.stringify({ data: [{ id: 'new-image', category: 'image' }] }),
    });
    await newDiscovery;
    pendingResponses.get('Bearer old-key')?.({
      ok: true,
      text: async () =>
        JSON.stringify({ data: [{ id: 'old-image', category: 'image' }] }),
    });
    await oldDiscovery;

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(
      runtimeModelDiscovery
        .getDiscoveredModels('provider-image')
        .map((model) => model.id)
    ).toEqual(['new-image']);
  });

  it('同一 Profile 的旧凭据目录请求晚到失败时不会把较新的成功结果改成错误', async () => {
    const pendingResponses = new Map<
      string,
      {
        resolve: (response: { ok: true; text: () => Promise<string> }) => void;
        reject: (error: Error) => void;
      }
    >();
    const fetchMock = vi.fn(
      (_url: string, init?: { headers?: { Authorization?: string } }) =>
        new Promise<{ ok: true; text: () => Promise<string> }>(
          (resolve, reject) => {
            const authorization = init?.headers?.Authorization || '';
            pendingResponses.set(authorization, { resolve, reject });
          }
        )
    );
    vi.stubGlobal('fetch', fetchMock);
    mockSettingsManager();

    const { runtimeModelDiscovery } = await import(
      '../runtime-model-discovery'
    );
    const oldDiscovery = runtimeModelDiscovery.discover(
      'provider-image',
      'https://api.example.com/v1',
      'old-key'
    );
    const newDiscovery = runtimeModelDiscovery.discover(
      'provider-image',
      'https://api.example.com/v1',
      'new-key'
    );

    pendingResponses.get('Bearer new-key')?.resolve({
      ok: true,
      text: async () =>
        JSON.stringify({ data: [{ id: 'new-image', category: 'image' }] }),
    });
    await newDiscovery;
    pendingResponses
      .get('Bearer old-key')
      ?.reject(new Error('old credential rejected'));

    await expect(oldDiscovery).resolves.toMatchObject([{ id: 'new-image' }]);
    expect(runtimeModelDiscovery.getState('provider-image')).toMatchObject({
      status: 'ready',
      error: null,
      discoveredModels: [{ id: 'new-image' }],
    });
  });

  it('清空 auto Profile 凭据会立即隔离图片目录且不会启动网络刷新', async () => {
    const {
      buildProviderCatalogDiscoverySignature,
      IMAGE_ROUTING_EVIDENCE_VERSION,
    } = await import('../image-routing-evidence');
    const baseUrl = 'https://provider.example.com/v1';
    const profiles = [
      {
        id: 'auto-provider',
        name: 'Auto Provider',
        providerType: 'auto',
        baseUrl,
        apiKey: 'current-key',
        enabled: true,
      },
    ];
    let profileListener: (() => void) | undefined;
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    vi.doMock('../settings-manager', () => ({
      LEGACY_DEFAULT_PROVIDER_PROFILE_ID: 'legacy-default',
      providerCatalogsSettings: {
        get: () => [
          {
            profileId: 'auto-provider',
            routingEvidenceVersion: IMAGE_ROUTING_EVIDENCE_VERSION,
            discoveredAt: 123,
            sourceBaseUrl: baseUrl,
            signature: buildProviderCatalogDiscoverySignature(
              baseUrl,
              'current-key'
            ),
            discoveredModels: [
              {
                id: 'selected-image-model',
                label: 'Selected Image Model',
                type: 'image',
                vendor: 'OTHER',
              },
            ],
            selectedModelIds: ['selected-image-model'],
          },
        ],
        addListener: vi.fn(),
        removeListener: vi.fn(),
        update: vi.fn(() => Promise.resolve()),
      },
      providerProfilesSettings: {
        get: () => profiles,
        addListener: (listener: () => void) => {
          profileListener = listener;
        },
        removeListener: vi.fn(),
      },
      invocationPresetsSettings: {
        addListener: vi.fn(),
        removeListener: vi.fn(),
      },
      settingsManager: {
        getSetting: () => ({}),
        addListener: vi.fn(),
        removeListener: vi.fn(),
        waitForInitialization: () => Promise.resolve(),
      },
    }));

    const { getPinnedSelectableModel, runtimeModelDiscovery } = await import(
      '../runtime-model-discovery'
    );
    profiles[0] = { ...profiles[0], apiKey: '' };
    profileListener?.();
    await Promise.resolve();

    expect(fetchMock).not.toHaveBeenCalled();
    expect(
      runtimeModelDiscovery.getDiscoveredModels('auto-provider', 'image')
    ).toEqual([]);
    expect(
      getPinnedSelectableModel('image', 'selected-image-model', {
        profileId: 'auto-provider',
        modelId: 'selected-image-model',
      })
    ).toBeNull();
    expect(runtimeModelDiscovery.getSelectedModelIds('auto-provider')).toEqual([
      'selected-image-model',
    ]);
  });

  it('设置保存边界使 auto Profile 凭据失效时保留待重新确认的模型选择', async () => {
    const {
      buildProviderCatalogDiscoverySignature,
      IMAGE_ROUTING_EVIDENCE_VERSION,
    } = await import('../image-routing-evidence');
    const baseUrl = 'https://provider.example.com/v1';
    mockSettingsManager({
      profiles: [
        {
          id: 'auto-provider',
          name: 'Auto Provider',
          providerType: 'auto',
          baseUrl,
          apiKey: 'previous-key',
          enabled: true,
        },
      ],
      catalogs: [
        {
          profileId: 'auto-provider',
          routingEvidenceVersion: IMAGE_ROUTING_EVIDENCE_VERSION,
          discoveredAt: 123,
          sourceBaseUrl: baseUrl,
          signature: buildProviderCatalogDiscoverySignature(
            baseUrl,
            'previous-key'
          ),
          discoveredModels: [
            {
              id: 'selected-image-model',
              label: 'Selected Image Model',
              type: 'image',
              vendor: 'OTHER',
            },
          ],
          selectedModelIds: ['selected-image-model'],
        },
      ],
    });

    const { runtimeModelDiscovery } = await import(
      '../runtime-model-discovery'
    );
    runtimeModelDiscovery.invalidateIfConfigChanged(
      'auto-provider',
      baseUrl,
      'next-key',
      {
        force: true,
        targetProviderType: 'auto',
      }
    );

    expect(runtimeModelDiscovery.getState('auto-provider')).toMatchObject({
      status: 'idle',
      discoveredModels: [],
      selectedModelIds: ['selected-image-model'],
      signature: buildProviderCatalogDiscoverySignature(baseUrl, 'next-key'),
    });
    expect(
      runtimeModelDiscovery.getCatalogs(['auto-provider'])[0]
    ).toMatchObject({
      discoveredAt: 123,
      discoveredModels: [{ id: 'selected-image-model', type: 'image' }],
      selectedModelIds: ['selected-image-model'],
      signature: buildProviderCatalogDiscoverySignature(
        baseUrl,
        'previous-key'
      ),
    });
  });

  it('同次保存从手动接口切到 auto 并轮换凭据时按目标配置保留模型选择', async () => {
    const {
      buildProviderCatalogDiscoverySignature,
      IMAGE_ROUTING_EVIDENCE_VERSION,
    } = await import('../image-routing-evidence');
    const baseUrl = 'https://provider.example.com/v1';
    mockSettingsManager({
      profiles: [
        {
          id: 'switching-provider',
          name: 'Switching Provider',
          providerType: 'openai-compatible',
          baseUrl,
          apiKey: 'previous-key',
          enabled: true,
        },
      ],
      catalogs: [
        {
          profileId: 'switching-provider',
          routingEvidenceVersion: IMAGE_ROUTING_EVIDENCE_VERSION,
          discoveredAt: 123,
          sourceBaseUrl: baseUrl,
          signature: buildProviderCatalogDiscoverySignature(
            baseUrl,
            'previous-key'
          ),
          discoveredModels: [
            {
              id: 'selected-image-model',
              label: 'Selected Image Model',
              type: 'image',
              vendor: 'OTHER',
            },
          ],
          selectedModelIds: ['selected-image-model'],
        },
      ],
    });

    const { runtimeModelDiscovery } = await import(
      '../runtime-model-discovery'
    );
    runtimeModelDiscovery.invalidateIfConfigChanged(
      'switching-provider',
      baseUrl,
      'next-key',
      {
        force: true,
        targetProviderType: 'auto',
      }
    );

    expect(runtimeModelDiscovery.getState('switching-provider')).toMatchObject({
      status: 'idle',
      discoveredModels: [],
      selectedModelIds: ['selected-image-model'],
      signature: buildProviderCatalogDiscoverySignature(baseUrl, 'next-key'),
    });
  });

  it('清空目录会使尚未完成的发现失效且晚到结果不能恢复已清空目录', async () => {
    let discoverySignal: AbortSignal | undefined;
    let resolveFetch:
      | ((response: { ok: true; text: () => Promise<string> }) => void)
      | undefined;
    vi.stubGlobal(
      'fetch',
      vi.fn(
        (_url: string, init?: { signal?: AbortSignal }) =>
          new Promise<{ ok: true; text: () => Promise<string> }>((resolve) => {
            discoverySignal = init?.signal;
            resolveFetch = resolve;
          })
      )
    );
    mockSettingsManager();

    const { runtimeModelDiscovery } = await import(
      '../runtime-model-discovery'
    );
    const discovery = runtimeModelDiscovery.discover(
      'provider-image',
      'https://api.example.com/v1',
      'current-key'
    );
    runtimeModelDiscovery.clear('provider-image');
    expect(discoverySignal?.aborted).toBe(true);
    resolveFetch?.({
      ok: true,
      text: async () =>
        JSON.stringify({ data: [{ id: 'late-image', category: 'image' }] }),
    });
    await discovery;

    expect(runtimeModelDiscovery.getState('provider-image')).toMatchObject({
      status: 'idle',
      discoveredModels: [],
      selectedModelIds: [],
    });
  });

  it('同一 Profile 和凭据的并发目录发现只发送一次请求', async () => {
    let resolveFetch:
      | ((response: { ok: true; text: () => Promise<string> }) => void)
      | undefined;
    const fetchMock = vi.fn(
      () =>
        new Promise<{ ok: true; text: () => Promise<string> }>((resolve) => {
          resolveFetch = resolve;
        })
    );
    vi.stubGlobal('fetch', fetchMock);
    mockSettingsManager();

    const { runtimeModelDiscovery } = await import(
      '../runtime-model-discovery'
    );
    const firstDiscovery = runtimeModelDiscovery.discover(
      'provider-image',
      'https://api.example.com/v1',
      'same-key'
    );
    const secondDiscovery = runtimeModelDiscovery.discover(
      'provider-image',
      'https://api.example.com/v1',
      'same-key'
    );

    expect(fetchMock).toHaveBeenCalledTimes(1);
    resolveFetch?.({
      ok: true,
      text: async () =>
        JSON.stringify({ data: [{ id: 'same-image', category: 'image' }] }),
    });

    await expect(firstDiscovery).resolves.toMatchObject([{ id: 'same-image' }]);
    await expect(secondDiscovery).resolves.toMatchObject([
      { id: 'same-image' },
    ]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('目录请求期间的新模型选择不会被请求启动时的旧选择覆盖', async () => {
    const { buildProviderCatalogDiscoverySignature } = await import(
      '../image-routing-evidence'
    );
    const baseUrl = 'https://api.example.com/v1';
    const apiKey = 'same-key';
    let resolveFetch:
      | ((response: { ok: true; text: () => Promise<string> }) => void)
      | undefined;
    vi.stubGlobal(
      'fetch',
      vi.fn(
        () =>
          new Promise<{ ok: true; text: () => Promise<string> }>((resolve) => {
            resolveFetch = resolve;
          })
      )
    );
    mockSettingsManager({
      catalogs: [
        {
          profileId: 'provider-image',
          discoveredAt: 123,
          sourceBaseUrl: baseUrl,
          signature: buildProviderCatalogDiscoverySignature(baseUrl, apiKey),
          discoveredModels: [
            { id: 'model-a', category: 'image', type: 'image' },
            { id: 'model-b', category: 'image', type: 'image' },
          ],
          selectedModelIds: ['model-a'],
        },
      ],
    });

    const { runtimeModelDiscovery } = await import(
      '../runtime-model-discovery'
    );
    const discovery = runtimeModelDiscovery.discover(
      'provider-image',
      baseUrl,
      apiKey
    );
    await runtimeModelDiscovery.applySelection('provider-image', ['model-b']);

    resolveFetch?.({
      ok: true,
      text: async () =>
        JSON.stringify({
          data: [
            { id: 'model-a', category: 'image' },
            { id: 'model-b', category: 'image' },
          ],
        }),
    });
    await discovery;

    expect(runtimeModelDiscovery.getSelectedModelIds('provider-image')).toEqual(
      ['model-b']
    );
  });

  it('主流最新静态模型可被初始选择器解析', async () => {
    const { getStaticModelConfig } = await import(
      '../../constants/model-config'
    );

    expect(getStaticModelConfig('gpt-5.6-sol')).toMatchObject({
      label: 'GPT-5.6 Sol',
      shortCode: 'g56s',
      type: 'text',
      vendor: 'GPT',
      recommendedScore: 102,
    });
    expect(getStaticModelConfig('gpt-5.6-terra')).toMatchObject({
      label: 'GPT-5.6 Terra',
      shortCode: 'g56t',
      type: 'text',
      vendor: 'GPT',
      recommendedScore: 101,
    });
    expect(getStaticModelConfig('gpt-5.6-luna')).toMatchObject({
      label: 'GPT-5.6 Luna',
      shortCode: 'g56l',
      type: 'text',
      vendor: 'GPT',
      recommendedScore: 100,
    });
    expect(getStaticModelConfig('gpt-5.5')?.type).toBe('text');
    expect(getStaticModelConfig('gpt-5.4')?.type).toBe('text');
    expect(getStaticModelConfig('gpt-5.4-mini')?.type).toBe('text');
    expect(getStaticModelConfig('gpt-5.1')?.type).toBe('text');
    expect(getStaticModelConfig('claude-sonnet-4-6')?.type).toBe('text');
    expect(getStaticModelConfig('seedream-v4')?.type).toBe('image');
    expect(getStaticModelConfig('veo3-fast-frames')?.type).toBe('video');
  });

  it('应用模型选择时会返回新增和移除增量', async () => {
    vi.doMock('../settings-manager', () => ({
      LEGACY_DEFAULT_PROVIDER_PROFILE_ID: 'legacy-default',
      providerCatalogsSettings: {
        get: () => [
          {
            profileId: 'provider-text',
            discoveredAt: Date.now(),
            discoveredModels: [
              {
                id: 'model-a',
                label: 'Model A',
                shortLabel: 'Model A',
                type: 'text',
                vendor: 'OPENAI',
              },
              {
                id: 'model-b',
                label: 'Model B',
                shortLabel: 'Model B',
                type: 'text',
                vendor: 'OPENAI',
              },
              {
                id: 'model-c',
                label: 'Model C',
                shortLabel: 'Model C',
                type: 'text',
                vendor: 'OPENAI',
              },
            ],
            selectedModelIds: ['model-a', 'model-b'],
          },
        ],
        addListener: () => {},
        removeListener: () => {},
        update: async () => {},
      },
      providerProfilesSettings: {
        get: () => [
          {
            id: 'provider-text',
            name: '文本供应商',
            enabled: true,
          },
        ],
        addListener: () => {},
        removeListener: () => {},
      },
      invocationPresetsSettings: {
        addListener: () => {},
        removeListener: () => {},
      },
      settingsManager: {
        getSetting: () => ({}),
        addListener: () => {},
        removeListener: () => {},
      },
    }));

    const { runtimeModelDiscovery } = await import(
      '../runtime-model-discovery'
    );

    const result = await runtimeModelDiscovery.applySelection('provider-text', [
      'model-b',
      'model-c',
    ]);

    expect(result.models.map((model) => model.id)).toEqual([
      'model-b',
      'model-c',
    ]);
    expect(result.addedModelIds).toEqual(['model-c']);
    expect(result.removedModelIds).toEqual(['model-a']);
  });

  it('模型发现和选择只有在目录持久化完成后才对调用方完成', async () => {
    const pendingWrites: Array<{
      catalogs: Array<Record<string, unknown>>;
      resolve: () => void;
    }> = [];

    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        text: async () =>
          JSON.stringify({
            data: [{ id: 'provider-image-model', category: 'image' }],
          }),
      }))
    );
    vi.doMock('../settings-manager', () => ({
      LEGACY_DEFAULT_PROVIDER_PROFILE_ID: 'legacy-default',
      providerCatalogsSettings: {
        get: () => [],
        addListener: () => {},
        removeListener: () => {},
        update: (catalogs: Array<Record<string, unknown>>) =>
          new Promise<void>((resolve) => {
            pendingWrites.push({ catalogs, resolve });
          }),
      },
      providerProfilesSettings: {
        get: () => [
          {
            id: 'provider-image',
            name: '图片供应商',
            enabled: true,
          },
        ],
        addListener: () => {},
        removeListener: () => {},
      },
      invocationPresetsSettings: {
        addListener: () => {},
        removeListener: () => {},
      },
      settingsManager: {
        getSetting: () => ({}),
        addListener: () => {},
        removeListener: () => {},
      },
    }));

    const { runtimeModelDiscovery } = await import(
      '../runtime-model-discovery'
    );

    let discoveryResolved = false;
    const discoveryPromise = runtimeModelDiscovery
      .discover('provider-image', 'https://api.example.com/v1', 'test-key')
      .then(() => {
        discoveryResolved = true;
      });

    await vi.waitFor(() => expect(pendingWrites).toHaveLength(1));
    await Promise.resolve();
    expect(discoveryResolved).toBe(false);
    pendingWrites[0].resolve();
    await discoveryPromise;

    let selectionResolved = false;
    const selectionPromise = Promise.resolve(
      runtimeModelDiscovery.applySelection('provider-image', [
        'provider-image-model',
      ])
    ).then(() => {
      selectionResolved = true;
    });

    await vi.waitFor(() => expect(pendingWrites).toHaveLength(2));
    await Promise.resolve();
    expect(selectionResolved).toBe(false);
    pendingWrites[1].resolve();
    await selectionPromise;
  });

  it('连续模型选择的持久化队列不会提交已被更新选择取代的旧快照', async () => {
    const pendingWrites: Array<{
      catalogs: Array<Record<string, unknown>>;
      resolve: () => void;
    }> = [];
    vi.doMock('../settings-manager', () => ({
      LEGACY_DEFAULT_PROVIDER_PROFILE_ID: 'legacy-default',
      providerCatalogsSettings: {
        get: () => [
          {
            profileId: 'provider-image',
            discoveredAt: 1,
            discoveredModels: [
              { id: 'model-a', type: 'image', label: 'A', vendor: 'OTHER' },
              { id: 'model-b', type: 'image', label: 'B', vendor: 'OTHER' },
              { id: 'model-c', type: 'image', label: 'C', vendor: 'OTHER' },
            ],
            selectedModelIds: ['model-a'],
          },
        ],
        addListener: () => {},
        removeListener: () => {},
        update: (catalogs: Array<Record<string, unknown>>) =>
          new Promise<void>((resolve) => {
            pendingWrites.push({ catalogs, resolve });
          }),
      },
      providerProfilesSettings: {
        get: () => [
          {
            id: 'provider-image',
            name: 'Image Provider',
            providerType: 'openai-compatible',
            enabled: true,
          },
        ],
        addListener: () => {},
        removeListener: () => {},
      },
      invocationPresetsSettings: {
        addListener: () => {},
        removeListener: () => {},
      },
      settingsManager: {
        getSetting: () => ({}),
        addListener: () => {},
        removeListener: () => {},
      },
    }));

    const { runtimeModelDiscovery } = await import(
      '../runtime-model-discovery'
    );
    const firstSelection = runtimeModelDiscovery.applySelection(
      'provider-image',
      ['model-b']
    );
    const latestSelection = runtimeModelDiscovery.applySelection(
      'provider-image',
      ['model-c']
    );

    await vi.waitFor(() => expect(pendingWrites).toHaveLength(1));
    expect(pendingWrites[0].catalogs[0]).toMatchObject({
      selectedModelIds: ['model-c'],
    });
    pendingWrites[0].resolve();
    await vi.waitFor(() => expect(pendingWrites).toHaveLength(2));
    expect(pendingWrites[1].catalogs[0]).toMatchObject({
      selectedModelIds: ['model-c'],
    });
    pendingWrites[1].resolve();

    await Promise.all([firstSelection, latestSelection]);
  });

  it('加载旧目录时会刷新 HappyHorse 的供应商分类', async () => {
    vi.doMock('../settings-manager', () => ({
      LEGACY_DEFAULT_PROVIDER_PROFILE_ID: 'legacy-default',
      providerCatalogsSettings: {
        get: () => [
          {
            profileId: 'provider-happyhorse',
            discoveredAt: Date.now(),
            discoveredModels: [
              {
                id: 'happyhorse-1.0-t2v',
                label: 'HappyHorse 1.0 T2V',
                shortLabel: 'HappyHorse 1.0 T2V',
                type: 'video',
                vendor: 'OTHER',
                tags: ['happyhorse'],
              },
            ],
            selectedModelIds: ['happyhorse-1.0-t2v'],
          },
        ],
        addListener: () => {},
        removeListener: () => {},
        update: async () => {},
      },
      providerProfilesSettings: {
        get: () => [
          {
            id: 'provider-happyhorse',
            name: 'HappyHorse',
            enabled: true,
          },
        ],
        addListener: () => {},
        removeListener: () => {},
      },
      invocationPresetsSettings: {
        addListener: () => {},
        removeListener: () => {},
      },
      settingsManager: {
        getSetting: () => ({}),
        addListener: () => {},
        removeListener: () => {},
      },
    }));

    const { runtimeModelDiscovery } = await import(
      '../runtime-model-discovery'
    );
    const state = runtimeModelDiscovery.getState('provider-happyhorse');

    expect(state.discoveredModels[0]).toMatchObject({
      id: 'happyhorse-1.0-t2v',
      type: 'video',
      vendor: 'HAPPYHORSE',
      sourceProfileId: 'provider-happyhorse',
    });
    expect(state.models[0]?.vendor).toBe('HAPPYHORSE');
  });

  it('运行时发现模型会识别 HappyHorse 供应商', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        text: async () =>
          JSON.stringify({
            data: [{ id: 'happyhorse-alpha-video', owned_by: 'happyhorse' }],
          }),
      }))
    );

    vi.doMock('../settings-manager', () => ({
      LEGACY_DEFAULT_PROVIDER_PROFILE_ID: 'legacy-default',
      providerCatalogsSettings: {
        get: () => [],
        addListener: () => {},
        removeListener: () => {},
        update: async () => {},
      },
      providerProfilesSettings: {
        get: () => [
          {
            id: 'provider-happyhorse',
            name: 'HappyHorse',
            enabled: true,
          },
        ],
        addListener: () => {},
        removeListener: () => {},
      },
      invocationPresetsSettings: {
        addListener: () => {},
        removeListener: () => {},
      },
      settingsManager: {
        getSetting: () => ({}),
        addListener: () => {},
        removeListener: () => {},
      },
    }));

    const { runtimeModelDiscovery } = await import(
      '../runtime-model-discovery'
    );

    const models = await runtimeModelDiscovery.discover(
      'provider-happyhorse',
      'https://api.example.com/v1',
      'test-key'
    );

    expect(models[0]).toMatchObject({
      id: 'happyhorse-alpha-video',
      type: 'video',
      vendor: 'HAPPYHORSE',
    });
  });

  it('运行时发现 Omni Flash 系列会识别为 Gemini 供应商', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        text: async () =>
          JSON.stringify({
            data: [
              {
                id: 'omni-flash',
                owned_by: 'openai',
                supported_endpoint_types: ['videos.generate'],
              },
              {
                id: 'omni-flash-components',
                owned_by: 'openai',
                supported_endpoint_types: ['videos.generate'],
              },
            ],
          }),
      }))
    );

    vi.doMock('../settings-manager', () => ({
      LEGACY_DEFAULT_PROVIDER_PROFILE_ID: 'legacy-default',
      providerCatalogsSettings: {
        get: () => [],
        addListener: () => {},
        removeListener: () => {},
        update: async () => {},
      },
      providerProfilesSettings: {
        get: () => [
          {
            id: 'provider-video',
            name: 'Video Provider',
            enabled: true,
          },
        ],
        addListener: () => {},
        removeListener: () => {},
      },
      invocationPresetsSettings: {
        addListener: () => {},
        removeListener: () => {},
      },
      settingsManager: {
        getSetting: () => ({}),
        addListener: () => {},
        removeListener: () => {},
      },
    }));

    const { runtimeModelDiscovery } = await import(
      '../runtime-model-discovery'
    );

    const models = await runtimeModelDiscovery.discover(
      'provider-video',
      'https://api.example.com/v1',
      'test-key'
    );

    expect(models.map((model) => model.vendor)).toEqual(['GEMINI', 'GEMINI']);
    expect(models.map((model) => model.type)).toEqual(['video', 'video']);
  });

  it('不会把 OpenAI 自有 omni 模型误归类为 Gemini', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        text: async () =>
          JSON.stringify({
            data: [
              {
                id: 'omni-moderation-latest',
                owned_by: 'openai',
                supported_endpoint_types: ['moderations'],
              },
            ],
          }),
      }))
    );

    vi.doMock('../settings-manager', () => ({
      LEGACY_DEFAULT_PROVIDER_PROFILE_ID: 'legacy-default',
      providerCatalogsSettings: {
        get: () => [],
        addListener: () => {},
        removeListener: () => {},
        update: async () => {},
      },
      providerProfilesSettings: {
        get: () => [
          {
            id: 'provider-openai',
            name: 'OpenAI',
            enabled: true,
          },
        ],
        addListener: () => {},
        removeListener: () => {},
      },
      invocationPresetsSettings: {
        addListener: () => {},
        removeListener: () => {},
      },
      settingsManager: {
        getSetting: () => ({}),
        addListener: () => {},
        removeListener: () => {},
      },
    }));

    const { runtimeModelDiscovery } = await import(
      '../runtime-model-discovery'
    );

    const models = await runtimeModelDiscovery.discover(
      'provider-openai',
      'https://api.example.com/v1',
      'test-key'
    );

    expect(models).toHaveLength(1);
    expect(models[0]).toMatchObject({
      id: 'omni-moderation-latest',
      vendor: 'GPT',
    });
  });

  it('优先按接口 category 分类模型', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        text: async () =>
          JSON.stringify({
            data: [
              {
                id: 'gpt-4o-image-async',
                owned_by: 'openai',
                category: '生图',
                supported_endpoint_types: [
                  'OpenAI-Chat',
                  'edit',
                  'generate',
                  'openai-video',
                ],
              },
              {
                id: 'research-video-preview',
                owned_by: 'openai',
                category: '文本',
                supported_endpoint_types: ['openai-video'],
              },
            ],
          }),
      }))
    );

    vi.doMock('../settings-manager', () => ({
      LEGACY_DEFAULT_PROVIDER_PROFILE_ID: 'legacy-default',
      providerCatalogsSettings: {
        get: () => [],
        addListener: () => {},
        removeListener: () => {},
        update: async () => {},
      },
      providerProfilesSettings: {
        get: () => [
          {
            id: 'provider-openai',
            name: 'OpenAI',
            enabled: true,
          },
        ],
        addListener: () => {},
        removeListener: () => {},
      },
      invocationPresetsSettings: {
        addListener: () => {},
        removeListener: () => {},
      },
      settingsManager: {
        getSetting: () => ({}),
        addListener: () => {},
        removeListener: () => {},
      },
    }));

    const { runtimeModelDiscovery } = await import(
      '../runtime-model-discovery'
    );

    const models = await runtimeModelDiscovery.discover(
      'provider-openai',
      'https://api.example.com/v1',
      'test-key'
    );

    expect(models).toHaveLength(2);
    expect(
      models.find((model) => model.id === 'gpt-4o-image-async')
    ).toMatchObject({
      type: 'image',
      vendor: 'GPT',
    });
    expect(
      models.find((model) => model.id === 'research-video-preview')
    ).toMatchObject({
      type: 'text',
      vendor: 'GPT',
    });
  });
});
