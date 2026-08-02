import { describe, expect, it } from 'vitest';
import type { AssetTaskRecord } from '../services/task-storage-reader';
import { AssetSource, AssetType } from '../types/asset.types';
import { TaskType } from '../types/task.types';
import {
  getAIGeneratedAssetCleanupTargets,
  mapImageTaskToAssets,
} from './asset-task-mapper';

function createImageTask(
  overrides: Partial<AssetTaskRecord> = {}
): AssetTaskRecord {
  return {
    id: 'image-task-1',
    type: TaskType.IMAGE,
    createdAt: 1,
    updatedAt: 1,
    completedAt: 2,
    params: {
      prompt: 'asset prompt',
      model: 'image-model',
    },
    result: {
      url: '/cache/image-1.png',
      format: 'png',
      size: 128,
    },
    ...overrides,
  };
}

describe('mapImageTaskToAssets', () => {
  it('keeps every unique image artifact in provider order', () => {
    const task = createImageTask({
      result: {
        url: '/cache/image-1.png',
        urls: [
          '/cache/image-1.png',
          '/cache/image-2.png',
          '/cache/image-1.png',
        ],
        format: 'png',
        size: 128,
      },
    });

    const assets = mapImageTaskToAssets(task);

    expect(assets.map(({ id, url, name }) => [id, url, name])).toEqual([
      ['image-task-1', '/cache/image-1.png', 'asset prompt 1'],
      ['image-task-1::image:1', '/cache/image-2.png', 'asset prompt 2'],
    ]);
    expect(assets).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          taskId: 'image-task-1',
          type: AssetType.IMAGE,
          source: AssetSource.AI_GENERATED,
          mimeType: 'image/png',
          prompt: 'asset prompt',
          modelName: 'image-model',
        }),
      ])
    );
  });

  it('cleans every image artifact when one task-backed image is removed', () => {
    const siblingAssets = mapImageTaskToAssets(
      createImageTask({
        result: {
          url: '/cache/image-1.png',
          urls: ['/cache/image-1.png', '/cache/image-2.png'],
          format: 'png',
          size: 128,
        },
      })
    );
    const unrelatedAssets = mapImageTaskToAssets(
      createImageTask({
        id: 'image-task-2',
        result: {
          url: '/cache/image-3.png',
          format: 'png',
          size: 128,
        },
      })
    );

    expect(
      getAIGeneratedAssetCleanupTargets(siblingAssets[1], [
        ...siblingAssets,
        ...unrelatedAssets,
      ])
    ).toEqual({
      taskId: 'image-task-1',
      assetIds: ['image-task-1', 'image-task-1::image:1'],
      urls: ['/cache/image-1.png', '/cache/image-2.png'],
    });
  });

  it('does not expand non-image AI cleanup to sibling media', () => {
    const audioAsset = {
      id: 'audio-task::clip-1',
      taskId: 'audio-task',
      type: AssetType.AUDIO,
      source: AssetSource.AI_GENERATED,
      url: '/cache/audio-1.mp3',
      name: 'clip 1',
      mimeType: 'audio/mpeg',
      createdAt: 1,
    };
    const audioSibling = {
      ...audioAsset,
      id: 'audio-task::clip-2',
      url: '/cache/audio-2.mp3',
      name: 'clip 2',
    };

    expect(
      getAIGeneratedAssetCleanupTargets(audioAsset, [
        audioAsset,
        audioSibling,
      ])
    ).toEqual({
      taskId: 'audio-task',
      assetIds: ['audio-task::clip-1'],
      urls: ['/cache/audio-1.mp3'],
    });
  });

  it('preserves the existing id and name for a single image', () => {
    expect(mapImageTaskToAssets(createImageTask())).toMatchObject([
      {
        id: 'image-task-1',
        taskId: 'image-task-1',
        url: '/cache/image-1.png',
        name: 'asset prompt',
      },
    ]);
  });

  it('uses each canonical artifact MIME instead of one task-level format', () => {
    const assets = mapImageTaskToAssets(
      createImageTask({
        result: {
          url: '/cache/image-1.webp',
          urls: ['/cache/image-1.webp', '/cache/image-2.jpg'],
          imageArtifacts: [
            {
              url: '/cache/image-1.webp',
              source: 'url',
              mimeType: 'image/webp',
              format: 'webp',
            },
            {
              url: '/cache/image-2.jpg',
              source: 'url',
              mimeType: 'image/jpeg',
              format: 'jpg',
            },
          ],
          format: 'webp',
          size: 128,
        },
      })
    );

    expect(assets.map((asset) => asset.mimeType)).toEqual([
      'image/webp',
      'image/jpeg',
    ]);
  });
});
