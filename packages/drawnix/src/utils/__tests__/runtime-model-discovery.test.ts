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
      'gpt-5.5',
      'gpt-5.4',
      'gpt-5.4-mini',
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
    ).toEqual(['gpt-5.5', 'gpt-5.4', 'gpt-5.4-mini']);
    expect(
      getProfilePreferredModels('legacy-default', 'image').map(
        (model) => model.id
      )
    ).toEqual(['gpt-image-2']);
    expect(getProfilePreferredModels('legacy-default', 'video')).toEqual([]);
    expect(getProfilePreferredModels('legacy-default', 'audio')).toEqual([]);
  });

  it('静态模型 pinning 不会把已清理的默认展示项带回选择列表', async () => {
    mockSettingsManager();

    const { getPinnedSelectableModel } = await import(
      '../runtime-model-discovery'
    );

    expect(getPinnedSelectableModel('text', 'gpt-5.5')).toMatchObject({
      id: 'gpt-5.5',
    });
    expect(getPinnedSelectableModel('image', 'gpt-image-2')).toMatchObject({
      id: 'gpt-image-2',
    });
    expect(getPinnedSelectableModel('image', 'gpt-image-2-vip')).toBeNull();
    expect(getPinnedSelectableModel('video', 'seedance-1.5-pro')).toBeNull();
    expect(getPinnedSelectableModel('audio', 'suno_music')).toBeNull();
  });

  it('有 discoveredModels 时仍展示供应商已选择的运行时模型', async () => {
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
          ],
          selectedModelIds: ['custom-text-model', 'custom-video-model'],
        },
      ],
    });

    const { getSelectableModels } = await import('../runtime-model-discovery');

    expect(getSelectableModels('text').map((model) => model.id)).toEqual([
      'gpt-5.5',
      'gpt-5.4',
      'gpt-5.4-mini',
      'custom-text-model',
    ]);
    expect(getSelectableModels('video').map((model) => model.id)).toEqual([
      'custom-video-model',
    ]);
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

  it('主流最新静态模型可被初始选择器解析', async () => {
    const { getStaticModelConfig } = await import('../../constants/model-config');

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

    const { runtimeModelDiscovery } = await import('../runtime-model-discovery');

    const result = runtimeModelDiscovery.applySelection('provider-text', [
      'model-b',
      'model-c',
    ]);

    expect(result.models.map((model) => model.id)).toEqual(['model-b', 'model-c']);
    expect(result.addedModelIds).toEqual(['model-c']);
    expect(result.removedModelIds).toEqual(['model-a']);
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

    const { runtimeModelDiscovery } = await import('../runtime-model-discovery');
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

    const { runtimeModelDiscovery } = await import('../runtime-model-discovery');

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

    const { runtimeModelDiscovery } = await import('../runtime-model-discovery');

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

    const { runtimeModelDiscovery } = await import('../runtime-model-discovery');

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

    const { runtimeModelDiscovery } = await import('../runtime-model-discovery');

    const models = await runtimeModelDiscovery.discover(
      'provider-openai',
      'https://api.example.com/v1',
      'test-key'
    );

    expect(models).toHaveLength(2);
    expect(models.find((model) => model.id === 'gpt-4o-image-async')).toMatchObject(
      {
        type: 'image',
        vendor: 'GPT',
      }
    );
    expect(models.find((model) => model.id === 'research-video-preview')).toMatchObject(
      {
        type: 'text',
        vendor: 'GPT',
      }
    );
  });
});
