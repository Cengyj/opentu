/**
 * Image Generation Service
 *
 * 独立的图片生成服务，不依赖工作流概念。
 * 薄代理层：参数构建 → 调用 executor → 同步已提交的终态 → 返回结果。
 * 任务状态管理和 IndexedDB 持久化由 executor 层负责。
 */

import type { ImageGenerationOptions, ImageGenerationResult } from './types';
import { generateTaskId } from '../../utils/task-utils';
import {
  validateGenerationParams,
  sanitizeGenerationParams,
} from '../../utils/validation-utils';
import { taskStorageWriter } from '../media-executor/task-storage-writer';
import { executorFactory } from '../media-executor';
import {
  hasInvocationRouteCredentials,
  settingsManager,
} from '../../utils/settings-manager';
import { TaskType } from '../../types/shared/core.types';
import type { ImageGenerationParams } from '../media-executor/types';
import { taskQueueService } from '../task-queue-service';
import {
  TaskStatus as QueueTaskStatus,
  TaskExecutionPhase,
} from '../../types/task.types';
import { createTaskInvocationRouteSnapshot } from '../task-invocation-route';

function buildStoredImageAdapterParams(
  options: ImageGenerationOptions
): Record<string, unknown> | undefined {
  const adapterParams: Record<string, unknown> = {
    ...(options.params || {}),
  };

  if (
    options.resolution !== undefined &&
    adapterParams.resolution === undefined
  ) {
    adapterParams.resolution = options.resolution;
  }

  if (options.quality !== undefined && adapterParams.quality === undefined) {
    adapterParams.quality = options.quality;
  }

  if (
    typeof options.count === 'number' &&
    Number.isFinite(options.count) &&
    adapterParams.n === undefined
  ) {
    adapterParams.n = options.count;
  }

  return Object.keys(adapterParams).length > 0 ? adapterParams : undefined;
}

function buildStoredImageTaskParams(
  prompt: string,
  options: ImageGenerationOptions
) {
  return {
    prompt,
    model: options.model,
    modelRef: options.modelRef || null,
    size: options.size,
    resolution: options.resolution,
    quality: options.quality,
    generationMode: options.generationMode,
    referenceImages:
      options.referenceImages && options.referenceImages.length > 0
        ? options.referenceImages
        : undefined,
    maskImage: options.maskImage,
    inputFidelity: options.inputFidelity,
    background: options.background,
    outputFormat: options.outputFormat,
    outputCompression: options.outputCompression,
    uploadedImages:
      options.uploadedImages && options.uploadedImages.length > 0
        ? options.uploadedImages
        : undefined,
    count: options.count,
    assetMetadata: options.assetMetadata,
    promptMeta: options.promptMeta,
    params: buildStoredImageAdapterParams(options),
  };
}

/**
 * 生成图片
 *
 * @param prompt 生成提示词
 * @param options 生成选项
 * @returns 包含任务对象的结果
 */
export async function generateImage(
  prompt: string,
  options: ImageGenerationOptions = {}
): Promise<ImageGenerationResult> {
  // 参数验证
  const params = { prompt, ...options };
  const validation = validateGenerationParams(params, TaskType.IMAGE);
  if (!validation.valid) {
    throw new Error(validation.errors.join(', '));
  }
  const sanitizedParams = sanitizeGenerationParams(params);

  // 确保 API Key 已解密
  await settingsManager.waitForInitialization();
  if (
    !hasInvocationRouteCredentials('image', options.modelRef || options.model)
  ) {
    throw new Error('未配置 API Key，请在设置中配置');
  }

  // 创建任务记录
  const taskId = generateTaskId();
  // 必须先认领当前会话，再进行首次异步持久化；否则启动恢复可能把刚写入的
  // processing 快照误判为上次页面中断的任务。
  taskQueueService.claimTaskForCurrentSession(taskId);
  const now = Date.now();
  const persistedTaskParams = buildStoredImageTaskParams(
    sanitizedParams.prompt,
    options
  );
  const invocationRoute = createTaskInvocationRouteSnapshot(
    'image',
    options.modelRef || options.model || null
  );
  await taskStorageWriter.createTask(
    taskId,
    'image',
    persistedTaskParams,
    invocationRoute
  );

  // 注册到 TaskQueueService 内存 Map，确保任务队列 UI 和重试功能可用
  taskQueueService.trackExternalTask({
    id: taskId,
    type: TaskType.IMAGE,
    status: QueueTaskStatus.PROCESSING,
    params: persistedTaskParams,
    createdAt: now,
    updatedAt: now,
    startedAt: now,
    invocationRoute,
    executionPhase: TaskExecutionPhase.SUBMITTING,
  });

  try {
    // 通知调用方 taskId，以便提前持久化到工作流步骤。回调、执行器获取
    // 和执行本身属于同一收敛边界：任一步骤抛错都必须离开 processing。
    options.onTaskCreated?.(taskId);

    const executorParams: ImageGenerationParams = {
      taskId,
      prompt: sanitizedParams.prompt,
      model: options.model,
      modelRef: options.modelRef || null,
      size: options.size,
      resolution: options.resolution,
      generationMode: options.generationMode,
      quality: options.quality,
      referenceImages: options.referenceImages,
      maskImage: options.maskImage,
      inputFidelity: options.inputFidelity,
      background: options.background,
      outputFormat: options.outputFormat,
      outputCompression: options.outputCompression,
      uploadedImages: options.uploadedImages,
      count: options.count,
      assetMetadata: options.assetMetadata,
      params: options.params,
    };

    const executor = options.forceMainThread
      ? executorFactory.getFallbackExecutor()
      : await executorFactory.getExecutor();
    const outcome = await executor.generateImage(executorParams, {
      signal: options.signal,
    });
    if (outcome.taskId !== taskId) {
      throw new Error(
        `[ImageGeneration] Executor returned outcome for ${outcome.taskId}, expected ${taskId}`
      );
    }

    // The executor returns the exact terminal state whose transaction already
    // committed. Do not poll IndexedDB to rediscover a result from the same call
    // stack: storage read failures used to be collapsed into "missing" and left
    // the in-memory task processing until the generic 15-minute timeout.
    const terminalTask = taskQueueService.applyImageExecutionOutcome(outcome);
    if (!terminalTask) {
      throw new Error(
        `[ImageGeneration] Terminal task ${taskId} is missing from memory`
      );
    }

    return { task: terminalTask, url: terminalTask.result?.url };
  } catch (error) {
    const currentTask = taskQueueService.getTask(taskId);
    if (!currentTask) {
      throw error;
    }
    if (
      currentTask.status === QueueTaskStatus.COMPLETED ||
      currentTask.status === QueueTaskStatus.FAILED ||
      currentTask.status === QueueTaskStatus.CANCELLED
    ) {
      return { task: currentTask, url: currentTask.result?.url };
    }

    const aborted = options.signal?.aborted === true;
    const message =
      error instanceof Error ? error.message : '图片执行未能收敛到终态';
    taskQueueService.updateTaskStatus(
      taskId,
      aborted ? QueueTaskStatus.CANCELLED : QueueTaskStatus.FAILED,
      aborted
        ? undefined
        : {
            error: {
              code: 'IMAGE_EXECUTION_ERROR',
              message,
            },
          }
    );

    const terminalTask = taskQueueService.getTask(taskId);
    if (!terminalTask) {
      throw error;
    }
    return { task: terminalTask, url: terminalTask.result?.url };
  }
}
