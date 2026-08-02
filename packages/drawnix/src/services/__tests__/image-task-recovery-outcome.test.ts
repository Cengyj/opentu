import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ImageTaskRecoveryIdentity } from '../image-task-recovery-guard';
import {
  completeImageTaskRecovery,
  failImageTaskRecovery,
} from '../image-task-recovery-outcome';

const mocks = vi.hoisted(() => ({
  completeImageExecution: vi.fn(),
  failImageExecution: vi.fn(),
}));

vi.mock('../media-executor/image-execution-outcome', () => mocks);

const recoveryIdentity: ImageTaskRecoveryIdentity = {
  taskId: 'image-recovery-1',
  remoteId: 'remote-1',
  startedAt: 123,
  profileId: 'profile-a',
  modelId: 'model-a',
  bindingId: 'binding-a',
};

describe('image task recovery terminal outcome', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('commits success through the guarded image terminal writer', async () => {
    const result = {
      url: 'cache://image-recovery-1.png',
      format: 'png',
      size: 1,
    };
    const outcome = {
      taskId: recoveryIdentity.taskId,
      status: 'completed' as const,
      attemptStartedAt: recoveryIdentity.startedAt,
      result,
      updatedAt: 456,
    };
    mocks.completeImageExecution.mockResolvedValue(outcome);

    await expect(
      completeImageTaskRecovery(recoveryIdentity, result)
    ).resolves.toBe(outcome);
    expect(mocks.completeImageExecution).toHaveBeenCalledOnce();
    expect(mocks.completeImageExecution).toHaveBeenCalledWith(
      recoveryIdentity.taskId,
      result,
      recoveryIdentity.startedAt
    );
  });

  it('commits failure through the guarded image terminal writer', async () => {
    const error = { code: 'IMAGE_RECOVERY_FAILED', message: 'poll failed' };
    const outcome = {
      taskId: recoveryIdentity.taskId,
      status: 'failed' as const,
      attemptStartedAt: recoveryIdentity.startedAt,
      error,
      updatedAt: 789,
    };
    mocks.failImageExecution.mockResolvedValue(outcome);

    await expect(failImageTaskRecovery(recoveryIdentity, error)).resolves.toBe(
      outcome
    );
    expect(mocks.failImageExecution).toHaveBeenCalledOnce();
    expect(mocks.failImageExecution).toHaveBeenCalledWith(
      recoveryIdentity.taskId,
      error,
      recoveryIdentity.startedAt
    );
  });
});
