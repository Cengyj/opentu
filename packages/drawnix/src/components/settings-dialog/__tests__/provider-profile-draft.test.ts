import { beforeEach, describe, expect, it, vi } from 'vitest';

describe('createProviderProfileDraft', () => {
  beforeEach(() => {
    vi.resetModules();
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
    vi.stubGlobal('localStorage', {
      getItem: () => null,
      setItem: () => {},
      removeItem: () => {},
      clear: () => {},
    });
  });

  it('defaults new profiles to automatic protocol routing', async () => {
    const { createProviderProfileDraft } = await import(
      '../provider-profile-draft'
    );

    expect(createProviderProfileDraft(3, 'profile-3')).toMatchObject({
      id: 'profile-3',
      name: '供应商 3',
      homepageUrl: '',
      providerType: 'auto',
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
    });
  });

  it('replaces stale provider preset routes with newly selected models', async () => {
    const { reconcileProviderPresetModels } = await import(
      '../provider-profile-draft'
    );
    const presets = [
      {
        id: 'preset-1',
        name: 'Preset 1',
        image: {
          defaultModelRef: {
            profileId: 'other-provider',
            modelId: 'other-image-model',
          },
        },
        video: {
          defaultModelRef: {
            profileId: 'changed-provider',
            modelId: 'old-video-model',
          },
        },
        audio: { defaultModelRef: null },
        text: {
          defaultModelRef: {
            profileId: 'changed-provider',
            modelId: 'old-text-model',
          },
        },
      },
    ];

    const changedProviderModels = [
      {
        id: 'new-text-model',
        label: 'New Text Model',
        type: 'text' as const,
        vendor: 'OTHER' as const,
        sourceProfileId: 'changed-provider',
      },
    ];
    const reconciled = reconcileProviderPresetModels(
      presets,
      'changed-provider',
      changedProviderModels,
      [
        ...changedProviderModels,
        {
          id: 'other-image-model',
          label: 'Other Image Model',
          type: 'image',
          vendor: 'OTHER',
          sourceProfileId: 'other-provider',
        },
      ]
    );

    expect(reconciled[0]?.text.defaultModelRef).toEqual({
      profileId: 'changed-provider',
      modelId: 'new-text-model',
    });
    expect(reconciled[0]?.video.defaultModelRef).toBeNull();
    expect(reconciled[0]?.image.defaultModelRef).toEqual({
      profileId: 'other-provider',
      modelId: 'other-image-model',
    });
  });
});
