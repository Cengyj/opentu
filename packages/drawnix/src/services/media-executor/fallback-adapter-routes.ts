/**
 * Adapter routes for FallbackMediaExecutor
 *
 * 将专用 adapter（mj-imagine、kling 等）的执行逻辑从 fallback-executor 中提取出来，
 * 保持 LLM 日志、任务存储、认证错误检测等基础设施。
 */

import type { ModelRef } from '../../utils/settings-manager';
import type { ExecutionOptions, ImageExecutionOutcome } from './types';
import {
  taskStorageWriter,
  TaskStorageTaskNotFoundError,
} from './task-storage-writer';
import { createTaskInvocationRouteSnapshot } from '../task-invocation-route';
import {
  startLLMApiLog,
  completeLLMApiLog,
  failLLMApiLog,
  LLMReferenceImage,
} from './llm-api-logger';
import {
  classifyApiCredentialError,
  dispatchApiAuthError,
} from '../../utils/api-auth-error-event';
import { getAdapterContextFromSettings } from '../model-adapters';
import type { VideoModelAdapter } from '../model-adapters';
import {
  ensureBase64ForAI,
  cacheRemoteUrl,
  cacheImageArtifacts,
  ImageCachePersistenceError,
} from './fallback-utils';
import { unifiedCacheService } from '../unified-cache-service';
import {
  completeImageExecution,
  failImageExecution,
} from './image-execution-outcome';
import { createTaskInvocationRouteSnapshotFromPlan } from '../task-invocation-route';
import {
  executeResolvedImageInvocation,
  ImageInvocationError,
  type ResolvedImageInvocation,
} from '../image-invocation';

/**
 * 通过专用 adapter 生成图片（mj-imagine 等非 gemini 模型）
 * 复用 LLM 日志、任务存储、认证错误检测
 */
export async function executeImageViaAdapter(
  taskId: string,
  params: {
    /** Complete immutable invocation resolved by the caller. */
    imageInvocation: ResolvedImageInvocation;
  },
  options?: ExecutionOptions,
  startTime?: number
): Promise<ImageExecutionOutcome> {
  const logStartTime = startTime || Date.now();
  const { imageInvocation } = params;
  const { request } = imageInvocation;
  const referenceImages = [...request.referenceImages];

  const logId = startLLMApiLog({
    endpoint: `adapter:${imageInvocation.adapter.id}`,
    model: imageInvocation.modelId,
    taskType: 'image',
    prompt: request.prompt,
    hasReferenceImages: referenceImages.length > 0,
    referenceImageCount: referenceImages.length || undefined,
    referenceImages: referenceImages.map(
      (url) => ({ url, size: 0, width: 0, height: 0 } as LLMReferenceImage)
    ),
    taskId,
  });

  try {
    options?.onProgress?.({ progress: 10, phase: 'submitting' });
    options?.signal?.throwIfAborted();

    const result = await executeResolvedImageInvocation(imageInvocation, {
      signal: options?.signal,
      onSubmitted: async (remoteId) => {
        const durableRoute = createTaskInvocationRouteSnapshotFromPlan(
          'image',
          imageInvocation.plan
        );
        let persisted: boolean;
        try {
          persisted =
            options?.imageAttemptStartedAt === undefined
              ? await taskStorageWriter.updateRemoteId(
                  taskId,
                  remoteId,
                  durableRoute
                )
              : await taskStorageWriter.updateRemoteId(
                  taskId,
                  remoteId,
                  durableRoute,
                  { expectedStartedAt: options.imageAttemptStartedAt }
                );
        } catch (cause) {
          throw new ImageInvocationError(
            'IMAGE_RECOVERY_FAILED',
            '远程图片任务已提交，但任务身份未能持久化；已停止轮询且禁止自动重试',
            {
              stage: 'recovery',
              cause,
              details: {
                taskId,
                bindingId: imageInvocation.plan.binding.id,
              },
            }
          );
        }
        if (persisted === false) {
          throw new ImageInvocationError(
            'IMAGE_RECOVERY_FAILED',
            '远程图片任务身份已失效，已停止轮询',
            {
              stage: 'recovery',
              details: {
                taskId,
                bindingId: imageInvocation.plan.binding.id,
              },
            }
          );
        }
      },
      onProgress: (progress: number) => {
        options?.onProgress?.({
          progress: Math.min(90, Math.max(10, progress)),
          phase: 'polling',
        });
      },
    });

    if (options?.signal?.aborted) {
      throw options.signal.reason instanceof Error
        ? options.signal.reason
        : new DOMException('Aborted', 'AbortError');
    }

    const duration = Date.now() - logStartTime;
    const artifacts = result.artifacts;
    const primaryArtifact = artifacts[0];
    if (!primaryArtifact) {
      throw new Error('图片适配器未返回可缓存的 artifact');
    }

    completeLLMApiLog(logId, {
      httpStatus: 200,
      duration,
      resultType: 'image',
      resultCount: artifacts.length,
      resultUrl: primaryArtifact.url,
    });

    options?.onProgress?.({ progress: 95, phase: 'downloading' });

    // 缓存远程签名 URL 到本地，避免 Referer 校验导致 403
    const cachedArtifacts = await cacheImageArtifacts(artifacts, taskId, {
      signal: options?.signal,
      telemetry: imageInvocation.telemetry,
      extraMetadata: request.assetMetadata
        ? { ...request.assetMetadata }
        : undefined,
    });
    const cachedPrimary = cachedArtifacts[0];
    if (!cachedPrimary) {
      throw new ImageCachePersistenceError('图片 artifact 缓存结果为空');
    }
    const cachedUrls = cachedArtifacts.map((artifact) => artifact.url);
    const fmt = cachedPrimary.format || primaryArtifact.format || 'png';

    imageInvocation.telemetry.increment('terminalWrites');
    return await imageInvocation.telemetry.measure(
      'terminalPersistence',
      () =>
        completeImageExecution(
          taskId,
          {
            url: cachedPrimary.url,
            urls: cachedUrls.length > 1 ? cachedUrls : undefined,
            imageArtifacts: cachedArtifacts,
            format: fmt,
            size: 0,
            ...(cachedPrimary.width ? { width: cachedPrimary.width } : {}),
            ...(cachedPrimary.height ? { height: cachedPrimary.height } : {}),
          },
          options?.imageAttemptStartedAt
        )
    );
  } catch (error: unknown) {
    const duration = Date.now() - logStartTime;
    const errorMessage =
      error instanceof Error
        ? error.message
        : 'Image generation failed (adapter)';

    const credentialErrorKind = classifyApiCredentialError(error);
    if (credentialErrorKind) {
      dispatchApiAuthError({
        message: errorMessage,
        source: 'image',
        reason: credentialErrorKind,
      });
    }

    failLLMApiLog(logId, { duration, errorMessage });
    return await failImageExecution(
      taskId,
      {
        code:
          error instanceof ImageCachePersistenceError
            ? error.code
            : error instanceof ImageInvocationError
            ? error.code
            : 'IMAGE_GENERATION_ERROR',
        message: errorMessage,
      },
      options?.imageAttemptStartedAt
    );
  }
}

const isVirtualPath = (u: string) =>
  u.startsWith('/__aitu_cache__/') || u.startsWith('/asset-library/');

/**
 * 通过专用 adapter 生成视频（kling 等非 gemini 模型）
 * 复用 LLM 日志、任务存储、认证错误检测
 */
export async function executeVideoViaAdapter(
  taskId: string,
  adapter: VideoModelAdapter,
  params: {
    prompt: string;
    model: string;
    modelRef?: ModelRef | null;
    size?: string;
    duration?: string;
    referenceImages?: string[];
    inputReference?: string;
    params?: Record<string, unknown>;
  },
  options?: ExecutionOptions,
  startTime?: number
): Promise<void> {
  const logStartTime = startTime || Date.now();

  const refUrls =
    (params.referenceImages && params.referenceImages.length > 0
      ? params.referenceImages
      : undefined) ||
    (params.inputReference ? [params.inputReference] : undefined);

  const logId = startLLMApiLog({
    endpoint: `adapter:${adapter.id}`,
    model: params.model,
    taskType: 'video',
    prompt: params.prompt,
    taskId,
    hasReferenceImages: !!refUrls && refUrls.length > 0,
    referenceImageCount: refUrls?.length,
    referenceImages: refUrls?.map(
      (url) => ({ url, size: 0, width: 0, height: 0 } as LLMReferenceImage)
    ),
  });

  try {
    let processedImages: string[] | undefined;
    if (refUrls && refUrls.length > 0) {
      processedImages = await Promise.all(
        refUrls.map(async (url) => {
          if (isVirtualPath(url)) {
            const imageData = await unifiedCacheService.getImageForAI(url);
            return ensureBase64ForAI(imageData, options?.signal);
          }
          return url;
        })
      );
    }

    options?.onProgress?.({ progress: 10, phase: 'submitting' });

    const durationNum = params.duration
      ? parseInt(params.duration, 10)
      : undefined;

    const result = await adapter.generateVideo(
      getAdapterContextFromSettings('video', params.modelRef || params.model),
      {
        prompt: params.prompt,
        model: params.model,
        modelRef: params.modelRef || null,
        size: params.size,
        duration: durationNum,
        referenceImages: processedImages,
        params: {
          ...params.params,
          onProgress: (progress: number) => {
            const safeProgress = Math.min(100, Math.max(10, progress));
            options?.onProgress?.({
              progress: safeProgress,
              phase: safeProgress <= 10 ? 'submitting' : 'polling',
            });
          },
          onSubmitted: (videoId: string) => {
            void taskStorageWriter
              .updateRemoteId(
                taskId,
                videoId,
                createTaskInvocationRouteSnapshot(
                  'video',
                  params.modelRef || params.model
                )
              )
              .catch((error) => {
                if (!(error instanceof TaskStorageTaskNotFoundError)) {
                  console.error(
                    `[fallback-adapter-routes] Failed to persist remote ID for task ${taskId}:`,
                    error
                  );
                }
              });
          },
        },
      }
    );

    const duration = Date.now() - logStartTime;

    completeLLMApiLog(logId, {
      httpStatus: 200,
      duration,
      resultType: 'video',
      resultCount: 1,
      resultUrl: result.url,
    });

    options?.onProgress?.({ progress: 100 });

    // 缓存远程签名 URL 到本地
    const videoFmt = result.format || 'mp4';
    const cachedVideoUrl = await cacheRemoteUrl(
      result.url,
      taskId,
      'video',
      videoFmt
    );

    await taskStorageWriter.completeTask(taskId, {
      url: cachedVideoUrl,
      format: videoFmt,
      size: 0,
      duration: result.duration,
    });
  } catch (error: any) {
    const duration = Date.now() - logStartTime;
    const errorMessage = error.message || 'Video generation failed (adapter)';

    const credentialErrorKind = classifyApiCredentialError(error);
    if (credentialErrorKind) {
      dispatchApiAuthError({
        message: errorMessage,
        source: 'video',
        reason: credentialErrorKind,
      });
    }

    failLLMApiLog(logId, { duration, errorMessage });
    await taskStorageWriter.failTask(taskId, {
      code: error.code || 'VIDEO_GENERATION_ERROR',
      message: errorMessage,
    });
    throw error;
  }
}
