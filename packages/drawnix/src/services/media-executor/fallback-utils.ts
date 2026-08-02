/**
 * Fallback Executor 辅助函数
 *
 * 提供降级执行器的通用工具函数
 * 大部分逻辑已迁移到 media-api 共享模块
 */

import type { VideoAPIConfig } from './types';
import {
  calculateBlobChecksum,
  dataUrlToBlob,
  getFileExtension,
  isDataURL,
  normalizeImageDataUrl,
} from '@aitu/utils';
import { unifiedCacheService } from '../unified-cache-service';
import { providerTransport } from '../provider-routing/provider-transport';
import {
  AI_GENERATED_AUDIO_URL_PREFIX,
  isVirtualMediaUrl,
} from '../../utils/virtual-media-url';
import {
  downloadVideoContentToLocalUrl,
  extractInlineVideoUrl,
  resolveVideoPollPath,
  shouldDownloadVideoContent,
} from '../video-binding-utils';
import { mapImageInvocationWithConcurrency } from '../image-invocation/bounded-concurrency';
import type { ImageInvocationTelemetry } from '../image-invocation/performance';
import {
  IMAGE_ARTIFACT_MIME_TYPES,
  type ImageArtifactMimeType,
  type ImageArtifact,
  type ImageArtifactFormat,
} from '../image-invocation/artifacts';

export {
  MAX_REFERENCE_IMAGE_BYTES,
  blobToBase64Under1MB,
  ensureBase64ForAI,
} from '../image-invocation/reference-materializer';

/**
 * Local persistence is post-provider work and must never keep a successfully
 * returned image in the generating state indefinitely. The underlying Cache
 * Storage/IndexedDB APIs are not abortable, so this deadline gives task-backed
 * image callers a deterministic failure and lets best-effort callers retain
 * their existing provider-URL fallback.
 */
export const MEDIA_CACHE_SETTLEMENT_TIMEOUT_MS = 10_000;

export interface CacheRemoteUrlOptions {
  source?: 'AI_GENERATED' | 'PLAYBACK_CACHE';
  forceRemoteCache?: boolean;
  /**
   * Reject unless both the media bytes and cache metadata are durably readable.
   * Task-backed image completion enables this; best-effort direct consumers do
   * not, preserving their existing remote-URL behavior.
   */
  requirePersistence?: boolean;
  signal?: AbortSignal;
  extraMetadata?: Record<string, unknown>;
  telemetry?: ImageInvocationTelemetry;
  /** Internal hand-off used by canonical image artifact persistence. */
  onImageMediaResolved?: (media: PersistedImageMedia) => void;
}

export const IMAGE_ARTIFACT_CACHE_CONCURRENCY = 3;

export class ImageCachePersistenceError extends Error {
  readonly code = 'IMAGE_CACHE_PERSISTENCE_FAILED' as const;

  constructor(stage: string) {
    super(`图片结果未能持久化到本地缓存（${stage}）`);
    this.name = 'ImageCachePersistenceError';
  }
}

interface PersistedImageMedia {
  readonly mimeType: ImageArtifactMimeType;
  readonly format: ImageArtifactFormat;
}

const IMAGE_CACHE_MIME_TO_FORMAT: Readonly<
  Record<ImageArtifactMimeType, ImageArtifactFormat>
> = Object.freeze({
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
  'image/gif': 'gif',
});

const IMAGE_CACHE_FORMAT_TO_MIME: Readonly<
  Record<ImageArtifactFormat, ImageArtifactMimeType>
> = Object.freeze({
  png: 'image/png',
  jpg: 'image/jpeg',
  webp: 'image/webp',
  gif: 'image/gif',
});

const SUPPORTED_IMAGE_CACHE_MIME_TYPES = new Set<string>(
  IMAGE_ARTIFACT_MIME_TYPES
);

function resolvePersistedImageMedia(
  blob: Blob,
  fallbackFormat: string
): PersistedImageMedia {
  const rawMimeType = blob.type.split(';', 1)[0]?.trim().toLowerCase();
  const normalizedMimeType =
    rawMimeType === 'image/jpg' ? 'image/jpeg' : rawMimeType;
  const normalizedFallbackFormat =
    fallbackFormat.toLowerCase() === 'jpeg'
      ? 'jpg'
      : fallbackFormat.toLowerCase();
  const fallbackMimeType =
    IMAGE_CACHE_FORMAT_TO_MIME[
      normalizedFallbackFormat as ImageArtifactFormat
    ];
  const mimeType =
    normalizedMimeType &&
    normalizedMimeType !== 'application/octet-stream'
      ? normalizedMimeType
      : fallbackMimeType;

  if (!mimeType || !SUPPORTED_IMAGE_CACHE_MIME_TYPES.has(mimeType)) {
    throw new ImageCachePersistenceError(
      `图片结果 MIME 不受支持（${mimeType || 'unknown'}）`
    );
  }

  const canonicalMimeType = mimeType as ImageArtifactMimeType;
  return {
    mimeType: canonicalMimeType,
    format: IMAGE_CACHE_MIME_TO_FORMAT[canonicalMimeType],
  };
}

function reportPersistedImageMedia(
  mediaType: 'image' | 'video' | 'audio',
  blob: Blob,
  fallbackFormat: string,
  options?: CacheRemoteUrlOptions
): void {
  if (mediaType !== 'image') {
    return;
  }
  options?.onImageMediaResolved?.(
    resolvePersistedImageMedia(blob, fallbackFormat)
  );
}

async function verifyCachedImageMedia(
  url: string,
  mediaType: 'image' | 'video' | 'audio',
  fallbackFormat: string,
  options?: CacheRemoteUrlOptions
): Promise<void> {
  if (mediaType !== 'image') {
    return;
  }
  const blob = await unifiedCacheService.getCachedBlob(url);
  if (!blob || blob.size === 0) {
    throw new ImageCachePersistenceError('本地图片缓存不可读');
  }
  reportPersistedImageMedia(mediaType, blob, fallbackFormat, options);
}

class MediaCacheSettlementTimeoutError extends Error {
  constructor(operation: string) {
    super(
      `[cacheRemoteUrl] ${operation} did not settle within ${MEDIA_CACHE_SETTLEMENT_TIMEOUT_MS}ms`
    );
    this.name = 'MediaCacheSettlementTimeoutError';
  }
}

async function withMediaCacheDeadline<T>(
  operation: string,
  run: () => Promise<T>,
  signal?: AbortSignal
): Promise<T> {
  throwIfCacheAborted(signal);
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  let onAbort: (() => void) | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new MediaCacheSettlementTimeoutError(operation));
    }, MEDIA_CACHE_SETTLEMENT_TIMEOUT_MS);
  });
  const aborted = signal
    ? new Promise<never>((_, reject) => {
        onAbort = () => reject(resolveCacheAbortReason(signal));
        signal.addEventListener('abort', onAbort, { once: true });
      })
    : undefined;

  try {
    // Defer the operation to a microtask so the deadline is armed before any
    // synchronous base64 decoding begins.
    return await Promise.race([
      Promise.resolve().then(run),
      timeout,
      ...(aborted ? [aborted] : []),
    ]);
  } finally {
    if (timeoutId !== undefined) {
      clearTimeout(timeoutId);
    }
    if (onAbort) {
      signal?.removeEventListener('abort', onAbort);
    }
  }
}

function resolveCacheAbortReason(signal: AbortSignal): Error {
  return signal.reason instanceof Error
    ? signal.reason
    : new DOMException('Aborted', 'AbortError');
}

function throwIfCacheAborted(signal?: AbortSignal): void {
  if (signal?.aborted) {
    throw resolveCacheAbortReason(signal);
  }
}

function isCacheAbort(error: unknown, signal?: AbortSignal): boolean {
  return (
    signal?.aborted === true ||
    (error instanceof Error && error.name === 'AbortError')
  );
}

function throwRequiredPersistenceError(error: unknown, stage: string): never {
  if (error instanceof ImageCachePersistenceError) {
    throw error;
  }
  throw new ImageCachePersistenceError(stage);
}

// 从共享模块重新导出
export {
  extractPromptFromMessages,
} from '../media-api';

// 导入共享模块的工具函数
import {
  normalizeApiBase,
  getExtensionFromUrl,
  sizeToAspectRatio,
  sleep,
  parseErrorMessage,
} from '../media-api';

/**
 * 轮询视频状态
 * 注意：此函数保留以保持向后兼容，新代码应使用 media-api/video-api.ts 中的 pollVideoUntilComplete
 */
export async function pollVideoStatus(
  videoId: string,
  config: VideoAPIConfig,
  onProgress: (progress: number) => void,
  signal?: AbortSignal
): Promise<{ url: string }> {
  const maxAttempts = 120; // 最多轮询 10 分钟
  const interval = 5000; // 5 秒轮询间隔
  const maxConsecutiveErrors = 3; // 连续 HTTP 错误超过此数才放弃
  let consecutiveErrors = 0;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    if (signal?.aborted) {
      throw new Error('Video generation cancelled');
    }
    let data: any;
    try {
      const statusPath = resolveVideoPollPath(
        videoId,
        config.binding,
        config.params
      );
      const response = await providerTransport.send(
        config.provider || {
          profileId: 'runtime',
          profileName: 'Runtime',
          providerType: config.providerType || 'custom',
          baseUrl: config.baseUrl,
          apiKey: config.apiKey,
          authType: config.authType || 'bearer',
          extraHeaders: config.extraHeaders,
        },
        {
          path: statusPath,
          baseUrlStrategy: config.binding?.baseUrlStrategy,
          method: 'GET',
          signal,
        }
      );

      if (!response.ok) {
        consecutiveErrors++;
        console.warn(
          `[pollVideoStatus] HTTP ${response.status} for videoId: ${videoId} (${consecutiveErrors}/${maxConsecutiveErrors} consecutive errors)`
        );
        if (consecutiveErrors >= maxConsecutiveErrors) {
          throw new Error(
            `Failed to check video status: ${response.status} (after ${maxConsecutiveErrors} retries)`
          );
        }
        await new Promise((resolve) => setTimeout(resolve, interval));
        continue;
      }

      data = await response.json();
    } catch (error: any) {
      // 网络错误（fetch 本身失败）也计入连续错误
      if (error?.name === 'AbortError') throw error;
      consecutiveErrors++;
      console.warn(
        `[pollVideoStatus] Network error for videoId: ${videoId}: ${error.message} (${consecutiveErrors}/${maxConsecutiveErrors})`
      );
      if (consecutiveErrors >= maxConsecutiveErrors) {
        throw error;
      }
      await new Promise((resolve) => setTimeout(resolve, interval));
      continue;
    }

    // 请求成功，重置连续错误计数
    consecutiveErrors = 0;

    const status = data.status || data.state;
    const progress = data.progress || 0;
    onProgress(progress / 100);

    if (status === 'completed' || status === 'succeeded') {
      const inlineUrl = extractInlineVideoUrl(data);
      const url =
        inlineUrl ||
        (shouldDownloadVideoContent(
          data.model || config.model,
          config.binding,
          data
        )
          ? await downloadVideoContentToLocalUrl({
              videoId,
              provider: config.provider || {
                profileId: 'runtime',
                profileName: 'Runtime',
                providerType: config.providerType || 'custom',
                baseUrl: config.baseUrl,
                apiKey: config.apiKey,
                authType: config.authType || 'bearer',
                extraHeaders: config.extraHeaders,
              },
              binding: config.binding,
              modelId: data.model || config.model,
              cacheKey: videoId,
            })
          : undefined);
      if (!url) {
        throw new Error('No video URL in completed response');
      }
      return { url };
    }

    if (status === 'failed' || status === 'error') {
      // data.error 可能是字符串或对象 { code, message }
      const errMsg =
        typeof data.error === 'string'
          ? data.error
          : data.error?.message || data.message || 'Video generation failed';
      const errCode =
        typeof data.error === 'object' ? data.error?.code : undefined;
      const error = new Error(errMsg);
      if (errCode) {
        (error as any).code = errCode;
      }
      throw error;
    }

    // 等待下一次轮询
    await new Promise((resolve) => setTimeout(resolve, interval));
  }

  throw new Error('Video generation timeout');
}

/**
 * 收敛任务结果里的媒体 URL。
 * - data URL / 原始 base64：落到本地 Cache Storage，并返回稳定虚拟路径
 * - 远程音频 URL：主动缓存到本地稳定路径，避免签名链接过期后无法播放
 * - 其他 http/https：保留原始远程 URL，交给既有 SW 请求拦截链路处理，避免把远程素材误判成本地素材
 */
export async function cacheRemoteUrl(
  remoteUrl: string,
  taskId: string,
  mediaType: 'image' | 'video' | 'audio',
  format: string,
  _index?: number,
  options?: CacheRemoteUrlOptions
): Promise<string> {
  const requirePersistence = options?.requirePersistence === true;
  const signal = options?.signal;
  throwIfCacheAborted(signal);

  const normalizedUrl =
    mediaType === 'image' ? normalizeImageDataUrl(remoteUrl) : remoteUrl;

  // A task-backed result may only reuse a virtual URL after proving that both
  // its bytes and metadata are still readable from the unified cache.
  if (isVirtualMediaUrl(normalizedUrl)) {
    if (requirePersistence) {
      try {
        const isPersisted = await withMediaCacheDeadline(
          'local media verification',
          () => unifiedCacheService.isCached(normalizedUrl),
          signal
        );
        if (!isPersisted) {
          throw new ImageCachePersistenceError('本地缓存校验失败');
        }
        await withMediaCacheDeadline(
          'local image media verification',
          () =>
            verifyCachedImageMedia(
              normalizedUrl,
              mediaType,
              format,
              options
            ),
          signal
        );
      } catch (error) {
        if (isCacheAbort(error, signal)) {
          throw error;
        }
        throwRequiredPersistenceError(error, '本地缓存校验失败');
      }
    }
    return normalizedUrl;
  }

  const isHttpUrl =
    normalizedUrl.startsWith('http://') || normalizedUrl.startsWith('https://');
  const shouldFetchForPersistence =
    isHttpUrl ||
    (requirePersistence &&
      !isDataURL(normalizedUrl) &&
      (normalizedUrl.startsWith('/') ||
        normalizedUrl.startsWith('./') ||
        normalizedUrl.startsWith('../') ||
        normalizedUrl.startsWith('blob:')));

  if (shouldFetchForPersistence) {
    if (
      isHttpUrl &&
      mediaType !== 'audio' &&
      !options?.forceRemoteCache &&
      !requirePersistence
    ) {
      return normalizedUrl;
    }

    const persistRemoteMedia = async (): Promise<string> => {
      throwIfCacheAborted(signal);
      try {
        const cacheSource = options?.source || 'AI_GENERATED';
        if (await unifiedCacheService.isCached(normalizedUrl)) {
          await verifyCachedImageMedia(
            normalizedUrl,
            mediaType,
            format,
            options
          );
          return normalizedUrl;
        }

        const response = await fetch(normalizedUrl, {
          credentials: 'omit',
          cache: 'no-store',
          referrerPolicy: 'no-referrer',
          ...(signal ? { signal } : {}),
        });
        if (!response.ok) {
          if (requirePersistence) {
            throw new ImageCachePersistenceError(
              `远程图片下载失败（HTTP ${response.status}）`
            );
          }
          return normalizedUrl;
        }

        const blob = await response.blob();
        if (blob.size === 0) {
          if (requirePersistence) {
            throw new ImageCachePersistenceError('远程图片为空');
          }
          return normalizedUrl;
        }
        reportPersistedImageMedia(mediaType, blob, format, options);

        const cachedUrl = await unifiedCacheService.cacheMediaFromBlob(
          normalizedUrl,
          blob,
          mediaType,
          {
            taskId,
            source: cacheSource,
            ...options?.extraMetadata,
          }
        );
        if (requirePersistence) {
          if (!cachedUrl || !(await unifiedCacheService.isCached(cachedUrl))) {
            throw new ImageCachePersistenceError('远程图片缓存校验失败');
          }
          return cachedUrl;
        }
        return normalizedUrl;
      } catch (error) {
        if (isCacheAbort(error, signal)) {
          throw error;
        }
        if (requirePersistence) {
          throwRequiredPersistenceError(error, '远程图片缓存失败');
        }
        console.warn(
          '[cacheRemoteUrl] Remote media cache failed, using original URL:',
          error
        );
        return normalizedUrl;
      }
    };

    if (requirePersistence) {
      try {
        return await withMediaCacheDeadline(
          'remote image persistence',
          persistRemoteMedia,
          signal
        );
      } catch (error) {
        if (isCacheAbort(error, signal)) {
          throw error;
        }
        throwRequiredPersistenceError(error, '远程图片缓存超时');
      }
    }

    return persistRemoteMedia();
  }

  const inferredFormat = getFileExtension(normalizedUrl);
  const finalFormat = inferredFormat !== 'bin' ? inferredFormat : format;

  try {
    // data URL / 原始 base64：直接解码为 Blob，避免通过 fetch(data:)
    // 制造一条伪网络请求，也避免在开发者工具中复制巨大的 URL。
    if (isDataURL(normalizedUrl)) {
      return await withMediaCacheDeadline(
        'inline media persistence',
        async () => {
          throwIfCacheAborted(signal);
          const blob = dataUrlToBlob(normalizedUrl);
          if (blob.size === 0) {
            if (requirePersistence) {
              throw new ImageCachePersistenceError('内联图片为空');
            }
            console.warn(
              '[cacheRemoteUrl] Empty data URL blob, using original URL'
            );
            return normalizedUrl;
          }
          reportPersistedImageMedia(mediaType, blob, finalFormat, options);

          const contentHash = await calculateBlobChecksum(blob);
          const hashedFormat = getFileExtension('', blob.type);
          const contentAddressedUrl =
            mediaType === 'audio'
              ? `${AI_GENERATED_AUDIO_URL_PREFIX}content-${contentHash}.${
                  hashedFormat !== 'bin' ? hashedFormat : finalFormat
                }`
              : `/__aitu_cache__/${mediaType}/content-${contentHash}.${
                  hashedFormat !== 'bin' ? hashedFormat : finalFormat
                }`;

          if (await unifiedCacheService.isCached(contentAddressedUrl)) {
            return contentAddressedUrl;
          }

          const cachedUrl = await unifiedCacheService.cacheMediaFromBlob(
            contentAddressedUrl,
            blob,
            mediaType,
            {
              contentHash,
              metadata: {
                taskId,
                ...(mediaType === 'audio' ? { source: 'AI_GENERATED' } : {}),
                ...options?.extraMetadata,
              },
            }
          );
          if (requirePersistence) {
            if (
              !cachedUrl ||
              !(await unifiedCacheService.isCached(cachedUrl))
            ) {
              throw new ImageCachePersistenceError('内联图片缓存校验失败');
            }
            return cachedUrl;
          }
          return contentAddressedUrl;
        },
        signal
      );
    }

    if (requirePersistence) {
      throw new ImageCachePersistenceError('不支持的图片结果地址');
    }
    return normalizedUrl;
  } catch (error) {
    if (isCacheAbort(error, signal)) {
      throw error;
    }
    if (requirePersistence) {
      throwRequiredPersistenceError(error, '图片缓存失败');
    }
    console.warn('[cacheRemoteUrl] Cache failed, using original URL:', error);
    return normalizedUrl;
  }
}

/**
 * 批量缓存多个远程 URL
 */
export async function cacheRemoteUrls(
  urls: readonly string[],
  taskId: string,
  mediaType: 'image' | 'video' | 'audio',
  format: string,
  options?: CacheRemoteUrlOptions
): Promise<string[]> {
  const requirePersistence =
    options?.requirePersistence ?? mediaType === 'image';
  const forceRemoteCache = options?.forceRemoteCache ?? requirePersistence;
  const cacheOptions: CacheRemoteUrlOptions = {
    ...options,
    requirePersistence,
    forceRemoteCache,
  };

  const uniqueUrls = Array.from(new Set(urls));
  const run = async () => {
    options?.telemetry?.increment(
      'artifactCacheOperations',
      uniqueUrls.length
    );
    return mapImageInvocationWithConcurrency(
      uniqueUrls,
      IMAGE_ARTIFACT_CACHE_CONCURRENCY,
      (url, index) =>
        cacheRemoteUrl(
          url,
          taskId,
          mediaType,
          format,
          uniqueUrls.length > 1 ? index : undefined,
          cacheOptions
        ),
      options?.signal
    );
  };

  return options?.telemetry
    ? options.telemetry.measure('artifactCaching', run)
    : run();
}

function resolveImageArtifactCacheFormat(
  artifact: ImageArtifact
): ImageArtifactFormat {
  if (artifact.format) {
    return artifact.format;
  }
  switch (artifact.mimeType) {
    case 'image/jpeg':
      return 'jpg';
    case 'image/webp':
      return 'webp';
    case 'image/gif':
      return 'gif';
    case 'image/png':
    default:
      return 'png';
  }
}

/**
 * Persist canonical image artifacts without collapsing their MIME, format or
 * dimension metadata into a single task-level value.
 */
export async function cacheImageArtifacts(
  artifacts: readonly ImageArtifact[],
  taskId: string,
  options?: CacheRemoteUrlOptions
): Promise<ImageArtifact[]> {
  const seen = new Set<string>();
  const uniqueArtifacts = artifacts.filter((artifact) => {
    if (seen.has(artifact.url)) {
      return false;
    }
    seen.add(artifact.url);
    return true;
  });
  const cacheOptions: CacheRemoteUrlOptions = {
    ...options,
    requirePersistence: options?.requirePersistence ?? true,
    forceRemoteCache: options?.forceRemoteCache ?? true,
  };
  const run = async () => {
    options?.telemetry?.increment(
      'artifactCacheOperations',
      uniqueArtifacts.length
    );
    return mapImageInvocationWithConcurrency(
      uniqueArtifacts,
      IMAGE_ARTIFACT_CACHE_CONCURRENCY,
      async (artifact, index) => {
        let persistedMedia: PersistedImageMedia | undefined;
        const url = await cacheRemoteUrl(
          artifact.url,
          taskId,
          'image',
          resolveImageArtifactCacheFormat(artifact),
          uniqueArtifacts.length > 1 ? index : undefined,
          {
            ...cacheOptions,
            onImageMediaResolved: (media) => {
              persistedMedia = media;
            },
          }
        );
        if (cacheOptions.requirePersistence && !persistedMedia) {
          throw new ImageCachePersistenceError('图片 MIME 校验未完成');
        }
        return {
          ...artifact,
          url,
          ...(persistedMedia || {}),
        };
      },
      options?.signal
    );
  };

  return options?.telemetry
    ? options.telemetry.measure('artifactCaching', run)
    : run();
}
