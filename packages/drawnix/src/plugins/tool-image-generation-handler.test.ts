import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ToolCommunicationService } from '../services/tool-communication-service';
import {
  ToolMessageType,
  type GenerateImagePayload,
  type ToolMessage,
} from '../types/tool-communication.types';
import { createRetriableModuleLoader } from '../utils/retriable-module-loader';
import {
  createToolImageGenerationMessageHandler,
  type ToolImageGenerationRuntime,
} from './tool-image-generation-handler';

function createDeferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

function createMessage(
  messageId: string,
  payloadMessageId = `payload-${messageId}`
): ToolMessage<GenerateImagePayload> {
  return {
    version: '1.0',
    type: ToolMessageType.TOOL_TO_BOARD_GENERATE_IMAGE,
    toolId: 'tool-image-test',
    messageId,
    timestamp: Date.now(),
    payload: {
      prompt: `prompt-${messageId}`,
      messageId: payloadMessageId,
    },
  };
}

describe('tool image generation lazy handler', () => {
  const sendToTool = vi.fn().mockResolvedValue(undefined);
  const isToolConnected = vi.fn().mockReturnValue(true);
  const service = {
    sendToTool,
    isToolConnected,
  } as Pick<ToolCommunicationService, 'sendToTool' | 'isToolConnected'>;

  beforeEach(() => {
    vi.clearAllMocks();
    isToolConnected.mockReturnValue(true);
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  it('shares one runtime import across concurrent first requests and preserves request order', async () => {
    const deferred = createDeferred<ToolImageGenerationRuntime>();
    const importRuntime = vi.fn(() => deferred.promise);
    const loadRuntime = createRetriableModuleLoader(importRuntime);
    const handleRequest = vi.fn().mockResolvedValue(undefined);
    const handler = createToolImageGenerationMessageHandler(
      service,
      loadRuntime
    );
    const firstMessage = createMessage('concurrent-first');
    const secondMessage = createMessage('concurrent-second');

    const firstResult = handler(firstMessage);
    const secondResult = handler(secondMessage);
    await Promise.resolve();

    expect(importRuntime).toHaveBeenCalledTimes(1);
    expect(handleRequest).not.toHaveBeenCalled();

    deferred.resolve({
      handleToolImageGenerationRequest: handleRequest,
    });
    await Promise.all([firstResult, secondResult]);

    expect(handleRequest).toHaveBeenCalledTimes(2);
    expect(handleRequest.mock.calls.map(([message]) => message.messageId)).toEqual(
      ['concurrent-first', 'concurrent-second']
    );
    expect(sendToTool).not.toHaveBeenCalled();
  });

  it('returns the load error and retries the same logical request on the next message', async () => {
    const runtime: ToolImageGenerationRuntime = {
      handleToolImageGenerationRequest: vi.fn().mockResolvedValue(undefined),
    };
    const importRuntime = vi
      .fn<() => Promise<ToolImageGenerationRuntime>>()
      .mockRejectedValueOnce(new Error('image runtime chunk unavailable'))
      .mockResolvedValueOnce(runtime);
    const handler = createToolImageGenerationMessageHandler(
      service,
      createRetriableModuleLoader(importRuntime)
    );

    await handler(createMessage('retry-envelope-1', 'retry-logical-request'));

    expect(sendToTool).toHaveBeenCalledWith(
      'tool-image-test',
      ToolMessageType.BOARD_TO_TOOL_IMAGE_GENERATED,
      {
        success: false,
        responseId: 'retry-logical-request',
        error: 'image runtime chunk unavailable',
      }
    );
    expect(runtime.handleToolImageGenerationRequest).not.toHaveBeenCalled();

    sendToTool.mockClear();
    await handler(createMessage('retry-envelope-2', 'retry-logical-request'));

    expect(importRuntime).toHaveBeenCalledTimes(2);
    expect(runtime.handleToolImageGenerationRequest).toHaveBeenCalledTimes(1);
    expect(sendToTool).not.toHaveBeenCalled();
  });

  it('retains the existing duplicate-request response after runtime execution starts', async () => {
    const runtime: ToolImageGenerationRuntime = {
      handleToolImageGenerationRequest: vi.fn().mockResolvedValue(undefined),
    };
    const loadRuntime = vi.fn().mockResolvedValue(runtime);
    const handler = createToolImageGenerationMessageHandler(
      service,
      loadRuntime
    );

    await handler(createMessage('dedupe-envelope-1', 'dedupe-logical-request'));
    await handler(createMessage('dedupe-envelope-2', 'dedupe-logical-request'));

    expect(loadRuntime).toHaveBeenCalledTimes(1);
    expect(runtime.handleToolImageGenerationRequest).toHaveBeenCalledTimes(1);
    expect(sendToTool).toHaveBeenCalledWith(
      'tool-image-test',
      ToolMessageType.BOARD_TO_TOOL_IMAGE_GENERATED,
      {
        success: false,
        responseId: 'dedupe-logical-request',
        error: '重复生成请求已忽略',
      }
    );
  });
});
