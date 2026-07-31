/**
 * @vitest-environment node
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  AssetCategory,
  AssetSource,
  AssetType,
  type Asset,
} from '../types/asset.types';
import { markAssetAsCharacter } from './character-asset-metadata-service';

const mocks = vi.hoisted(() => {
  class TaskStorageTaskNotFoundError extends Error {
    readonly code = 'TASK_NOT_FOUND';

    constructor(taskId: string, operation: string) {
      super(`Task ${taskId} not found while trying to ${operation}`);
      this.name = 'TaskStorageTaskNotFoundError';
    }
  }

  return {
    updateCachedMedia: vi.fn(),
    updateAssetMetadata: vi.fn(),
    mergeTaskParams: vi.fn(),
    TaskStorageTaskNotFoundError,
  };
});

vi.mock('./unified-cache-service', () => ({
  unifiedCacheService: {
    updateCachedMedia: mocks.updateCachedMedia,
  },
}));

vi.mock('./asset-storage-service', () => ({
  assetStorageService: {
    updateAssetMetadata: mocks.updateAssetMetadata,
  },
}));

vi.mock('./media-executor/task-storage-writer', () => ({
  taskStorageWriter: {
    mergeTaskParams: mocks.mergeTaskParams,
  },
  TaskStorageTaskNotFoundError: mocks.TaskStorageTaskNotFoundError,
}));

function aiGeneratedAsset(): Asset {
  return {
    id: 'task-history-cleared',
    taskId: 'task-history-cleared',
    type: AssetType.IMAGE,
    source: AssetSource.AI_GENERATED,
    url: '/__aitu_cache__/image/content-character.png',
    name: 'Generated character',
    mimeType: 'image/png',
    createdAt: 1,
  };
}

describe('markAssetAsCharacter', () => {
  beforeEach(() => {
    mocks.updateCachedMedia.mockReset();
    mocks.updateAssetMetadata.mockReset();
    mocks.mergeTaskParams.mockReset();
  });

  it('keeps cached character metadata when the linked task history was cleared', async () => {
    mocks.updateCachedMedia.mockResolvedValue(undefined);
    mocks.mergeTaskParams.mockRejectedValue(
      new mocks.TaskStorageTaskNotFoundError(
        'task-history-cleared',
        'merge task params'
      )
    );

    await expect(
      markAssetAsCharacter(aiGeneratedAsset(), {
        name: 'Alice',
        prompt: 'Portrait reference',
      })
    ).resolves.toBeUndefined();

    const metadata = {
      category: AssetCategory.CHARACTER,
      characterName: 'Alice',
      characterPrompt: 'Portrait reference',
    };
    expect(mocks.updateCachedMedia).toHaveBeenCalledWith(
      '/__aitu_cache__/image/content-character.png',
      { metadata }
    );
    expect(mocks.mergeTaskParams).toHaveBeenCalledWith('task-history-cleared', {
      assetMetadata: metadata,
    });
  });

  it('propagates storage errors other than a missing task record', async () => {
    const storageError = new Error('IndexedDB quota exceeded');
    mocks.updateCachedMedia.mockResolvedValue(undefined);
    mocks.mergeTaskParams.mockRejectedValue(storageError);

    await expect(
      markAssetAsCharacter(aiGeneratedAsset(), { name: 'Alice' })
    ).rejects.toBe(storageError);

    expect(mocks.updateCachedMedia).toHaveBeenCalledTimes(1);
  });
});
