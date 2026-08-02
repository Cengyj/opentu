import { describe, expect, it } from 'vitest';
import { ModelVendor, type ModelConfig } from '../../constants/model-config';
import { findMatchingSelectableModel } from '../model-selection';

function createModel(
  profileId: string | null,
  modelId = 'shared-image-model'
): ModelConfig {
  return {
    id: modelId,
    label: `${profileId || 'static'} model`,
    type: 'image',
    vendor: ModelVendor.OTHER,
    sourceProfileId: profileId || undefined,
    selectionKey: profileId ? `${profileId}::${modelId}` : modelId,
  };
}

describe('model selection identity', () => {
  it('does not cross profiles when a ModelRef names a provider', () => {
    const staticModel = createModel(null);
    const providerBModel = createModel('provider-b');

    expect(
      findMatchingSelectableModel(
        [staticModel, providerBModel],
        'shared-image-model',
        { profileId: 'provider-a', modelId: 'shared-image-model' }
      )
    ).toBeUndefined();
  });

  it('accepts an unscoped model only when the selection is also unscoped', () => {
    const staticModel = createModel(null);

    expect(
      findMatchingSelectableModel([staticModel], 'shared-image-model', null)
    ).toBe(staticModel);
  });

  it('resolves a missing Profile only when one scoped candidate exists', () => {
    const providerAModel = createModel('provider-a');
    const providerBModel = createModel('provider-b');

    expect(
      findMatchingSelectableModel(
        [providerAModel],
        'shared-image-model',
        null
      )
    ).toBe(providerAModel);
    expect(
      findMatchingSelectableModel(
        [providerAModel, providerBModel],
        'shared-image-model',
        null
      )
    ).toBeUndefined();
  });
});
