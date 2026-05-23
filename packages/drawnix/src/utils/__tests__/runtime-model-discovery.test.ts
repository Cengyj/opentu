import { beforeEach, describe, expect, it, vi } from 'vitest';

describe('runtime-model-discovery', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllGlobals();
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

  it('默认分组初始展示来自 ForOpenCode 本地快照而不是静态模型全集', async () => {
    vi.doMock('../settings-manager', () => ({
      LEGACY_DEFAULT_PROVIDER_PROFILE_ID: 'legacy-default',
      FOROPENCODE_DEFAULT_PROVIDER_NAME: 'default 分组',
      FOROPENCODE_PROVIDER_ICON_URL: '/logo-foropencode.png',
      providerCatalogsSettings: {
        get: () => [],
        addListener: () => {},
        removeListener: () => {},
        update: async () => {},
      },
      providerProfilesSettings: {
        get: () => [
          {
            id: 'legacy-default',
            name: 'default 分组',
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

    const { FOROPENCODE_DEFAULT_MODEL_IDS } = await import(
      '../../constants/for-default-models'
    );
    const { ModelVendor } = await import('../../constants/model-config');
    const { groupModelsByProvider } = await import('../model-grouping');
    const { getSelectableModels, runtimeModelDiscovery } = await import(
      '../runtime-model-discovery'
    );

    const state = runtimeModelDiscovery.getState('legacy-default');
    const imageModels = getSelectableModels('image');
    const textModels = getSelectableModels('text');
    const defaultDisplayModels = [...imageModels, ...textModels];
    const defaultDisplayIds = defaultDisplayModels.map((model) => model.id);

    expect(state.models.map((model) => model.id)).toEqual([
      ...FOROPENCODE_DEFAULT_MODEL_IDS,
    ]);
    expect(new Set(defaultDisplayIds)).toEqual(
      new Set(FOROPENCODE_DEFAULT_MODEL_IDS)
    );
    expect(defaultDisplayIds).not.toContain('gemini-3-pro-image-preview');
    expect(defaultDisplayIds).not.toContain('claude-sonnet-4-6');
    expect(defaultDisplayIds).not.toContain('seedream-v4');
    expect(defaultDisplayIds.some((id) => id.endsWith('openai-compact'))).toBe(
      false
    );

    const vendorTabs = groupModelsByProvider(defaultDisplayModels, [
      {
        id: 'legacy-default',
        name: 'default 分组',
        enabled: true,
      },
    ]).flatMap((group) =>
      group.vendorCategories.map((category) => category.vendor)
    );
    expect(new Set(vendorTabs)).toEqual(new Set([ModelVendor.GPT]));
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

  it('默认分组自动展示只保留允许的 GPT 模型且不裁剪发现结果', async () => {
    const returnedModelIds = [
      'gpt-image-2',
      'gpt-image-2-vip',
      'gpt-draw-1024x1536',
      'gpt-4.1-mini-openai-compact',
      'gpt-5.4-openai-compact',
      'gpt-image-3-openai-compact',
      'gpt-5.5',
      'claude-sonnet-4-6',
      'gemini-3-pro',
    ];
    const catalogs: unknown[] = [];

    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        text: async () =>
          JSON.stringify({
            data: returnedModelIds.map((id) => ({ id })),
          }),
      }))
    );

    vi.doMock('../settings-manager', () => ({
      LEGACY_DEFAULT_PROVIDER_PROFILE_ID: 'legacy-default',
      providerCatalogsSettings: {
        get: () => catalogs,
        addListener: () => {},
        removeListener: () => {},
        update: async (nextCatalogs: unknown[]) => {
          catalogs.splice(0, catalogs.length, ...nextCatalogs);
        },
      },
      providerProfilesSettings: {
        get: () => [
          {
            id: 'legacy-default',
            name: 'default 分组',
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

    const {
      isDefaultGroupAutoVisibleModel,
      runtimeModelDiscovery,
    } = await import('../runtime-model-discovery');

    const discoveredModels = await runtimeModelDiscovery.discover(
      'legacy-default',
      'https://foropencode.com/v1',
      'test-key'
    );
    const state = runtimeModelDiscovery.getState('legacy-default');

    expect(discoveredModels.map((model) => model.id)).toEqual(returnedModelIds);
    expect(state.discoveredModels.map((model) => model.id)).toEqual(
      returnedModelIds
    );
    expect(state.selectedModelIds).toEqual(['gpt-image-2', 'gpt-5.5']);
    expect(state.models.map((model) => model.id)).toEqual([
      'gpt-image-2',
      'gpt-5.5',
    ]);
    expect(
      runtimeModelDiscovery.getSelectableModels('text').map((model) => model.id)
    ).toEqual(['gpt-5.5']);

    const helperInput = (
      id: string,
      vendor = 'GPT'
    ): Parameters<typeof isDefaultGroupAutoVisibleModel>[0] => ({
      id,
      label: id,
      type: 'text',
      vendor: vendor as Parameters<
        typeof isDefaultGroupAutoVisibleModel
      >[0]['vendor'],
    });

    expect(isDefaultGroupAutoVisibleModel(helperInput('gpt-5.4-mini'))).toBe(
      true
    );
    expect(
      isDefaultGroupAutoVisibleModel(helperInput('gpt-draw-1024x1536'))
    ).toBe(false);
    expect(isDefaultGroupAutoVisibleModel(helperInput('gpt-image-2-vip'))).toBe(
      false
    );
    expect(
      isDefaultGroupAutoVisibleModel(
        helperInput('gpt-4.1-mini-openai-compact')
      )
    ).toBe(false);
    expect(
      isDefaultGroupAutoVisibleModel(helperInput('gpt-5.4-openai-compact'))
    ).toBe(false);
    expect(
      isDefaultGroupAutoVisibleModel(helperInput('gpt-image-3-openai-compact'))
    ).toBe(false);
    expect(
      isDefaultGroupAutoVisibleModel(
        helperInput('claude-sonnet-4-6', 'ANTHROPIC')
      )
    ).toBe(false);
  });

  it('自定义供应商发现结果和手动选择不套用默认分组 GPT 过滤', async () => {
    const returnedModelIds = [
      'gpt-image-2',
      'gpt-draw-1024x1536',
      'claude-sonnet-4-6',
      'gemini-3-pro',
    ];
    const catalogs: unknown[] = [];

    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        text: async () =>
          JSON.stringify({
            data: returnedModelIds.map((id) => ({ id })),
          }),
      }))
    );

    vi.doMock('../settings-manager', () => ({
      LEGACY_DEFAULT_PROVIDER_PROFILE_ID: 'legacy-default',
      providerCatalogsSettings: {
        get: () => catalogs,
        addListener: () => {},
        removeListener: () => {},
        update: async (nextCatalogs: unknown[]) => {
          catalogs.splice(0, catalogs.length, ...nextCatalogs);
        },
      },
      providerProfilesSettings: {
        get: () => [
          {
            id: 'custom-provider',
            name: 'Custom Provider',
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

    await runtimeModelDiscovery.discover(
      'custom-provider',
      'https://foropencode.com/v1',
      'test-key'
    );

    expect(
      runtimeModelDiscovery
        .getState('custom-provider')
        .discoveredModels.map((model) => model.id)
    ).toEqual(returnedModelIds);
    expect(
      runtimeModelDiscovery.getState('custom-provider').selectedModelIds
    ).toEqual([]);

    const selection = runtimeModelDiscovery.applySelection('custom-provider', [
      'claude-sonnet-4-6',
      'gpt-draw-1024x1536',
    ]);

    expect(selection.models.map((model) => model.id)).toEqual([
      'gpt-draw-1024x1536',
      'claude-sonnet-4-6',
    ]);
    expect(
      runtimeModelDiscovery
        .getSelectableModels('text')
        .map((model) => model.selectionKey || model.id)
    ).toEqual(
      expect.arrayContaining([
        'custom-provider::gpt-draw-1024x1536',
        'custom-provider::claude-sonnet-4-6',
      ])
    );
  });

  it('default group persisted compact selections do not re-enter selectable UI', async () => {
    vi.doMock('../settings-manager', () => ({
      LEGACY_DEFAULT_PROVIDER_PROFILE_ID: 'legacy-default',
      providerCatalogsSettings: {
        get: () => [
          {
            profileId: 'legacy-default',
            discoveredAt: Date.now(),
            discoveredModels: [
              {
                id: 'gpt-5.5',
                label: 'GPT 5.5',
                shortLabel: 'GPT 5.5',
                type: 'text',
                vendor: 'GPT',
              },
              {
                id: 'gpt-5.4-openai-compact',
                label: 'GPT compact',
                shortLabel: 'GPT compact',
                type: 'text',
                vendor: 'GPT',
              },
              {
                id: 'claude-sonnet-4-6',
                label: 'Claude',
                shortLabel: 'Claude',
                type: 'text',
                vendor: 'ANTHROPIC',
              },
            ],
            selectedModelIds: [
              'gpt-5.4-openai-compact',
              'claude-sonnet-4-6',
            ],
          },
        ],
        addListener: () => {},
        removeListener: () => {},
        update: async () => {},
      },
      providerProfilesSettings: {
        get: () => [
          {
            id: 'legacy-default',
            name: 'default group',
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

    const { getPinnedSelectableModel, runtimeModelDiscovery } = await import(
      '../runtime-model-discovery'
    );

    expect(
      runtimeModelDiscovery.getState('legacy-default').selectedModelIds
    ).toEqual(['gpt-5.5']);
    expect(
      runtimeModelDiscovery.getSelectableModels('text').map((model) => model.id)
    ).toEqual(['gpt-5.5']);
    expect(
      getPinnedSelectableModel('text', 'gpt-5.4-openai-compact', {
        profileId: 'legacy-default',
        modelId: 'gpt-5.4-openai-compact',
      })
    ).toBeNull();
    expect(
      getPinnedSelectableModel('text', 'gpt-5.4-openai-compact', null)
    ).toBeNull();
  });
});
