// @vitest-environment jsdom

import React from 'react';
import { act, render, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AssetSource, AssetType, type Asset } from '../../types/asset.types';
import { MediaLibrarySyncActionRuntime } from './MediaLibrarySyncActionRuntime';

const syncSelectedMedia = vi.hoisted(() => vi.fn());

vi.mock('../../services/github-sync/media-sync-service', () => ({
  mediaSyncService: { syncSelectedMedia },
}));

vi.mock('tdesign-react', () => ({
  Button: ({
    children,
    loading: _loading,
    icon: _icon,
    ...props
  }: React.ButtonHTMLAttributes<HTMLButtonElement> & {
    loading?: boolean;
    icon?: React.ReactNode;
  }) => <button {...props}>{children}</button>,
}));

vi.mock('../shared/hover', () => ({
  HoverTip: ({ children }: { children: React.ReactNode }) => (
    <span>{children}</span>
  ),
}));

function createAsset(id: string, overrides: Partial<Asset> = {}): Asset {
  return {
    id,
    type: AssetType.IMAGE,
    source: AssetSource.AI_GENERATED,
    url: `/__aitu_cache__/image/${id}.png`,
    name: `${id}.png`,
    mimeType: 'image/png',
    createdAt: 1,
    ...overrides,
  };
}

function createDeferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

describe('MediaLibrarySyncActionRuntime', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    syncSelectedMedia.mockResolvedValue({
      succeeded: 1,
      failed: 0,
      skipped: 0,
    });
  });

  it('replays one explicit intent with unique eligible URLs only', async () => {
    const onSynced = vi.fn();
    const assets = [
      createAsset('ai'),
      createAsset('ai-duplicate', {
        url: '/__aitu_cache__/image/ai.png',
      }),
      createAsset('local-cache', { source: AssetSource.LOCAL }),
      createAsset('local-library', {
        source: AssetSource.LOCAL,
        url: '/asset-library/local-library.png',
      }),
      createAsset('already-synced'),
    ];
    const view = render(
      <MediaLibrarySyncActionRuntime
        assets={assets}
        syncedUrls={new Set(['/__aitu_cache__/image/already-synced.png'])}
        activationKey={1}
        onSynced={onSynced}
      />
    );

    await waitFor(() => expect(syncSelectedMedia).toHaveBeenCalledTimes(1));
    expect(syncSelectedMedia.mock.calls[0][0]).toEqual([
      '/__aitu_cache__/image/ai.png',
      '/__aitu_cache__/image/local-cache.png',
    ]);
    await waitFor(() => expect(onSynced).toHaveBeenCalledTimes(1));

    view.rerender(
      <MediaLibrarySyncActionRuntime
        assets={[...assets]}
        syncedUrls={new Set(['/__aitu_cache__/image/already-synced.png'])}
        activationKey={1}
        onSynced={onSynced}
      />
    );
    await Promise.resolve();
    expect(syncSelectedMedia).toHaveBeenCalledTimes(1);
  });

  it('ignores late progress and completion after the runtime is unmounted', async () => {
    const deferred = createDeferred<{
      succeeded: number;
      failed: number;
      skipped: number;
    }>();
    let reportProgress: ((current: number, total: number) => void) | undefined;
    syncSelectedMedia.mockImplementationOnce(
      (
        _urls: readonly string[],
        onProgress: (current: number, total: number) => void
      ) => {
        reportProgress = onProgress;
        return deferred.promise;
      }
    );
    const onSynced = vi.fn();
    const view = render(
      <MediaLibrarySyncActionRuntime
        assets={[createAsset('late')]}
        syncedUrls={new Set()}
        activationKey={1}
        onSynced={onSynced}
      />
    );

    await waitFor(() => expect(syncSelectedMedia).toHaveBeenCalledTimes(1));
    view.unmount();

    await act(async () => {
      reportProgress?.(1, 1);
      deferred.resolve({ succeeded: 1, failed: 0, skipped: 0 });
      await deferred.promise;
    });

    expect(onSynced).not.toHaveBeenCalled();
  });
});
