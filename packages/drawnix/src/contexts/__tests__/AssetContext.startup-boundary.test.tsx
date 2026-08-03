// @vitest-environment jsdom

import React from 'react';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { act, cleanup, render, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AssetProvider, useAssets } from '../AssetContext';
import type { AssetContextValue } from '../../types/asset.types';
import { AssetSource, AssetType, type Asset } from '../../types/asset.types';
import { TaskType } from '../../types/task.types';
import {
  getAssetMapSnapshot,
  getAssetMapStatusSnapshot,
  setGlobalAssetMap,
} from '../../stores/asset-map-store';

const runtime = vi.hoisted(() => ({
  loaded: vi.fn(),
  assetStorageService: {
    initialize: vi.fn(),
    cleanup: vi.fn(),
    getAllAssets: vi.fn(),
    addAsset: vi.fn(),
    removeAsset: vi.fn(),
    renameAsset: vi.fn(),
  },
  audioPlaylistService: {
    initialize: vi.fn(),
    removeAssetFromAllPlaylists: vi.fn(),
  },
  taskStorageReader: {
    getAssetTasks: vi.fn(),
  },
  unifiedCacheService: {
    getAllCachedMedia: vi.fn(),
    deleteCache: vi.fn(),
    updateCachedMedia: vi.fn(),
  },
  getAssetSizeFromCache: vi.fn(),
  getStorageStatus: vi.fn(),
  markAssetAsCharacter: vi.fn(),
  deleteTask: vi.fn(),
}));

vi.mock('../asset-context-runtime', () => {
  runtime.loaded();
  return {
    assetStorageService: runtime.assetStorageService,
    audioPlaylistService: runtime.audioPlaylistService,
    taskStorageReader: runtime.taskStorageReader,
    unifiedCacheService: runtime.unifiedCacheService,
    getAssetSizeFromCache: runtime.getAssetSizeFromCache,
    getStorageStatus: runtime.getStorageStatus,
    markAssetAsCharacter: runtime.markAssetAsCharacter,
  };
});

vi.mock('../../services/task-queue-service', () => ({
  taskQueueService: { deleteTask: runtime.deleteTask },
}));

vi.mock('../../utils/message-plugin', () => ({
  MessagePlugin: {
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
    info: vi.fn(),
  },
}));

type IdleCallback = (deadline: IdleDeadline) => void;

function createDeferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

function createLocalAsset(id = 'local-asset'): Asset {
  return {
    id,
    type: AssetType.IMAGE,
    source: AssetSource.LOCAL,
    url: `/asset-library/${id}.png`,
    name: `${id}.png`,
    mimeType: 'image/png',
    createdAt: 100,
    size: 128,
  };
}

function renderHarness(isStartupOperable = true) {
  let value: AssetContextValue | null = null;

  function Harness() {
    value = useAssets();
    return <div data-testid="asset-provider-child" />;
  }

  const createTree = (operable: boolean) => (
    <AssetProvider isStartupOperable={operable}>
      <Harness />
    </AssetProvider>
  );
  const rendered = render(createTree(isStartupOperable));

  return {
    ...rendered,
    setStartupOperable: (operable: boolean) => {
      rendered.rerender(createTree(operable));
    },
    getValue: () => {
      if (!value) {
        throw new Error('AssetContext was not initialized');
      }
      return value;
    },
  };
}

describe('AssetContext lazy storage runtime', () => {
  let idleCallbacks: IdleCallback[];
  let nextIdleId: number;
  let cancelledIdleIds: number[];

  beforeEach(() => {
    vi.clearAllMocks();
    idleCallbacks = [];
    nextIdleId = 1;
    cancelledIdleIds = [];
    vi.stubGlobal(
      'requestIdleCallback',
      vi.fn((callback: IdleCallback) => {
        idleCallbacks.push(callback);
        return nextIdleId++;
      })
    );
    vi.stubGlobal(
      'cancelIdleCallback',
      vi.fn((id: number) => {
        cancelledIdleIds.push(id);
      })
    );

    runtime.assetStorageService.initialize.mockResolvedValue(undefined);
    runtime.audioPlaylistService.initialize.mockResolvedValue(undefined);
    runtime.assetStorageService.getAllAssets.mockResolvedValue([]);
    runtime.taskStorageReader.getAssetTasks.mockResolvedValue([]);
    runtime.unifiedCacheService.getAllCachedMedia.mockResolvedValue([]);
    runtime.unifiedCacheService.deleteCache.mockResolvedValue(undefined);
    runtime.unifiedCacheService.updateCachedMedia.mockResolvedValue(true);
    runtime.audioPlaylistService.removeAssetFromAllPlaylists.mockResolvedValue(
      undefined
    );
    runtime.getAssetSizeFromCache.mockResolvedValue(null);
    runtime.getStorageStatus.mockResolvedValue({
      quota: { usage: 0, quota: 1, available: 1, percentUsed: 0 },
      isNearLimit: false,
      isCritical: false,
    });
    runtime.markAssetAsCharacter.mockResolvedValue(undefined);
    setGlobalAssetMap(new Map(), 'idle');
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('mounts the provider shell without loading storage and cancels unused idle work', () => {
    const provider = renderHarness();

    expect(provider.getValue().assets).toEqual([]);
    expect(runtime.loaded).not.toHaveBeenCalled();
    expect(runtime.assetStorageService.initialize).not.toHaveBeenCalled();
    expect(idleCallbacks).toHaveLength(1);

    provider.unmount();

    expect(cancelledIdleIds).toEqual([1]);
    expect(runtime.assetStorageService.cleanup).not.toHaveBeenCalled();
  });

  it('does not schedule background storage before operability while explicit access stays immediate', async () => {
    const provider = renderHarness(false);

    expect(idleCallbacks).toHaveLength(0);
    expect(runtime.loaded).not.toHaveBeenCalled();

    await act(async () => provider.getValue().loadAssets());

    expect(runtime.loaded).toHaveBeenCalledTimes(1);
    expect(runtime.assetStorageService.initialize).toHaveBeenCalledTimes(1);
    expect(runtime.assetStorageService.getAllAssets).toHaveBeenCalledTimes(1);

    const callbacksBeforeOperability = idleCallbacks.length;
    act(() => provider.setStartupOperable(true));
    expect(idleCallbacks).toHaveLength(callbacksBeforeOperability + 1);

    await act(async () => idleCallbacks.at(-1)?.({} as IdleDeadline));
    expect(runtime.assetStorageService.initialize).toHaveBeenCalledTimes(1);
    expect(runtime.assetStorageService.getAllAssets).toHaveBeenCalledTimes(1);
  });

  it('cleans an in-flight idle initialization without starting a late asset load', async () => {
    const deferred = createDeferred();
    runtime.assetStorageService.initialize.mockReturnValueOnce(
      deferred.promise
    );
    const provider = renderHarness();

    act(() => idleCallbacks[0]({} as IdleDeadline));
    await waitFor(() =>
      expect(runtime.assetStorageService.initialize).toHaveBeenCalledTimes(1)
    );

    provider.unmount();
    expect(runtime.assetStorageService.cleanup).not.toHaveBeenCalled();

    await act(async () => {
      deferred.resolve();
      await Promise.resolve();
    });
    await waitFor(() =>
      expect(runtime.assetStorageService.cleanup).toHaveBeenCalledTimes(1)
    );

    expect(runtime.assetStorageService.getAllAssets).not.toHaveBeenCalled();
    expect(runtime.taskStorageReader.getAssetTasks).not.toHaveBeenCalled();
  });

  it('loads once on the first explicit request and preserves local/task projections', async () => {
    const localAsset = createLocalAsset();
    runtime.assetStorageService.getAllAssets.mockResolvedValue([localAsset]);
    runtime.taskStorageReader.getAssetTasks.mockResolvedValue([
      {
        id: 'image-task',
        type: TaskType.IMAGE,
        createdAt: 200,
        updatedAt: 200,
        completedAt: 200,
        params: { prompt: 'task prompt', model: 'image-model' },
        result: {
          url: '/__aitu_cache__/image/image-task.png',
          format: 'png',
          size: 256,
        },
      },
    ]);
    const provider = renderHarness();

    await act(async () => provider.getValue().loadAssets());

    expect(runtime.assetStorageService.initialize).toHaveBeenCalledTimes(1);
    expect(runtime.audioPlaylistService.initialize).toHaveBeenCalledTimes(1);
    expect(provider.getValue().assets.map((asset) => asset.id)).toEqual([
      'image-task',
      'local-asset',
    ]);
    expect(getAssetMapStatusSnapshot()).toBe('ready');
    expect([...getAssetMapSnapshot().keys()]).toEqual([
      'image-task',
      'local-asset',
    ]);

    await act(async () => idleCallbacks[0]({} as IdleDeadline));

    expect(runtime.assetStorageService.initialize).toHaveBeenCalledTimes(1);
    expect(runtime.assetStorageService.getAllAssets).toHaveBeenCalledTimes(1);
  });

  it('cleans the initialized storage service exactly once on unmount', async () => {
    const provider = renderHarness();
    await act(async () => provider.getValue().loadAssets());

    provider.unmount();

    expect(runtime.assetStorageService.cleanup).toHaveBeenCalledTimes(1);
  });

  it('shares initialization across concurrent load and add actions', async () => {
    const deferred = createDeferred();
    const addedAsset = createLocalAsset('added-asset');
    runtime.assetStorageService.initialize.mockReturnValueOnce(
      deferred.promise
    );
    runtime.assetStorageService.addAsset.mockResolvedValue(addedAsset);
    const provider = renderHarness();

    let loadPromise!: Promise<void>;
    let addPromise!: Promise<Asset>;
    act(() => {
      loadPromise = provider.getValue().loadAssets();
      addPromise = provider
        .getValue()
        .addAsset(
          new Blob(['image'], { type: 'image/png' }),
          AssetType.IMAGE,
          AssetSource.LOCAL,
          'added-asset.png'
        );
    });
    await waitFor(() =>
      expect(runtime.assetStorageService.initialize).toHaveBeenCalledTimes(1)
    );
    expect(runtime.audioPlaylistService.initialize).not.toHaveBeenCalled();
    expect(runtime.assetStorageService.getAllAssets).not.toHaveBeenCalled();
    expect(runtime.assetStorageService.addAsset).not.toHaveBeenCalled();

    await act(async () => {
      deferred.resolve();
      await Promise.all([loadPromise, addPromise]);
    });

    expect(runtime.assetStorageService.initialize).toHaveBeenCalledTimes(1);
    expect(runtime.audioPlaylistService.initialize).toHaveBeenCalledTimes(1);
    expect(runtime.assetStorageService.getAllAssets).toHaveBeenCalledTimes(1);
    expect(runtime.assetStorageService.addAsset).toHaveBeenCalledTimes(1);
    expect(provider.getValue().assets.map((asset) => asset.id)).toContain(
      'added-asset'
    );
    expect(getAssetMapSnapshot().has('added-asset')).toBe(true);
  });

  it('retries initialization after a failed attempt', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    runtime.assetStorageService.initialize
      .mockRejectedValueOnce(new Error('storage unavailable'))
      .mockResolvedValueOnce(undefined);
    const provider = renderHarness();

    await act(async () => provider.getValue().loadAssets());
    expect(provider.getValue().error).toBe('storage unavailable');
    expect(runtime.assetStorageService.cleanup).toHaveBeenCalledTimes(1);

    await act(async () => provider.getValue().loadAssets());

    expect(runtime.assetStorageService.initialize).toHaveBeenCalledTimes(2);
    expect(runtime.audioPlaylistService.initialize).toHaveBeenCalledTimes(1);
    expect(provider.getValue().error).toBeNull();
    expect(getAssetMapStatusSnapshot()).toBe('ready');
  });

  it('keeps AI task deletion and cache/playlist cleanup semantics', async () => {
    runtime.taskStorageReader.getAssetTasks.mockResolvedValue([
      {
        id: 'delete-task',
        type: TaskType.IMAGE,
        createdAt: 200,
        updatedAt: 200,
        completedAt: 200,
        params: { prompt: 'delete me', model: 'image-model' },
        result: {
          url: '/__aitu_cache__/image/delete-task.png',
          format: 'png',
          size: 256,
        },
      },
    ]);
    const provider = renderHarness();
    await act(async () => provider.getValue().loadAssets());

    await act(async () => provider.getValue().removeAsset('delete-task'));

    expect(runtime.deleteTask).toHaveBeenCalledWith('delete-task');
    expect(runtime.unifiedCacheService.deleteCache).toHaveBeenCalledWith(
      '/__aitu_cache__/image/delete-task.png'
    );
    expect(
      runtime.audioPlaylistService.removeAssetFromAllPlaylists
    ).toHaveBeenCalledWith('delete-task');
    expect(provider.getValue().assets).toEqual([]);
  });
});

describe('AssetContext startup dependency contract', () => {
  it('keeps heavy storage implementations behind one retryable runtime boundary', () => {
    const contextSource = readFileSync(
      resolve(__dirname, '../AssetContext.tsx'),
      'utf8'
    );
    const drawnixSource = readFileSync(
      resolve(__dirname, '../../drawnix.tsx'),
      'utf8'
    );
    const runtimeSource = readFileSync(
      resolve(__dirname, '../asset-context-runtime.ts'),
      'utf8'
    );
    const heavyImplementations = [
      'asset-storage-service',
      'character-asset-metadata-service',
      'task-storage-reader',
      'unified-cache-service',
      'audio-playlist-service',
      'useAssetSize',
      'storage-quota',
    ];

    expect(contextSource).toContain("import('./asset-context-runtime')");
    expect(contextSource).toContain('createRetriableModuleLoader');
    expect(contextSource).toContain('requestIdleCallback');
    expect(drawnixSource).toMatch(
      /usePostPaintOperability\(\s*board !== null && isAIInputShellMounted\s*\)/
    );
    expect(drawnixSource).toContain(
      'onShellMounted={onAIInputShellMounted}'
    );
    expect(drawnixSource).toContain(
      '<AssetProvider isStartupOperable={isStartupOperable}>'
    );
    expect(drawnixSource).toMatch(
      /<CacheQuotaProvider[\s\S]*?isStartupOperable=\{isStartupOperable\}/
    );
    expect(contextSource).not.toContain("from '../services/task-queue'");
    for (const implementation of heavyImplementations) {
      expect(contextSource).not.toMatch(
        new RegExp(`^import(?!\\s+type).+${implementation}`, 'm')
      );
      expect(runtimeSource).toContain(implementation);
    }
  });
});
