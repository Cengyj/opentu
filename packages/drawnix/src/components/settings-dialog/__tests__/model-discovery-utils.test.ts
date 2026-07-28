import { describe, expect, it } from 'vitest';
import { ModelVendor, type ModelConfig } from '../../../constants/model-config';
import { getRecommendedDiscoveredModelIds } from '../model-discovery-utils';

function createTextModel(id: string): ModelConfig {
  return {
    id,
    label: id,
    type: 'text',
    vendor: ModelVendor.GPT,
  };
}

describe('model-discovery-utils', () => {
  it('推荐操作只包含当前默认展示模型，不会自动选择旧模型', () => {
    const models = [
      createTextModel('gpt-5.6-sol'),
      createTextModel('gpt-5.6-terra'),
      createTextModel('gpt-5.6-luna'),
      createTextModel('gpt-5.5'),
      createTextModel('gpt-5.4'),
      createTextModel('gpt-5.4-mini'),
      createTextModel('custom-text-model'),
    ];

    expect(getRecommendedDiscoveredModelIds(models)).toEqual([
      'gpt-5.6-sol',
      'gpt-5.6-terra',
      'gpt-5.6-luna',
    ]);
  });
});
