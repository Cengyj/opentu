import { describe, expect, it } from 'vitest';
import {
  IMAGE_MODELS,
  ModelVendor,
  type ModelConfig,
} from '../../constants/model-config';
import {
  compareModelsByDisplayPriority,
  sortModelsByDisplayPriority,
} from '../model-sort';

function createImageModel(
  id: string,
  overrides: Partial<ModelConfig> = {}
): ModelConfig {
  return {
    id,
    label: id,
    type: 'image',
    vendor: ModelVendor.GEMINI,
    ...overrides,
  };
}

describe('model-sort', () => {
  it('在没有显式顺序时按版本号从新到旧排序', () => {
    const models = [
      createImageModel('gemini-2.5-flash-image'),
      createImageModel('gemini-3-pro-image-preview'),
      createImageModel('gemini-3.1-flash-image-preview'),
    ];

    expect(sortModelsByDisplayPriority(models).map((model) => model.id)).toEqual([
      'gemini-3.1-flash-image-preview',
      'gemini-3-pro-image-preview',
      'gemini-2.5-flash-image',
    ]);
  });

  it('不会让分辨率后缀盖过主版本号', () => {
    const models = [
      createImageModel('gemini-3-pro-image-preview-4k'),
      createImageModel('gemini-3.1-flash-image-preview'),
    ];

    expect(sortModelsByDisplayPriority(models).map((model) => model.id)).toEqual([
      'gemini-3.1-flash-image-preview',
      'gemini-3-pro-image-preview-4k',
    ]);
  });

  it('显式顺序优先于版本号', () => {
    const pinnedModel = {
      ...createImageModel('gemini-2.5-flash-image'),
      sortOrder: 0,
    } as ModelConfig & { sortOrder: number };
    const newerModel = createImageModel('gemini-3.1-flash-image-preview');

    expect(compareModelsByDisplayPriority(pinnedModel, newerModel)).toBeLessThan(0);
  });

  it('同版本时 Pro 优先于非 Pro', () => {
    const models = [
      createImageModel('gemini-3-flash-image-preview'),
      createImageModel('gemini-3-pro-image-preview'),
    ];

    expect(sortModelsByDisplayPriority(models).map((model) => model.id)).toEqual([
      'gemini-3-pro-image-preview',
      'gemini-3-flash-image-preview',
    ]);
  });

  it('同模型族中新版优先于旧版的更高推荐分', () => {
    const models = [
      createImageModel('gemini-2.5-flash-image', {
        recommendedScore: 100,
      }),
      createImageModel('gemini-3.1-flash-image-preview', {
        recommendedScore: 1,
      }),
    ];

    expect(sortModelsByDisplayPriority(models).map((model) => model.id)).toEqual([
      'gemini-3.1-flash-image-preview',
      'gemini-2.5-flash-image',
    ]);
  });

  it('同模型族同版本时推荐分优先于档位启发式', () => {
    const models = [
      createImageModel('gemini-3-pro-image-preview', {
        recommendedScore: 90,
      }),
      createImageModel('gemini-3-flash-image-preview', {
        recommendedScore: 100,
      }),
    ];

    expect(sortModelsByDisplayPriority(models).map((model) => model.id)).toEqual([
      'gemini-3-flash-image-preview',
      'gemini-3-pro-image-preview',
    ]);
  });

  it('同版本同档位时 4K 优先于 2K 和默认', () => {
    const models = [
      createImageModel('gemini-3-pro-image-preview'),
      createImageModel('gemini-3-pro-image-preview-2k'),
      createImageModel('gemini-3-pro-image-preview-4k'),
    ];

    expect(sortModelsByDisplayPriority(models).map((model) => model.id)).toEqual([
      'gemini-3-pro-image-preview-4k',
      'gemini-3-pro-image-preview-2k',
      'gemini-3-pro-image-preview',
    ]);
  });

  it('推荐分优先于跨系列名称和版本排序', () => {
    const models = [
      createImageModel('gpt-4o-image', {
        vendor: ModelVendor.GPT,
        recommendedScore: -999,
      }),
      createImageModel('gpt-image-2', {
        vendor: ModelVendor.GPT,
        recommendedScore: 95,
      }),
      createImageModel('gpt-image-1', {
        vendor: ModelVendor.GPT,
        recommendedScore: 87,
      }),
    ];

    expect(sortModelsByDisplayPriority(models).map((model) => model.id)).toEqual([
      'gpt-image-2',
      'gpt-image-1',
      'gpt-4o-image',
    ]);
  });

  it('真实静态 Gemini 图片目录保持新版本优先', () => {
    const targetModelIds = new Set([
      'gemini-2.5-flash-image',
      'gemini-3-pro-image-preview',
      'gemini-3.1-flash-image-preview',
    ]);

    expect(
      sortModelsByDisplayPriority(
        IMAGE_MODELS.filter((model) => targetModelIds.has(model.id))
      ).map((model) => model.id)
    ).toEqual([
      'gemini-3.1-flash-image-preview',
      'gemini-3-pro-image-preview',
      'gemini-2.5-flash-image',
    ]);
  });
});
