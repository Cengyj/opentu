export const GITHUB_SYNC_TOKEN_STORAGE_KEY = 'github_sync_token';

/**
 * Lightweight synchronous presence check used by startup-sensitive callers.
 * Reading the encrypted value is sufficient here; decryption and validation
 * remain owned by TokenService after the sync runtime is actually requested.
 */
export function hasStoredGitHubSyncToken(
  storage?: Pick<Storage, 'getItem'>
): boolean {
  try {
    const source =
      storage ??
      (typeof window !== 'undefined' ? window.localStorage : undefined);
    return Boolean(source?.getItem(GITHUB_SYNC_TOKEN_STORAGE_KEY));
  } catch {
    return false;
  }
}
