// @vitest-environment jsdom

import React from 'react';
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { AssetSource, AssetType, type Asset } from '../../types/asset.types';
import { DeferredMediaLibrarySyncAction } from './DeferredMediaLibrarySyncAction';
import type { MediaLibrarySyncActionRuntimeProps } from './MediaLibrarySyncActionRuntime';

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

function createAsset(overrides: Partial<Asset> = {}): Asset {
  return {
    id: 'asset-1',
    type: AssetType.IMAGE,
    source: AssetSource.AI_GENERATED,
    url: '/__aitu_cache__/image/asset-1.png',
    name: 'asset-1.png',
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

describe('DeferredMediaLibrarySyncAction', () => {
  it('does not load sync code until the existing sync action is pressed', async () => {
    const deferred = createDeferred<{
      MediaLibrarySyncActionRuntime: React.ComponentType<MediaLibrarySyncActionRuntimeProps>;
    }>();
    const runtimeLoader = vi.fn(() => deferred.promise);

    render(
      <DeferredMediaLibrarySyncAction
        assets={[createAsset()]}
        syncedUrls={new Set()}
        onSynced={vi.fn()}
        runtimeLoader={runtimeLoader}
      />
    );

    expect(runtimeLoader).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: '同步 (1)' }));
    expect(screen.getByRole('button').textContent).toContain('正在加载同步');
    expect(runtimeLoader).toHaveBeenCalledTimes(1);

    await act(async () => {
      deferred.resolve({
        MediaLibrarySyncActionRuntime: ({ activationKey }) => (
          <div data-testid="sync-runtime">{activationKey}</div>
        ),
      });
      await deferred.promise;
    });

    expect((await screen.findByTestId('sync-runtime')).textContent).toBe('1');
  });

  it('keeps a failed sync chunk load visibly retryable', async () => {
    const runtimeLoader = vi
      .fn<
        () => Promise<{
          MediaLibrarySyncActionRuntime: React.ComponentType<MediaLibrarySyncActionRuntimeProps>;
        }>
      >()
      .mockRejectedValueOnce(new Error('chunk unavailable'))
      .mockResolvedValueOnce({
        MediaLibrarySyncActionRuntime: () => <div>同步运行时已加载</div>,
      });

    render(
      <DeferredMediaLibrarySyncAction
        assets={[createAsset()]}
        syncedUrls={new Set()}
        onSynced={vi.fn()}
        runtimeLoader={runtimeLoader}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: '同步 (1)' }));
    expect(
      await screen.findByRole('button', {
        name: '同步加载失败，点击重试',
      })
    ).toBeTruthy();

    fireEvent.click(
      screen.getByRole('button', { name: '同步加载失败，点击重试' })
    );
    await waitFor(() => expect(runtimeLoader).toHaveBeenCalledTimes(2));
    expect(await screen.findByText('同步运行时已加载')).toBeTruthy();
  });
});
