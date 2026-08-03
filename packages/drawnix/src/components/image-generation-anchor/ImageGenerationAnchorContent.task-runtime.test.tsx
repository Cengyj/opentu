import React from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { PlaitBoard } from '@plait/core';
import type { ImageGenerationAnchorTaskRuntime } from '../../services/image-generation-anchor-task-runtime';
import {
  IMAGE_GENERATION_ANCHOR_RETRY_EVENT,
  type PlaitImageGenerationAnchor,
} from '../../types/image-generation-anchor.types';
import { TaskStatus, TaskType, type Task } from '../../types/task.types';
import type { ImageGenerationAnchorControllerResult } from '../../utils/image-generation-anchor-controller';
import { ImageGenerationAnchorContent } from './ImageGenerationAnchorContent';

const runtimeMocks = vi.hoisted(() => ({
  load: vi.fn(),
  updateAnchor: vi.fn(),
  useController: vi.fn(),
}));

vi.mock('../../services/image-generation-anchor-task-runtime', () => ({
  loadImageGenerationAnchorTaskRuntime: runtimeMocks.load,
}));

vi.mock('../../hooks/useImageGenerationAnchorController', () => ({
  useImageGenerationAnchorController: runtimeMocks.useController,
}));

vi.mock('./image-generation-anchor.transforms', () => ({
  ImageGenerationAnchorTransforms: {
    updateAnchor: runtimeMocks.updateAnchor,
  },
}));

interface Deferred<T> {
  promise: Promise<T>;
  resolve: (value: T) => void;
}

function createDeferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });

  return { promise, resolve };
}

function createAnchor(): PlaitImageGenerationAnchor {
  return {
    id: 'anchor-1',
    type: 'generation-anchor',
    points: [
      [10, 20],
      [330, 200],
    ],
    angle: 0,
    anchorType: 'ratio',
    phase: 'failed',
    title: '图片生成',
    subtitle: '生成失败，请重试',
    progress: null,
    error: '供应商拒绝请求',
    transitionMode: 'hold',
    createdAt: 1,
    workflowId: 'workflow-1',
    taskIds: ['task-1'],
    primaryTaskId: 'task-1',
    requestedCount: 1,
    zoom: 1,
    children: [],
  };
}

function createFailedTask(): Task {
  return {
    id: 'task-1',
    type: TaskType.IMAGE,
    status: TaskStatus.FAILED,
    params: {
      prompt: '生成图片',
      workflowId: 'workflow-1',
    },
    error: {
      code: 'PROVIDER_FAILURE',
      message: '供应商拒绝请求',
    },
    createdAt: 1,
    updatedAt: 2,
    insertedToCanvas: false,
  };
}

function createRuntime(): ImageGenerationAnchorTaskRuntime {
  const task = createFailedTask();

  return {
    taskQueueService: {
      getAllTasks: () => [task],
    },
    workflowCompletionService: {
      getPostProcessingStatus: () => undefined,
    },
  } as unknown as ImageGenerationAnchorTaskRuntime;
}

function createControllerResult(): ImageGenerationAnchorControllerResult {
  return {
    phase: 'failed',
    nextPatch: {
      phase: 'failed',
      progress: null,
      error: '供应商拒绝请求',
    },
    viewModel: {
      id: 'anchor-1',
      anchorType: 'ratio',
      phase: 'failed',
      title: '图片生成',
      subtitle: '生成失败，请重试',
      progress: null,
      progressMode: 'hidden',
      phaseLabel: '失败',
      tone: 'danger',
      geometry: {
        position: [10, 20],
        width: 320,
        height: 180,
      },
      transitionMode: 'hold',
      primaryAction: { type: 'retry', label: '重试' },
      secondaryAction: { type: 'dismiss', label: '关闭' },
      error: '供应商拒绝请求',
      isTerminal: true,
    },
  };
}

function renderFailedAnchor() {
  const board = {
    deleteFragment: vi.fn(),
  } as unknown as PlaitBoard;
  const element = createAnchor();
  const view = render(
    <ImageGenerationAnchorContent
      board={board}
      element={element}
      selected={false}
    />
  );

  return { board, element, ...view };
}

afterEach(cleanup);

describe('ImageGenerationAnchorContent task runtime boundary', () => {
  beforeEach(() => {
    runtimeMocks.load.mockReset();
    runtimeMocks.updateAnchor.mockReset();
    runtimeMocks.useController.mockReset();
    runtimeMocks.useController.mockReturnValue(createControllerResult());
  });

  it('does not load TaskQueue merely by rendering an anchor', () => {
    renderFailedAnchor();

    expect(runtimeMocks.load).not.toHaveBeenCalled();
  });

  it('keeps concurrent retry clicks single-flight and dispatches once', async () => {
    const deferred = createDeferred<ImageGenerationAnchorTaskRuntime>();
    runtimeMocks.load.mockReturnValue(deferred.promise);
    const retryEvents: CustomEvent<{ taskId: string; anchorId: string }>[] = [];
    const onRetry = (event: Event) => {
      retryEvents.push(
        event as CustomEvent<{ taskId: string; anchorId: string }>
      );
    };
    window.addEventListener(IMAGE_GENERATION_ANCHOR_RETRY_EVENT, onRetry);
    renderFailedAnchor();

    const retryButton = screen.getByRole('button', { name: '重试' });
    fireEvent.click(retryButton);
    fireEvent.click(retryButton);

    expect(runtimeMocks.load).toHaveBeenCalledTimes(1);
    await act(async () => {
      deferred.resolve(createRuntime());
      await deferred.promise;
    });

    await waitFor(() => expect(retryEvents).toHaveLength(1));
    expect(retryEvents[0].detail).toEqual({
      taskId: 'task-1',
      anchorId: 'anchor-1',
    });
    expect(runtimeMocks.updateAnchor).toHaveBeenCalledTimes(1);
    window.removeEventListener(IMAGE_GENERATION_ANCHOR_RETRY_EVENT, onRetry);
  });

  it('clears a failed load attempt so the next retry can load and dispatch', async () => {
    runtimeMocks.load
      .mockRejectedValueOnce(new Error('任务运行时加载失败'))
      .mockResolvedValueOnce(createRuntime());
    const retryEvents: Event[] = [];
    const onRetry = (event: Event) => retryEvents.push(event);
    window.addEventListener(IMAGE_GENERATION_ANCHOR_RETRY_EVENT, onRetry);
    renderFailedAnchor();

    fireEvent.click(screen.getByRole('button', { name: '重试' }));
    await waitFor(() => {
      expect(runtimeMocks.updateAnchor).toHaveBeenCalledWith(
        expect.anything(),
        'anchor-1',
        expect.objectContaining({
          phase: 'failed',
          error: '任务运行时加载失败',
        })
      );
    });
    await act(async () => {
      await Promise.resolve();
    });

    fireEvent.click(screen.getByRole('button', { name: '重试' }));

    await waitFor(() => expect(retryEvents).toHaveLength(1));
    expect(runtimeMocks.load).toHaveBeenCalledTimes(2);
    window.removeEventListener(IMAGE_GENERATION_ANCHOR_RETRY_EVENT, onRetry);
  });

  it('does not update the board or dispatch after unmount during loading', async () => {
    const deferred = createDeferred<ImageGenerationAnchorTaskRuntime>();
    runtimeMocks.load.mockReturnValue(deferred.promise);
    const onRetry = vi.fn();
    window.addEventListener(IMAGE_GENERATION_ANCHOR_RETRY_EVENT, onRetry);
    const view = renderFailedAnchor();

    fireEvent.click(screen.getByRole('button', { name: '重试' }));
    view.unmount();
    await act(async () => {
      deferred.resolve(createRuntime());
      await deferred.promise;
    });

    expect(runtimeMocks.updateAnchor).not.toHaveBeenCalled();
    expect(onRetry).not.toHaveBeenCalled();
    window.removeEventListener(IMAGE_GENERATION_ANCHOR_RETRY_EVENT, onRetry);
  });
});
