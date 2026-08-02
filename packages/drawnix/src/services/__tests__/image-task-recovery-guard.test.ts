import { describe, expect, it } from 'vitest';
import { TaskStatus, TaskType, type Task } from '../../types/task.types';
import {
  captureImageTaskRecoveryIdentity,
  isCurrentImageTaskRecovery,
  resolveImageTaskHookAction,
  shouldHookManageImageTaskTimeout,
  shouldStartImageTaskRecovery,
} from '../image-task-recovery-guard';

function createTask(overrides: Partial<Task> = {}): Task {
  return {
    id: 'image-recovery-1',
    type: TaskType.IMAGE,
    status: TaskStatus.PROCESSING,
    remoteId: 'remote-1',
    startedAt: 100,
    createdAt: 1,
    updatedAt: 2,
    params: {
      prompt: 'recover image',
      model: 'gpt-image-2',
      modelRef: { profileId: 'profile-a', modelId: 'gpt-image-2' },
    },
    invocationRoute: {
      operation: 'image',
      providerProfileId: 'profile-a',
      providerType: 'auto',
      modelId: 'gpt-image-2',
      modelRef: { profileId: 'profile-a', modelId: 'gpt-image-2' },
      binding: {
        id: 'binding-a',
        protocol: 'openai.async.media',
        requestSchema: 'openai.async.image.form',
        responseSchema: 'openai.async.task',
        submitPath: '/videos',
        pollPathTemplate: '/videos/{taskId}',
      },
    },
    ...overrides,
  };
}

function requireRecoveryIdentity(task: Task) {
  const identity = captureImageTaskRecoveryIdentity(task);
  if (!identity) {
    throw new Error('Expected a recoverable image task identity');
  }
  return identity;
}

function createReplacementBindingRoute() {
  const route = createTask().invocationRoute;
  if (!route?.binding) {
    throw new Error('Expected a persisted image binding');
  }
  return {
    ...route,
    binding: {
      ...route.binding,
      id: 'binding-b',
    },
  };
}

describe('image task recovery guard', () => {
  const currentSessionRuntime = {
    isTaskOwnedByCurrentSession: () => true,
  };
  const restoredRuntime = {
    isTaskOwnedByCurrentSession: () => false,
  };

  it('does not start a second poller when a live queue task emits its remote id', () => {
    const task = createTask();

    expect(
      shouldStartImageTaskRecovery(task, currentSessionRuntime)
    ).toBe(false);
    expect(
      shouldHookManageImageTaskTimeout(task, currentSessionRuntime)
    ).toBe(false);
  });

  it('allows a restored task to resume polling without owning a new submit', () => {
    const task = createTask();

    expect(shouldStartImageTaskRecovery(task, restoredRuntime)).toBe(true);
    expect(
      shouldHookManageImageTaskTimeout(task, restoredRuntime)
    ).toBe(true);
  });

  it('gives the hook query-only authority for a restored acknowledged job', () => {
    expect(resolveImageTaskHookAction(createTask(), restoredRuntime)).toBe(
      'recover-query-only'
    );
  });

  it('fails a restored pending image without granting submit authority', () => {
    expect(
      resolveImageTaskHookAction(
        createTask({ status: TaskStatus.PENDING, remoteId: undefined }),
        restoredRuntime
      )
    ).toBe('fail-interrupted');
  });

  it('ignores current-session image work owned by TaskQueue', () => {
    expect(
      resolveImageTaskHookAction(
        createTask({ status: TaskStatus.PENDING, remoteId: undefined }),
        currentSessionRuntime
      )
    ).toBe('ignore-owned-or-inactive');
  });

  it('accepts progress updates for the same persisted recovery identity', () => {
    const task = createTask();
    const identity = requireRecoveryIdentity(task);

    expect(
      isCurrentImageTaskRecovery(
        { ...task, progress: 75, updatedAt: task.updatedAt + 20 },
        identity
      )
    ).toBe(true);
  });

  it.each([
    ['cancelled status', { status: TaskStatus.CANCELLED }],
    ['failed status', { status: TaskStatus.FAILED }],
    ['retry start', { startedAt: 200 }],
    ['replacement remote id', { remoteId: 'remote-2' }],
    [
      'replacement binding',
      {
        invocationRoute: createReplacementBindingRoute(),
      },
    ],
  ])('rejects a late result after %s', (_name, overrides) => {
    const task = createTask();
    const identity = requireRecoveryIdentity(task);

    expect(
      isCurrentImageTaskRecovery(
        createTask(overrides as Partial<Task>),
        identity
      )
    ).toBe(false);
  });

  it('does not capture a processing image without a remote id', () => {
    expect(
      captureImageTaskRecoveryIdentity(createTask({ remoteId: undefined }))
    ).toBeNull();
  });
});
