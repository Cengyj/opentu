import { describe, expect, it, vi } from 'vitest';
import {
  GITHUB_SYNC_TOKEN_STORAGE_KEY,
  hasStoredGitHubSyncToken,
} from './token-storage';

describe('GitHub sync token presence', () => {
  it('checks only the canonical encrypted-token storage key', () => {
    const storage = { getItem: vi.fn(() => 'encrypted-token') };

    expect(hasStoredGitHubSyncToken(storage)).toBe(true);
    expect(storage.getItem).toHaveBeenCalledWith(
      GITHUB_SYNC_TOKEN_STORAGE_KEY
    );
  });

  it('returns false when storage is empty or unavailable', () => {
    expect(hasStoredGitHubSyncToken({ getItem: () => null })).toBe(false);
    expect(
      hasStoredGitHubSyncToken({
        getItem: () => {
          throw new DOMException('blocked', 'SecurityError');
        },
      })
    ).toBe(false);
  });
});
