import { describe, expect, it, vi } from 'vitest';

import {
  invalidateReleaseStaticModule,
  recoverReleaseStaticTarget,
} from './release-cache-recovery';

describe('release cache recovery', () => {
  it('acknowledges a URL-less reload target without reading or mutating caches', async () => {
    const cacheStorage = {
      has: vi.fn(),
      open: vi.fn(),
    };

    await expect(
      recoverReleaseStaticTarget({
        cacheStorage,
        releaseId: 'release-a',
        target: { kind: 'reload-only' },
        clientUrl: 'https://example.test/opentu/board/1',
        serviceWorkerScope: 'https://example.test/opentu/',
      })
    ).resolves.toEqual({ targetValid: true, invalidatedEntries: 0 });
    expect(cacheStorage.has).not.toHaveBeenCalled();
    expect(cacheStorage.open).not.toHaveBeenCalled();
  });

  it('invalidates only the failed module in the reporting page release cache', async () => {
    const deleteEntry = vi.fn(async () => true);
    const open = vi.fn(async () => ({
      keys: async () => [
        new Request('https://example.test/opentu/'),
        new Request('https://example.test/opentu/assets/editor.js'),
        new Request('https://example.test/opentu/assets/editor.js?cached=1'),
        new Request('https://example.test/opentu/assets/other.js'),
      ],
      delete: deleteEntry,
    }));
    const cacheStorage = {
      has: vi.fn(async () => true),
      open,
    };

    await expect(
      invalidateReleaseStaticModule({
        cacheStorage,
        releaseId: 'release-a',
        moduleKey: '/opentu/assets/editor.js',
        clientUrl: 'https://example.test/opentu/board/1',
        serviceWorkerScope: 'https://example.test/opentu/',
      })
    ).resolves.toEqual({ targetValid: true, invalidatedEntries: 2 });
    expect(cacheStorage.has).toHaveBeenCalledWith('drawnix-static-vrelease-a');
    expect(open).toHaveBeenCalledTimes(1);
    expect(open).toHaveBeenCalledWith('drawnix-static-vrelease-a');
    expect(deleteEntry.mock.calls.map(([url]) => url)).toEqual([
      'https://example.test/opentu/assets/editor.js',
      'https://example.test/opentu/assets/editor.js?cached=1',
    ]);
  });

  it('does not create or delete anything when the page release cache is absent', async () => {
    const cacheStorage = {
      has: vi.fn(async () => false),
      open: vi.fn(),
    };

    await expect(
      invalidateReleaseStaticModule({
        cacheStorage,
        releaseId: 'release-a',
        moduleKey: '/opentu/assets/editor.js',
        clientUrl: 'https://example.test/opentu/board/1',
        serviceWorkerScope: 'https://example.test/opentu/',
      })
    ).resolves.toEqual({ targetValid: true, invalidatedEntries: 0 });
    expect(cacheStorage.open).not.toHaveBeenCalled();
  });

  it.each([
    ['an out-of-scope module', 'https://evil.test/assets/editor.js'],
    ['a non-module target', '/opentu/assets/editor.html'],
    ['an unknown boot placeholder', 'boot-main-entry'],
  ])('rejects %s before reading release caches', async (_label, moduleKey) => {
    const cacheStorage = {
      has: vi.fn(async () => true),
      open: vi.fn(),
    };

    await expect(
      invalidateReleaseStaticModule({
        cacheStorage,
        releaseId: 'release-a',
        moduleKey,
        clientUrl: 'https://example.test/opentu/board/1',
        serviceWorkerScope: 'https://example.test/opentu/',
      })
    ).resolves.toEqual({ targetValid: false, invalidatedEntries: 0 });
    expect(cacheStorage.has).not.toHaveBeenCalled();
    expect(cacheStorage.open).not.toHaveBeenCalled();
  });
});
