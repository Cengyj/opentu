import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createGridImageTask } from '../canvas-operations/grid-image';
import { createInspirationBoardTask } from '../canvas-operations/inspiration-board';

const mocks = vi.hoisted(() => ({
  createTask: vi.fn(),
  retryTask: vi.fn(),
  getTask: vi.fn(),
  resolveImageTaskModelSelection: vi.fn(),
}));

vi.mock('../task-queue', () => ({
  taskQueueService: {
    createTask: mocks.createTask,
    retryTask: mocks.retryTask,
    getTask: mocks.getTask,
  },
}));

vi.mock('../image-task-model-selection', () => ({
  resolveImageTaskModelSelection: mocks.resolveImageTaskModelSelection,
}));

describe('canvas image task ModelRef preservation', () => {
  beforeEach(() => {
    mocks.createTask.mockReset();
    mocks.retryTask.mockReset();
    mocks.getTask.mockReset();
    mocks.resolveImageTaskModelSelection.mockReset();
    mocks.resolveImageTaskModelSelection.mockImplementation(
      (model, modelRef) => ({
        model: modelRef?.modelId || model || 'catalog-image',
        modelRef: modelRef || {
          profileId: 'profile-default',
          modelId: model || 'catalog-image',
        },
      })
    );
    mocks.createTask.mockImplementation((params, type) => ({
      id: `task-${mocks.createTask.mock.calls.length}`,
      type,
      status: 'processing',
      params,
    }));
  });

  it('keeps an exact provider-scoped model on grid-image tasks', () => {
    const modelRef = {
      profileId: 'profile-b',
      modelId: 'same-model',
    };

    createGridImageTask({
      theme: 'grid',
      model: 'stale-model',
      modelRef,
    });

    expect(mocks.resolveImageTaskModelSelection).toHaveBeenCalledWith(
      'stale-model',
      modelRef
    );
    expect(mocks.createTask.mock.calls[0]?.[0]).toMatchObject({
      model: 'same-model',
      modelRef,
    });
  });

  it('freezes the routed default model on inspiration-board tasks', () => {
    createInspirationBoardTask({ theme: 'mood board' });

    expect(mocks.resolveImageTaskModelSelection).toHaveBeenCalledWith(
      undefined,
      undefined
    );
    expect(mocks.createTask.mock.calls[0]?.[0]).toMatchObject({
      model: 'catalog-image',
      modelRef: {
        profileId: 'profile-default',
        modelId: 'catalog-image',
      },
    });
  });
});
