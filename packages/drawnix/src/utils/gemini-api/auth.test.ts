import { afterEach, describe, expect, it, vi } from 'vitest';
import { geminiSettings } from '../settings-manager';
import { validateAndEnsureConfig } from './auth';

describe('validateAndEnsureConfig credential boundary', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('does not borrow the global key for a strict planned image config', async () => {
    const globalSettingsGet = vi.spyOn(geminiSettings, 'get').mockReturnValue({
      apiKey: 'global-key-must-not-be-borrowed',
      baseUrl: 'https://global.example.com/v1',
    });
    const config = {
      apiKey: '',
      baseUrl: 'https://selected-profile.example.com/v1',
    };

    await expect(
      validateAndEnsureConfig(config, { credentialFallback: 'none' })
    ).rejects.toThrow('API Key 是必需的');

    expect(globalSettingsGet).not.toHaveBeenCalled();
    expect(config.apiKey).toBe('');
  });

  it('keeps the existing global fallback for non-strict callers', async () => {
    const globalSettingsGet = vi.spyOn(geminiSettings, 'get').mockReturnValue({
      apiKey: 'existing-global-key',
      baseUrl: 'https://global.example.com/v1',
    });
    const config = {
      apiKey: '',
      baseUrl: 'https://text.example.com/v1',
    };

    await expect(validateAndEnsureConfig(config)).resolves.toBe(config);

    expect(globalSettingsGet).toHaveBeenCalledTimes(1);
    expect(config.apiKey).toBe('existing-global-key');
  });
});
