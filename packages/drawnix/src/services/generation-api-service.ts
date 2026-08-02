/**
 * Generation API Service
 *
 * Wraps the AI generation API calls for images and videos.
 * Handles timeouts, cancellation, and error handling.
 */

import {
  GenerationParams,
  TaskType,
  TaskResult,
  TaskExecutionPhase,
  TaskStatus,
  type TaskInvocationRouteSnapshot,
} from '../types/task.types';
import {
  audioAPIService,
  extractAudioGenerationResult,
} from './audio-api-service';
import { videoAPIService } from './video-api-service';
import { TASK_TIMEOUT } from '../constants/TASK_CONSTANTS';
import { analytics } from '../utils/posthog-analytics';
import { legacyTaskQueueService as taskQueueService } from './task-queue';
import { unifiedCacheService } from './unified-cache-service';
import { DEFAULT_AUDIO_MODEL_ID } from '../constants/model-config';
import {
  getAdapterContextFromSettings,
  resolveAdapterForInvocation,
} from './model-adapters';
import { type ModelRef } from '../utils/settings-manager';
import {
  ImageInvocationError,
  resumeImageInvocationPolling,
  type ImageArtifact,
} from './image-invocation';
import { cacheImageArtifacts as persistImageArtifacts } from './media-executor/fallback-utils';
import {
  assertTaskInvocationRouteAvailable,
  createTaskInvocationRouteSnapshot,
  resolveTaskInvocationPlanFromSnapshot,
  shouldUseStrictTaskInvocationRoute,
} from './task-invocation-route';

function resolveAnalyticsModelName(
  routeModel: string | ModelRef | null | undefined,
  fallback: string
): string {
  if (typeof routeModel === 'string' && routeModel) {
    return routeModel;
  }
  if (
    routeModel &&
    typeof routeModel === 'object' &&
    typeof routeModel.modelId === 'string' &&
    routeModel.modelId
  ) {
    return routeModel.modelId;
  }
  return fallback;
}

function assertStoredTaskInvocationRouteAvailable(
  taskId: string,
  operation: 'image' | 'video' | 'audio'
): void {
  const task = taskQueueService.getTask(taskId);
  if (task && shouldUseStrictTaskInvocationRoute(task)) {
    assertTaskInvocationRouteAvailable(operation, task);
  }
}

async function cacheImageArtifactsForTask(
  taskId: string,
  artifacts: readonly ImageArtifact[],
  signal: AbortSignal
): Promise<TaskResult> {
  const cachedArtifacts = await persistImageArtifacts(artifacts, taskId, {
    signal,
  });
  const primary = cachedArtifacts[0];
  if (!primary) {
    throw new ImageInvocationError(
      'IMAGE_RESULT_INVALID',
      '图片恢复结果未包含可持久化的 artifact',
      { stage: 'cache', details: { taskId } }
    );
  }
  const cachedUrls = cachedArtifacts.map((artifact) => artifact.url);

  return {
    url: primary.url,
    urls: cachedUrls.length > 1 ? cachedUrls : undefined,
    imageArtifacts: cachedArtifacts,
    format: primary.format || 'png',
    size: 0,
    ...(primary.width ? { width: primary.width } : {}),
    ...(primary.height ? { height: primary.height } : {}),
  };
}

/**
 * Generation API Service
 * Manages API calls for content generation with timeout and cancellation support
 */
class GenerationAPIService {
  private abortControllers: Map<string, AbortController>;

  constructor() {
    this.abortControllers = new Map();
  }

  /**
   * Generates content (image or video) based on task parameters
   *
   * @param taskId - Unique task identifier
   * @param params - Generation parameters
   * @param type - Content type (image or video)
   * @returns Promise with task result
   */
  async generate(
    taskId: string,
    params: GenerationParams,
    type: TaskType,
    _invocationRoute?: TaskInvocationRouteSnapshot
  ): Promise<TaskResult> {
    // Queue-backed image submission has a single owner: TaskQueueService ->
    // IMediaExecutor. Keeping an image submit branch here would let the React
    // pending-task observer race that owner and duplicate a paid request.
    // Refresh recovery remains available through resumeAsyncImageGeneration(),
    // which can only query a persisted remoteId and binding snapshot.
    if (type === TaskType.IMAGE) {
      throw new ImageInvocationError(
        'IMAGE_REQUEST_INVALID',
        '图片任务必须由统一任务队列执行器提交',
        {
          stage: 'planning',
          details: { taskId, executionOwner: 'task-queue' },
        }
      );
    }

    // Create abort controller for this task
    const abortController = new AbortController();
    this.abortControllers.set(taskId, abortController);

    const startTime = Date.now();
    const taskType = type === TaskType.VIDEO ? 'video' : 'audio';
    const modelName =
      params.model ||
      (taskType === 'video' ? 'gemini-video' : DEFAULT_AUDIO_MODEL_ID);

    // Track model call start with enhanced parameters
    const hasRefImage =
      !!(params as any).uploadedImage ||
      !!(params as any).uploadedImages ||
      !!(params as any).referenceImages;
    analytics.trackModelCall({
      taskId,
      taskType,
      model: modelName,
      promptLength: params.prompt.length,
      hasUploadedImage: hasRefImage,
      startTime,
      // Enhanced parameters
      aspectRatio: params.size,
      duration: params.duration,
      resolution:
        params.width && params.height
          ? `${params.width}x${params.height}`
          : undefined,
      batchCount: (params as any).count || 1,
      hasReferenceImage: hasRefImage,
    });

    let timeoutId: ReturnType<typeof setTimeout> | undefined;

    try {
      // Get timeout for this task type
      const timeout =
        TASK_TIMEOUT[type.toUpperCase() as keyof typeof TASK_TIMEOUT] ??
        TASK_TIMEOUT.IMAGE;

      // Create timeout promise
      const timeoutPromise = new Promise<never>((_, reject) => {
        timeoutId = setTimeout(() => {
          abortController.abort();
          reject(new Error('TIMEOUT'));
        }, timeout);
      });

      // Create generation promise
      const generationPromise = (() => {
        if (type === TaskType.VIDEO) {
          return this.generateVideo(taskId, params, abortController.signal);
        }
        return this.generateAudio(taskId, params, abortController.signal);
      })();

      // Race between generation and timeout
      const result = await Promise.race([generationPromise, timeoutPromise]);

      const duration = Date.now() - startTime;

      // Track success
      analytics.trackModelSuccess({
        taskId,
        taskType,
        model: modelName,
        duration,
        resultSize: result.size,
      });

      return result;
    } catch (error: any) {
      const duration = Date.now() - startTime;
      console.error(
        `[GenerationAPI] Generation failed for task ${taskId}:`,
        error
      );

      if (error.message === 'TIMEOUT') {
        // Track timeout failure
        analytics.trackModelFailure({
          taskId,
          taskType,
          model: modelName,
          duration,
          error: 'TIMEOUT',
        });
        throw new Error(
          `${type === TaskType.VIDEO ? '视频' : '音频'}生成超时`
        );
      }

      if (error.name === 'AbortError') {
        // Track cancellation
        analytics.trackTaskCancellation({
          taskId,
          taskType,
          duration,
        });
        throw new Error('任务已取消');
      }

      // Track other failures
      analytics.trackModelFailure({
        taskId,
        taskType,
        model: modelName,
        duration,
        error: error.message || 'UNKNOWN_ERROR',
      });

      throw error;
    } finally {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      // Cleanup abort controller
      this.abortControllers.delete(taskId);
    }
  }

  /**
   * Extracts reference image URLs from various param formats
   * @private
   */
  private async extractReferenceImages(
    params: GenerationParams
  ): Promise<string[]> {
    const referenceImages: string[] = [];

    const uploadedImages = (params as any).uploadedImages as
      | Array<{ url?: string; type?: string }>
      | undefined;
    if (Array.isArray(uploadedImages)) {
      for (const img of uploadedImages) {
        if (img?.url) {
          if (img.type === 'url') {
            const imageData = await unifiedCacheService.getImageForAI(img.url);
            referenceImages.push(imageData.value);
          } else {
            referenceImages.push(img.url);
          }
        }
      }
    }

    if ((params as any).uploadedImage?.url) {
      referenceImages.push((params as any).uploadedImage.url);
    }

    if (Array.isArray((params as any).referenceImages)) {
      referenceImages.push(...((params as any).referenceImages as string[]));
    }

    return referenceImages;
  }

  /**
   * 恢复异步图片任务的轮询（页面刷新后）
   */
  async resumeAsyncImageGeneration(
    taskId: string,
    remoteId: string,
    _routeModel?: string | ModelRef | null,
    _bindingId?: string,
    externalSignal?: AbortSignal
  ): Promise<TaskResult> {
    const timeout = TASK_TIMEOUT.IMAGE;
    const abortController = new AbortController();
    const forwardExternalAbort = () =>
      abortController.abort(externalSignal?.reason);
    if (externalSignal?.aborted) {
      forwardExternalAbort();
    } else {
      externalSignal?.addEventListener('abort', forwardExternalAbort, {
        once: true,
      });
    }
    this.abortControllers.set(taskId, abortController);
    let timeoutId: ReturnType<typeof setTimeout> | undefined;

    const timeoutPromise = new Promise<never>((_, reject) => {
      timeoutId = setTimeout(() => {
        abortController.abort();
        reject(new Error('TIMEOUT'));
      }, timeout);
    });

    try {
      const storedTask = taskQueueService.getTask(taskId);
      const snapshotPlan = storedTask
        ? resolveTaskInvocationPlanFromSnapshot('image', storedTask)
        : null;
      if (!storedTask || !snapshotPlan) {
        throw new ImageInvocationError(
          'IMAGE_RECOVERY_FAILED',
          '图片任务缺少完整的调用 binding 快照，无法安全恢复',
          {
            stage: 'recovery',
            details: {
              taskId,
              bindingId: storedTask?.invocationRoute?.binding?.id,
            },
          }
        );
      }
      const pollingPromise = resumeImageInvocationPolling(
        snapshotPlan,
        remoteId,
        {
          interval: 5000,
          signal: abortController.signal,
          onProgress: (progress) => {
            taskQueueService.updateTaskProgress(taskId, progress);
          },
        }
      );
      const artifacts = await Promise.race([pollingPromise, timeoutPromise]);
      return await cacheImageArtifactsForTask(
        taskId,
        artifacts,
        abortController.signal
      );
    } catch (error: any) {
      const wrappedError = new Error(error.message || '图片生成失败');
      if (typeof error.code === 'string') {
        (wrappedError as any).code = error.code;
      }
      if (error.httpStatus) {
        (wrappedError as any).httpStatus = error.httpStatus;
      }
      throw wrappedError;
    } finally {
      externalSignal?.removeEventListener('abort', forwardExternalAbort);
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      if (this.abortControllers.get(taskId) === abortController) {
        this.abortControllers.delete(taskId);
      }
    }
  }

  /**
   * Generates a video using the video generation API with async polling
   * @private
   */
  private async generateVideo(
    taskId: string,
    params: GenerationParams,
    signal: AbortSignal
  ): Promise<TaskResult> {
    try {
      const requestedModel = (params as any).model as string | undefined;
      const requestedModelRef = (params as any).modelRef as
        | ModelRef
        | null
        | undefined;
      const adapter = resolveAdapterForInvocation(
        'video',
        requestedModel || 'veo3',
        requestedModelRef || null
      );

      if (!adapter || adapter.kind !== 'video') {
        throw new Error(`No video adapter for model: ${requestedModel}`);
      }

      taskQueueService.updateTaskStatus(taskId, 'processing' as any, {
        executionPhase: TaskExecutionPhase.SUBMITTING,
      });

      const referenceImages = await this.extractReferenceImages(params);
      const durationValue = (params as any).duration ?? (params as any).seconds;

      const result = await adapter.generateVideo(
        getAdapterContextFromSettings(
          'video',
          requestedModelRef || requestedModel
        ),
        {
          prompt: params.prompt,
          model: requestedModel,
          modelRef: requestedModelRef || null,
          size: (params as any).size,
          duration:
            durationValue !== undefined ? Number(durationValue) : undefined,
          referenceImages:
            referenceImages.length > 0 ? referenceImages : undefined,
          params: {
            ...(params as any).params,
            onProgress: (progress: number) => {
              taskQueueService.updateTaskProgress(taskId, progress);
            },
            onSubmitted: (videoId: string) => {
              taskQueueService.updateTaskStatus(taskId, 'processing' as any, {
                remoteId: videoId,
                invocationRoute: createTaskInvocationRouteSnapshot(
                  'video',
                  requestedModelRef || requestedModel
                ),
                executionPhase: TaskExecutionPhase.POLLING,
              });
            },
          },
        }
      );

      return {
        url: result.url,
        format: result.format || 'mp4',
        size: 0,
        duration: result.duration || 0,
      };
    } catch (error: any) {
      console.error('[GenerationAPI] Video generation error:', error);
      const wrappedError = new Error(error.message || '视频生成失败');
      if (error.apiErrorBody) {
        (wrappedError as any).apiErrorBody = error.apiErrorBody;
      }
      if (error.httpStatus) {
        (wrappedError as any).httpStatus = error.httpStatus;
      }
      throw wrappedError;
    }
  }

  /**
   * Generates audio using the audio adapter path
   * @private
   */
  private async generateAudio(
    taskId: string,
    params: GenerationParams,
    signal: AbortSignal
  ): Promise<TaskResult> {
    try {
      const requestedModel = (params as any).model as string | undefined;
      const requestedModelRef = (params as any).modelRef as
        | ModelRef
        | null
        | undefined;
      const adapter = resolveAdapterForInvocation(
        'audio',
        requestedModel || DEFAULT_AUDIO_MODEL_ID,
        requestedModelRef || null
      );

      if (!adapter || adapter.kind !== 'audio') {
        throw new Error(`No audio adapter for model: ${requestedModel}`);
      }

      taskQueueService.updateTaskStatus(taskId, TaskStatus.PROCESSING, {
        executionPhase: TaskExecutionPhase.SUBMITTING,
      });

      const result = await adapter.generateAudio(
        getAdapterContextFromSettings(
          'audio',
          requestedModelRef || requestedModel
        ),
        {
          prompt: params.prompt,
          model: requestedModel,
          modelRef: requestedModelRef || null,
          title: params.title,
          tags: params.tags,
          mv: params.mv,
          sunoAction: params.sunoAction,
          notifyHook: params.notifyHook,
          continueClipId: params.continueClipId,
          continueTaskId: params.continueTaskId,
          continueAt: params.continueAt,
          infillStartS: params.infillStartS,
          infillEndS: params.infillEndS,
          params: {
            ...(params as any).params,
            signal,
            onProgress: (progress: number) => {
              taskQueueService.updateTaskProgress(taskId, progress);
              taskQueueService.updateTaskStatus(taskId, TaskStatus.PROCESSING, {
                executionPhase: TaskExecutionPhase.POLLING,
              });
            },
            onSubmitted: (remoteId: string) => {
              taskQueueService.updateTaskStatus(taskId, TaskStatus.PROCESSING, {
                remoteId,
                invocationRoute: createTaskInvocationRouteSnapshot(
                  'audio',
                  requestedModelRef || requestedModel
                ),
                executionPhase: TaskExecutionPhase.POLLING,
              });
            },
          },
        }
      );

      return {
        url: result.url,
        urls: result.urls,
        format:
          result.format || (result.resultKind === 'lyrics' ? 'lyrics' : 'mp3'),
        size: 0,
        resultKind: result.resultKind,
        duration:
          typeof result.duration === 'number' ? result.duration : undefined,
        previewImageUrl: result.imageUrl,
        title: result.title,
        lyricsText: result.lyricsText,
        lyricsTitle: result.lyricsTitle,
        lyricsTags: result.lyricsTags,
        providerTaskId: result.providerTaskId,
        primaryClipId: result.primaryClipId,
        clipIds: result.clipIds,
        clips: result.clips,
      };
    } catch (error: any) {
      console.error('[GenerationAPI] Audio generation error:', error);
      const wrappedError = new Error(error.message || '音频生成失败');
      if (error.apiErrorBody) {
        (wrappedError as any).apiErrorBody = error.apiErrorBody;
      }
      if (error.httpStatus) {
        (wrappedError as any).httpStatus = error.httpStatus;
      }
      throw wrappedError;
    }
  }

  /**
   * Resumes video polling for a task that was interrupted (e.g., by page refresh)
   *
   * @param taskId - Task identifier
   * @param remoteId - Remote video ID from API
   * @returns Promise with task result
   */
  async resumeVideoGeneration(
    taskId: string,
    remoteId: string,
    routeModel?: string | ModelRef | null
  ): Promise<TaskResult> {
    const startTime = Date.now();
    const modelName = resolveAnalyticsModelName(routeModel, 'gemini-video');

    // Track resumed task
    analytics.trackModelCall({
      taskId,
      taskType: 'video',
      model: modelName,
      promptLength: 0, // Unknown for resumed tasks
      hasUploadedImage: false,
      startTime,
    });

    try {
      assertStoredTaskInvocationRouteAvailable(taskId, 'video');
      // console.log(`[GenerationAPI] Resuming video generation for task ${taskId}, remoteId: ${remoteId}`);

      // Get timeout for video
      const timeout = TASK_TIMEOUT.VIDEO;

      // Create timeout promise
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => {
          reject(new Error('TIMEOUT'));
        }, timeout);
      });

      // Resume polling
      const pollingPromise = videoAPIService.resumePolling(remoteId, {
        interval: 5000,
        routeModel,
        params: taskQueueService.getTask(taskId)?.params.params as
          | Record<string, unknown>
          | undefined,
        onProgress: (progress, status) => {
          // console.log(`[GenerationAPI] Resumed video progress: ${progress}% (${status})`);
          taskQueueService.updateTaskProgress(taskId, progress);
        },
      });

      // Race between polling and timeout
      const result = await Promise.race([pollingPromise, timeoutPromise]);

      const duration = Date.now() - startTime;
      // console.log(`[GenerationAPI] Resumed video generation completed for task ${taskId}`);

      // Track success
      analytics.trackModelSuccess({
        taskId,
        taskType: 'video',
        model: modelName,
        duration,
        resultSize: 0,
      });

      // Extract video URL from response
      const videoUrl = result.video_url || result.url;
      if (!videoUrl) {
        throw new Error('API 未返回有效的视频 URL');
      }

      return {
        url: videoUrl,
        format: 'mp4',
        size: 0,
        duration: parseInt(result.seconds) || 8,
      };
    } catch (error: any) {
      const duration = Date.now() - startTime;
      console.error(
        `[GenerationAPI] Resumed video generation failed for task ${taskId}:`,
        error
      );

      // Track failure
      analytics.trackModelFailure({
        taskId,
        taskType: 'video',
        model: modelName,
        duration,
        error: error.message || 'UNKNOWN_ERROR',
      });

      throw error;
    }
  }

  /**
   * Resumes audio polling for a task interrupted by page refresh
   */
  async resumeAudioGeneration(
    taskId: string,
    remoteId: string,
    routeModel?: string | ModelRef | null
  ): Promise<TaskResult> {
    const startTime = Date.now();
    const modelName = resolveAnalyticsModelName(
      routeModel,
      DEFAULT_AUDIO_MODEL_ID
    );

    analytics.trackModelCall({
      taskId,
      taskType: 'audio',
      model: modelName,
      promptLength: 0,
      hasUploadedImage: false,
      startTime,
    });

    try {
      assertStoredTaskInvocationRouteAvailable(taskId, 'audio');
      const timeout = TASK_TIMEOUT.AUDIO;
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => {
          reject(new Error('TIMEOUT'));
        }, timeout);
      });

      const pollingPromise = audioAPIService.resumePolling(remoteId, {
        interval: 5000,
        routeModel,
        onProgress: (progress) => {
          taskQueueService.updateTaskProgress(taskId, progress);
        },
      });

      const response = await Promise.race([pollingPromise, timeoutPromise]);
      const result = extractAudioGenerationResult(response);
      const duration = Date.now() - startTime;

      analytics.trackModelSuccess({
        taskId,
        taskType: 'audio',
        model: modelName,
        duration,
        resultSize: 0,
      });

      return {
        url: result.url,
        urls: result.urls,
        format:
          result.format || (result.resultKind === 'lyrics' ? 'lyrics' : 'mp3'),
        size: 0,
        resultKind: result.resultKind,
        duration:
          typeof result.duration === 'number' ? result.duration : undefined,
        previewImageUrl: result.imageUrl,
        title: result.title,
        lyricsText: result.lyricsText,
        lyricsTitle: result.lyricsTitle,
        lyricsTags: result.lyricsTags,
        providerTaskId: result.providerTaskId,
        primaryClipId: result.primaryClipId,
        clipIds: result.clipIds,
        clips: result.clips,
      };
    } catch (error: any) {
      const duration = Date.now() - startTime;
      console.error(
        `[GenerationAPI] Resumed audio generation failed for task ${taskId}:`,
        error
      );

      analytics.trackModelFailure({
        taskId,
        taskType: 'audio',
        model: modelName,
        duration,
        error: error.message || 'UNKNOWN_ERROR',
      });

      throw error;
    }
  }

  /**
   * Cancels an ongoing generation request
   *
   * @param taskId - Task identifier to cancel
   */
  cancelRequest(taskId: string): void {
    const controller = this.abortControllers.get(taskId);
    if (controller) {
      controller.abort();
      this.abortControllers.delete(taskId);
      // console.log(`[GenerationAPI] Cancelled request for task ${taskId}`);
    }
  }

  /**
   * Checks if a task has an active request
   *
   * @param taskId - Task identifier
   * @returns True if the task has an active request
   */
  hasActiveRequest(taskId: string): boolean {
    return this.abortControllers.has(taskId);
  }
}

// Export singleton instance
export const generationAPIService = new GenerationAPIService();
