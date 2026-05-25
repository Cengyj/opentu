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
        replaceState: vi.fn(),
      },
      dispatchEvent: () => true,
    });
    vi.stubGlobal('localStorage', {
      getItem: () => null,
      setItem: vi.fn(),
      removeItem: vi.fn(),
      clear: vi.fn(),
    });
  });

  it('defaults new profiles to OpenAI GPT Image compatibility', async () => {
    const { createProviderProfileDraft } = await import(
      '../provider-profile-draft'
    );

    expect(createProviderProfileDraft(3, 'profile-3')).toMatchObject({
      id: 'profile-3',
      name: '供应商 3',
      homepageUrl: '',
      providerType: 'openai-compatible',
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

  it('shows OpenAI GPT Image compatibility for ForOpenCode auto image API mode', async () => {
    const { getImageApiCompatibilityHint } = await import(
      '../image-api-compatibility-display'
    );

    const hint = getImageApiCompatibilityHint({
      baseUrl: 'https://foropencode.com/v1',
      imageApiCompatibility: 'auto',
    });

    expect(hint).toContain('OpenAI GPT Image');
    expect(hint).not.toMatch(/Tuzi\s+GPT/);
  });
});
