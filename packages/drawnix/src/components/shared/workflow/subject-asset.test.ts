import { describe, expect, it } from 'vitest';
import { AssetCategory, AssetSource, AssetType, type Asset } from '../../../types/asset.types';
import { applySubjectAssetToCharacter } from './subject-asset';

const baseCharacter = {
  id: 'char_1',
  name: '旧名称',
  description: '用户已编辑描述',
};

function createAsset(patch: Partial<Asset>): Asset {
  return {
    id: 'asset_1',
    type: AssetType.IMAGE,
    source: AssetSource.LOCAL,
    url: 'cache://subject.png',
    name: '普通图片.png',
    mimeType: 'image/png',
    createdAt: 1,
    ...patch,
  };
}

describe('applySubjectAssetToCharacter', () => {
  it('uses explicit subject metadata and a lightweight URL reference', () => {
    const result = applySubjectAssetToCharacter(
      baseCharacter,
      createAsset({
        category: AssetCategory.CHARACTER,
        characterMeta: {
          name: '主体名称',
          prompt: 'subject appearance',
        },
      })
    );

    expect(result).toEqual({
      ...baseCharacter,
      name: '主体名称',
      description: 'subject appearance',
      referenceImageUrl: 'cache://subject.png',
    });
  });

  it('uses an ordinary image name without erasing the edited description', () => {
    const result = applySubjectAssetToCharacter(
      baseCharacter,
      createAsset({})
    );

    expect(result).toEqual({
      ...baseCharacter,
      name: '普通图片.png',
      description: '用户已编辑描述',
      referenceImageUrl: 'cache://subject.png',
    });
  });
});
