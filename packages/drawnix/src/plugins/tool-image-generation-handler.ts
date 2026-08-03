import {
  ToolMessageType,
  type GenerateImagePayload,
  type GenerateImageResponse,
  type MessageHandler,
  type ToolMessage,
} from '../types/tool-communication.types';
import type { ToolCommunicationService } from '../services/tool-communication-service';
import { createRetriableModuleLoader } from '../utils/retriable-module-loader';

export interface ToolImageGenerationRuntime {
  handleToolImageGenerationRequest(
    message: ToolMessage<GenerateImagePayload>,
    bridge: ToolImageGenerationResponseBridge
  ): Promise<void>;
}

export interface ToolImageGenerationResponseBridge {
  isToolConnected: () => boolean;
  sendResponse: (response: GenerateImageResponse) => Promise<void>;
}

export type ToolImageGenerationRuntimeLoader =
  () => Promise<ToolImageGenerationRuntime>;

const loadToolImageGenerationRuntime = createRetriableModuleLoader(
  (): Promise<ToolImageGenerationRuntime> =>
    import('./tool-image-generation-runtime')
);

const MAX_GENERATE_IMAGE_DEDUPE_KEYS = 500;
const generateImageRequestDedupeKeys = new Map<string, number>();

function rememberGenerateImageRequest(key: string): boolean {
  if (generateImageRequestDedupeKeys.has(key)) {
    return false;
  }

  generateImageRequestDedupeKeys.set(key, Date.now());
  while (generateImageRequestDedupeKeys.size > MAX_GENERATE_IMAGE_DEDUPE_KEYS) {
    const oldestKey = generateImageRequestDedupeKeys.keys().next().value;
    if (!oldestKey) break;
    generateImageRequestDedupeKeys.delete(oldestKey);
  }
  return true;
}

function forgetGenerateImageRequest(key: string): void {
  generateImageRequestDedupeKeys.delete(key);
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error && error.message
    ? error.message
    : '图片生成失败';
}

async function postGenerationErrorResponse(
  service: Pick<ToolCommunicationService, 'sendToTool' | 'isToolConnected'>,
  message: ToolMessage<GenerateImagePayload>,
  error: unknown
): Promise<void> {
  const payload = message.payload;
  const response: GenerateImageResponse = {
    success: false,
    responseId: payload.messageId || message.messageId,
    error: getErrorMessage(error),
  };

  if (service.isToolConnected(message.toolId)) {
    await service.sendToTool(
      message.toolId,
      ToolMessageType.BOARD_TO_TOOL_IMAGE_GENERATED,
      response
    );
  }
}

export function createToolImageGenerationMessageHandler(
  service: Pick<ToolCommunicationService, 'sendToTool' | 'isToolConnected'>,
  loadRuntime: ToolImageGenerationRuntimeLoader =
    loadToolImageGenerationRuntime
): MessageHandler {
  return async (rawMessage) => {
    const message = rawMessage as ToolMessage<GenerateImagePayload>;
    const payload = message.payload;
    const requestId = payload.messageId;
    const dedupeKey = requestId ? `${message.toolId}:${requestId}` : '';

    if (dedupeKey && !rememberGenerateImageRequest(dedupeKey)) {
      await service.sendToTool(
        message.toolId,
        ToolMessageType.BOARD_TO_TOOL_IMAGE_GENERATED,
        {
          success: false,
          responseId: requestId,
          error: '重复生成请求已忽略',
        } as GenerateImageResponse
      );
      return;
    }

    let runtimeLoaded = false;
    try {
      const runtime = await loadRuntime();
      runtimeLoaded = true;
      await runtime.handleToolImageGenerationRequest(message, {
        isToolConnected: () => service.isToolConnected(message.toolId),
        sendResponse: async (response) => {
          await service.sendToTool(
            message.toolId,
            ToolMessageType.BOARD_TO_TOOL_IMAGE_GENERATED,
            response
          );
        },
      });
    } catch (error: unknown) {
      // Loading never submits a provider request. Allow the tool to retry the
      // same logical request after a transient chunk failure without weakening
      // task-level duplicate protection once the runtime has started.
      if (!runtimeLoaded && dedupeKey) {
        forgetGenerateImageRequest(dedupeKey);
      }

      console.error(
        `[ToolCommunication] Image generation failed for ${message.toolId}:`,
        error
      );
      await postGenerationErrorResponse(service, message, error);
    }
  };
}
