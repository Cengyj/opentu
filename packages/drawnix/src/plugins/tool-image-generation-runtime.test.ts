import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TaskType, type TaskEvent } from '../types/task.types';
import {
  ToolMessageType,
  type GenerateImagePayload,
  type ToolMessage,
} from '../types/tool-communication.types';
import { handleToolImageGenerationRequest } from './tool-image-generation-runtime';

const mocks = vi.hoisted(() => ({
  createTask: vi.fn(),
  observeTaskUpdates: vi.fn(),
  getSettings: vi.fn(),
  resolveModelSelection: vi.fn(),
  getArtifacts: vi.fn(),
}));

vi.mock('../services/task-queue', () => ({
  taskQueueService: {
    createTask: mocks.createTask,
    observeTaskUpdates: mocks.observeTaskUpdates,
  },
}));

vi.mock('../utils/settings-manager', () => ({
  geminiSettings: {
    get: mocks.getSettings,
  },
}));

vi.mock('../services/image-task-model-selection', () => ({
  resolveImageTaskModelSelection: mocks.resolveModelSelection,
}));

vi.mock('../utils/image-generation-anchor-batch', () => ({
  getTaskResultImageArtifacts: mocks.getArtifacts,
}));

function createMessage(
  payload: GenerateImagePayload
): ToolMessage<GenerateImagePayload> {
  return {
    version: '1.0',
    type: ToolMessageType.TOOL_TO_BOARD_GENERATE_IMAGE,
    toolId: 'runtime-tool',
    messageId: 'runtime-envelope',
    timestamp: Date.now(),
    payload,
  };
}

describe('tool image generation runtime', () => {
  const isToolConnected = vi.fn().mockReturnValue(true);
  const sendResponse = vi.fn().mockResolvedValue(undefined);
  const bridge = {
    isToolConnected,
    sendResponse,
  };
  const unsubscribe = vi.fn();
  let taskUpdateHandler: ((event: TaskEvent) => void) | null = null;

  beforeEach(() => {
    vi.clearAllMocks();
    isToolConnected.mockReturnValue(true);
    taskUpdateHandler = null;
    mocks.getSettings.mockReturnValue({ imageModelName: 'selected-image' });
    mocks.resolveModelSelection.mockReturnValue({
      model: 'resolved-image',
      modelRef: {
        profileId: 'profile-runtime',
        modelId: 'resolved-image',
      },
    });
    mocks.createTask.mockReturnValue({ id: 'runtime-task' });
    mocks.observeTaskUpdates.mockReturnValue({
      subscribe: vi.fn((handler: (event: TaskEvent) => void) => {
        taskUpdateHandler = handler;
        return { unsubscribe };
      }),
    });
  });

  it('keeps model resolution, task creation and completed iframe response in the original order', async () => {
    const uploadedImages = [{ url: 'data:image/png;base64,AAAA' }];
    await handleToolImageGenerationRequest(
      createMessage({
        prompt: 'runtime prompt',
        size: '16:9',
        width: 640,
        height: 480,
        uploadedImages,
        batchId: 'batch-runtime',
        batchIndex: 1,
        batchTotal: 3,
        globalIndex: 7,
        messageId: 'runtime-response',
      }),
      bridge
    );

    expect(mocks.getSettings).toHaveBeenCalledTimes(1);
    expect(mocks.resolveModelSelection).toHaveBeenCalledWith('selected-image');
    expect(mocks.createTask).toHaveBeenCalledWith(
      {
        prompt: 'runtime prompt',
        aspectRatio: '16:9',
        uploadedImages,
        batchId: 'batch-runtime',
        batchIndex: 1,
        batchTotal: 3,
        globalIndex: 7,
        model: 'resolved-image',
        modelRef: {
          profileId: 'profile-runtime',
          modelId: 'resolved-image',
        },
      },
      TaskType.IMAGE
    );
    expect(mocks.getSettings.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.createTask.mock.invocationCallOrder[0]
    );
    expect(taskUpdateHandler).not.toBeNull();
    expect(sendResponse).not.toHaveBeenCalled();

    mocks.getArtifacts.mockReturnValue([
      {
        url: 'cache://artifact-1',
        source: 'url',
        format: 'png',
        width: 1024,
        height: 576,
      },
      {
        url: 'cache://artifact-2',
        source: 'url',
        format: 'webp',
      },
    ]);
    taskUpdateHandler?.({
      type: 'taskUpdated',
      timestamp: Date.now(),
      task: {
        id: 'runtime-task',
        status: 'completed',
        result: {
          url: 'legacy-result',
          format: 'jpg',
          width: 1,
          height: 1,
        },
      },
    } as TaskEvent);

    expect(sendResponse).toHaveBeenCalledWith(
      {
        success: true,
        responseId: 'runtime-response',
        result: {
          url: 'cache://artifact-1',
          urls: ['cache://artifact-1', 'cache://artifact-2'],
          format: 'png',
          width: 1024,
          height: 576,
        },
      }
    );
    expect(unsubscribe).toHaveBeenCalledTimes(1);
  });

  it('preserves the cancelled-task response and unsubscribes', async () => {
    await handleToolImageGenerationRequest(
      createMessage({
        prompt: 'cancel prompt',
        width: 800,
        height: 600,
      }),
      bridge
    );

    expect(mocks.createTask).toHaveBeenCalledWith(
      expect.objectContaining({
        prompt: 'cancel prompt',
        width: 800,
        height: 600,
      }),
      TaskType.IMAGE
    );

    taskUpdateHandler?.({
      type: 'taskUpdated',
      timestamp: Date.now(),
      task: {
        id: 'runtime-task',
        status: 'cancelled',
      },
    } as TaskEvent);

    expect(sendResponse).toHaveBeenCalledWith(
      {
        success: false,
        responseId: 'runtime-envelope',
        error: '图片生成已取消',
      }
    );
    expect(unsubscribe).toHaveBeenCalledTimes(1);
  });

  it('does not create a paid task when the tool closes during runtime loading', async () => {
    isToolConnected.mockReturnValue(false);

    await expect(
      handleToolImageGenerationRequest(
        createMessage({
          prompt: 'must not submit',
          width: 1024,
          height: 1024,
        }),
        bridge
      )
    ).rejects.toThrow('工具窗口已关闭，图片生成未提交');

    expect(mocks.getSettings).not.toHaveBeenCalled();
    expect(mocks.resolveModelSelection).not.toHaveBeenCalled();
    expect(mocks.createTask).not.toHaveBeenCalled();
    expect(mocks.observeTaskUpdates).not.toHaveBeenCalled();
  });
});
