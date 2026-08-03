import { taskQueueService } from '../services/task-queue';
import { resolveImageTaskModelSelection } from '../services/image-task-model-selection';
import { TaskType } from '../types/task.types';
import type { GenerationParams } from '../types/shared/core.types';
import {
  type GenerateImagePayload,
  type GenerateImageResponse,
  type ToolMessage,
} from '../types/tool-communication.types';
import { geminiSettings } from '../utils/settings-manager';
import { getTaskResultImageArtifacts } from '../utils/image-generation-anchor-batch';
import type { ToolImageGenerationResponseBridge } from './tool-image-generation-handler';

/**
 * Executes the existing tool-to-board image task contract after the first
 * image-generation request has loaded the generation runtime.
 */
export async function handleToolImageGenerationRequest(
  message: ToolMessage<GenerateImagePayload>,
  bridge: ToolImageGenerationResponseBridge
): Promise<void> {
  const payload = message.payload;
  if (!bridge.isToolConnected()) {
    throw new Error('工具窗口已关闭，图片生成未提交');
  }

  const generateParams: GenerationParams = {
    prompt: payload.prompt,
  };

  if (payload.size) {
    generateParams.aspectRatio = payload.size;
  } else {
    generateParams.width = payload.width || 1024;
    generateParams.height = payload.height || 1024;
  }

  if (payload.uploadedImages && payload.uploadedImages.length > 0) {
    generateParams.uploadedImages = payload.uploadedImages;
  }

  if (payload.batchId) {
    generateParams.batchId = payload.batchId;
    generateParams.batchIndex = payload.batchIndex;
    generateParams.batchTotal = payload.batchTotal;
    if (payload.globalIndex !== undefined) {
      generateParams.globalIndex = payload.globalIndex;
    }
  }

  const settings = geminiSettings.get();
  const modelSelection = resolveImageTaskModelSelection(
    settings.imageModelName || 'gemini-2.5-flash-image-vip'
  );
  generateParams.model = modelSelection.model;
  generateParams.modelRef = modelSelection.modelRef;

  const task = taskQueueService.createTask(generateParams, TaskType.IMAGE);
  if (!task) {
    throw new Error('任务创建失败，请稍后重试');
  }

  const taskId = task.id;

  const subscription = taskQueueService
    .observeTaskUpdates()
    .subscribe((event) => {
      if (event.task.id !== taskId) return;

      if (
        event.type === 'taskUpdated' &&
        event.task.status === 'completed' &&
        event.task.result
      ) {
        const artifacts = getTaskResultImageArtifacts(event.task);
        const primaryArtifact = artifacts[0];
        const response: GenerateImageResponse = {
          success: true,
          responseId: payload.messageId || message.messageId,
          result: {
            url: primaryArtifact?.url || event.task.result.url,
            urls: artifacts.map((artifact) => artifact.url),
            format: primaryArtifact?.format || event.task.result.format,
            width: primaryArtifact?.width || event.task.result.width,
            height: primaryArtifact?.height || event.task.result.height,
          },
        };

        if (bridge.isToolConnected()) {
          void bridge.sendResponse(response).catch((error) => {
            console.error(
              '[ToolCommunication] Failed to deliver generated image:',
              error
            );
          });
        }
        subscription.unsubscribe();
      } else if (
        event.type === 'taskUpdated' &&
        (event.task.status === 'failed' ||
          event.task.status === 'cancelled')
      ) {
        const response: GenerateImageResponse = {
          success: false,
          responseId: payload.messageId || message.messageId,
          error:
            event.task.status === 'cancelled'
              ? '图片生成已取消'
              : event.task.error?.message || '图片生成失败',
        };

        if (bridge.isToolConnected()) {
          void bridge.sendResponse(response).catch((error) => {
            console.error(
              '[ToolCommunication] Failed to deliver generation failure:',
              error
            );
          });
        }
        subscription.unsubscribe();
      }
    });
}
