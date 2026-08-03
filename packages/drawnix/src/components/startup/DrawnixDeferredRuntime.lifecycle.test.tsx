// @vitest-environment jsdom

import React from 'react';
import { act, render, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DrawnixDeferredRuntime } from './DrawnixDeferredRuntime';

const runtimeMocks = vi.hoisted(() => {
  let releaseWorkZoneModule!: () => void;
  const workZoneModuleGate = new Promise<void>((resolve) => {
    releaseWorkZoneModule = resolve;
  });

  return {
    taskStorageReady: true,
    workZoneModuleGate,
    releaseWorkZoneModule,
    workZoneImportStarted: vi.fn(),
    workflowSubscribe: vi.fn(() => ({ unsubscribe: vi.fn() })),
    taskQueueSubscribe: vi.fn(() => ({ unsubscribe: vi.fn() })),
    observeTaskUpdates: vi.fn(),
    initVideoRecoveryService: vi.fn(),
    initializeAssetIntegration: vi.fn(() => vi.fn()),
  };
});

runtimeMocks.observeTaskUpdates.mockImplementation(() => ({
  subscribe: runtimeMocks.taskQueueSubscribe,
}));

vi.mock('../../hooks/useTaskStorage', () => ({
  useTaskStorage: () => runtimeMocks.taskStorageReady,
}));

vi.mock('../../hooks/useTaskExecutor', () => ({
  useTaskExecutor: vi.fn(),
}));

vi.mock('../../hooks/useAutoInsertToCanvas', () => ({
  useAutoInsertToCanvas: vi.fn(),
}));

vi.mock('../../hooks/useImageGenerationAnchorSync', () => ({
  useImageGenerationAnchorSync: vi.fn(),
}));

vi.mock('../../hooks/useBeforeUnload', () => ({
  useBeforeUnload: vi.fn(),
}));

vi.mock('../../hooks/use-provider-profiles', () => ({
  useProviderProfiles: () => [],
}));

vi.mock('../../services/asset-integration-service', () => ({
  initializeAssetIntegration: runtimeMocks.initializeAssetIntegration,
}));

vi.mock('../../services/font-manager-service', () => ({
  fontManagerService: { preloadBoardFonts: vi.fn(() => Promise.resolve()) },
}));

vi.mock('../../utils/model-pricing-service', () => ({
  modelPricingService: { warmupProfiles: vi.fn() },
}));

vi.mock('../../services/workflow-submission-service', () => ({
  workflowSubmissionService: {
    subscribeToAllEvents: runtimeMocks.workflowSubscribe,
  },
}));

vi.mock('../../plugins/with-workzone', async () => {
  runtimeMocks.workZoneImportStarted();
  await runtimeMocks.workZoneModuleGate;
  return {
    WorkZoneTransforms: {
      getAllWorkZones: vi.fn(() => []),
      removeWorkZone: vi.fn(),
      updateWorkflow: vi.fn(),
    },
  };
});

vi.mock('../../services/task-queue', () => ({
  taskQueueService: {
    observeTaskUpdates: runtimeMocks.observeTaskUpdates,
    getAllTasks: vi.fn(() => []),
    getTask: vi.fn(),
    updateTaskStatus: vi.fn(),
  },
}));

vi.mock('../../types/task.types', () => ({
  TaskStatus: {
    COMPLETED: 'completed',
    FAILED: 'failed',
    CANCELLED: 'cancelled',
    PROCESSING: 'processing',
    PENDING: 'pending',
  },
}));

vi.mock('../../hooks/useWorkflowSubmission', () => ({
  workflowRecoveryPromise: new Promise<void>(() => undefined),
}));

vi.mock('../../services/media-executor/fallback-executor', () => ({
  fallbackMediaExecutor: { resumePendingTasks: vi.fn() },
}));

vi.mock('../../services/video-recovery-service', () => ({
  initVideoRecoveryService: runtimeMocks.initVideoRecoveryService,
}));

describe('DrawnixDeferredRuntime lifecycle', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('does not install workflow or task subscriptions after unmount', async () => {
    const view = render(
      <DrawnixDeferredRuntime
        board={{} as Parameters<typeof DrawnixDeferredRuntime>[0]['board']}
        value={[]}
      />
    );

    await waitFor(() =>
      expect(runtimeMocks.workZoneImportStarted).toHaveBeenCalledTimes(1)
    );
    view.unmount();

    await act(async () => {
      runtimeMocks.releaseWorkZoneModule();
      await runtimeMocks.workZoneModuleGate;
      await vi.dynamicImportSettled();
    });

    expect(runtimeMocks.workflowSubscribe).not.toHaveBeenCalled();
    expect(runtimeMocks.observeTaskUpdates).not.toHaveBeenCalled();
  });

  it('cancels the workflow-recovery timeout when the runtime unmounts', async () => {
    vi.useFakeTimers();
    const setTimeoutSpy = vi.spyOn(window, 'setTimeout');
    const clearTimeoutSpy = vi.spyOn(window, 'clearTimeout');
    const view = render(<DrawnixDeferredRuntime board={null} value={[]} />);

    await act(async () => {
      vi.advanceTimersByTime(500);
      await vi.dynamicImportSettled();
    });

    const recoveryTimerIndex = setTimeoutSpy.mock.calls.findIndex(
      ([, delay]) => delay === 5000
    );
    expect(recoveryTimerIndex).toBeGreaterThanOrEqual(0);
    const recoveryTimerId = setTimeoutSpy.mock.results[recoveryTimerIndex]?.value;

    view.unmount();

    expect(clearTimeoutSpy).toHaveBeenCalledWith(recoveryTimerId);
  });
});
