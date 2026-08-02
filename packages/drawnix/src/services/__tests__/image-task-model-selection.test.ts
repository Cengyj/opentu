import { beforeEach, describe, expect, it, vi } from 'vitest';
import { resolveImageTaskModelSelection } from '../image-task-model-selection';

const mocks = vi.hoisted(() => ({
  resolveInvocationRoute: vi.fn(),
}));

vi.mock('../../utils/settings-manager', () => ({
  createModelRef: (profileId?: string | null, modelId?: string | null) =>
    profileId || modelId
      ? { profileId: profileId || null, modelId: modelId || null }
      : null,
  resolveInvocationRoute: mocks.resolveInvocationRoute,
}));

vi.mock('../../constants/model-config', () => ({
  getDefaultImageModel: () => 'default-image',
}));

describe('resolveImageTaskModelSelection', () => {
  beforeEach(() => {
    mocks.resolveInvocationRoute.mockReset();
  });

  it('preserves an exact provider-scoped ModelRef over a stale bare model', () => {
    const result = resolveImageTaskModelSelection('stale-model', {
      profileId: 'profile-b',
      modelId: 'same-model',
    });

    expect(result).toEqual({
      model: 'same-model',
      modelRef: { profileId: 'profile-b', modelId: 'same-model' },
    });
    expect(mocks.resolveInvocationRoute).not.toHaveBeenCalled();
  });

  it('freezes a bare model to the profile selected by the existing route', () => {
    mocks.resolveInvocationRoute.mockReturnValue({
      profileId: 'profile-a',
      modelId: 'same-model',
    });

    const result = resolveImageTaskModelSelection('same-model');

    expect(mocks.resolveInvocationRoute).toHaveBeenCalledWith(
      'image',
      'same-model'
    );
    expect(result).toEqual({
      model: 'same-model',
      modelRef: { profileId: 'profile-a', modelId: 'same-model' },
    });
  });

  it('uses the routed model instead of inventing identity from the fallback name', () => {
    mocks.resolveInvocationRoute.mockReturnValue({
      profileId: 'profile-default',
      modelId: 'catalog-image',
    });

    expect(resolveImageTaskModelSelection()).toEqual({
      model: 'catalog-image',
      modelRef: {
        profileId: 'profile-default',
        modelId: 'catalog-image',
      },
    });
    expect(mocks.resolveInvocationRoute).toHaveBeenCalledWith('image', null);
  });
});
