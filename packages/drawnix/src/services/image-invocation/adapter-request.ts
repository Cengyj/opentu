import type { ImageGenerationRequest } from '../model-adapters/types';
import type { ResolvedImageInvocation } from './resolve-invocation';
import type { ImageGenerationMode } from './types';

export interface ImageAdapterRequestOverrides {
  readonly signal?: AbortSignal;
  readonly size?: string;
  readonly referenceImages?: readonly string[];
  readonly maskImage?: string;
  readonly generationMode?: ImageGenerationMode;
  readonly onSubmitted?: (remoteId: string) => void | Promise<void>;
  readonly onProgress?: (progress: number, status?: string) => void;
  readonly pollIntervalMs?: number;
  readonly pollMaxAttempts?: number;
}

/**
 * The sole projection from a resolved invocation into an adapter request.
 *
 * Canonical fields are copied explicitly so aliases and execution-only task
 * data cannot leak into serializers. The selected model and binding identity
 * always come from the immutable invocation rather than caller overrides.
 */
export function createImageAdapterRequest(
  invocation: ResolvedImageInvocation,
  overrides: ImageAdapterRequestOverrides = {}
): ImageGenerationRequest {
  const { request } = invocation;
  const referenceImages = Object.freeze([
    ...(overrides.referenceImages ?? request.referenceImages),
  ]);

  return Object.freeze({
    prompt: request.prompt,
    operationIntent: invocation.intent,
    model: invocation.modelId,
    modelRef: invocation.modelRef,
    bindingId: invocation.plan?.binding.id ?? request.bindingId,
    generationMode:
      overrides.generationMode ??
      request.generationMode ??
      (invocation.intent === 'edit' ? 'image_to_image' : 'text_to_image'),
    referenceImages,
    maskImage: overrides.maskImage ?? request.maskImage,
    size: overrides.size ?? request.size,
    aspectRatio: request.aspectRatio,
    resolution: request.resolution,
    quality: request.quality,
    inputFidelity: request.inputFidelity,
    background: request.background,
    outputFormat: request.outputFormat,
    outputCompression: request.outputCompression,
    count: request.count,
    responseFormat: request.responseFormat,
    moderation: request.moderation,
    user: request.user,
    params: request.params,
    signal: overrides.signal ?? request.signal,
    onSubmitted: overrides.onSubmitted,
    onProgress: overrides.onProgress,
    pollIntervalMs: overrides.pollIntervalMs,
    pollMaxAttempts: overrides.pollMaxAttempts,
    telemetry: invocation.telemetry,
  });
}
