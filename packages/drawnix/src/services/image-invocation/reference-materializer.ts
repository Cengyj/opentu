import { getDataURL } from '../../data/blob';
import { unifiedCacheService } from '../unified-cache-service';
import {
  mapImageInvocationWithConcurrency,
  throwIfImageInvocationAborted,
} from './bounded-concurrency';
import type { ImageInvocationTelemetry } from './performance';

/** Reference preparation is intentionally lower than browser connection caps. */
export const IMAGE_REFERENCE_PREPARATION_CONCURRENCY = 3;
/** Maximum reference payload after preparation (1 MiB). */
export const MAX_REFERENCE_IMAGE_BYTES = 1 * 1024 * 1024;

export interface PreparedImageInputs {
  readonly referenceImages: readonly string[];
  readonly maskImage?: string;
}

export interface PrepareImageInputsOptions {
  readonly signal?: AbortSignal;
  readonly concurrency?: number;
  readonly telemetry?: ImageInvocationTelemetry;
  /** Test seam; production uses the unified cache and canonical compressor. */
  readonly materialize?: (
    source: string,
    signal?: AbortSignal
  ) => Promise<string>;
}

/** Convert a Blob to a data URL, compressing image references above 1 MiB. */
export async function blobToBase64Under1MB(blob: Blob): Promise<string> {
  let target = blob;
  if (blob.type.startsWith('image/') && blob.size > MAX_REFERENCE_IMAGE_BYTES) {
    const { compressImageBlob } = await import('@aitu/utils');
    target = await compressImageBlob(blob, 1);
  }
  return getDataURL(target);
}

/** Ensure an already-resolved image value is a bounded data URL. */
export async function ensureBase64ForAI(
  imageData: { type: string; value: string },
  signal?: AbortSignal
): Promise<string> {
  throwIfImageInvocationAborted(signal);
  const value = imageData.value;
  if (value.startsWith('data:')) {
    const base64Part = value.slice(value.indexOf(',') + 1);
    const estimatedBytes = (base64Part.length * 3) / 4;
    if (estimatedBytes <= MAX_REFERENCE_IMAGE_BYTES) {
      return value;
    }
    const response = await fetch(value, { signal });
    const blob = await response.blob();
    throwIfImageInvocationAborted(signal);
    const prepared = await blobToBase64Under1MB(blob);
    throwIfImageInvocationAborted(signal);
    return prepared;
  }
  if (value.startsWith('http://') || value.startsWith('https://')) {
    const response = await fetch(value, {
      signal,
      referrerPolicy: 'no-referrer',
    });
    if (!response.ok) {
      throw new Error(`Failed to fetch reference image: ${response.status}`);
    }
    const blob = await response.blob();
    throwIfImageInvocationAborted(signal);
    const prepared = await blobToBase64Under1MB(blob);
    throwIfImageInvocationAborted(signal);
    return prepared;
  }
  return value;
}

async function materializeImageSource(
  source: string,
  signal?: AbortSignal
): Promise<string> {
  throwIfImageInvocationAborted(signal);
  const imageData = await unifiedCacheService.getImageForAI(source, { signal });
  throwIfImageInvocationAborted(signal);
  const prepared = await ensureBase64ForAI(imageData, signal);
  throwIfImageInvocationAborted(signal);
  return prepared;
}

/**
 * Resolve references and mask once per invocation. A promise memo is installed
 * before the first await, so duplicate sources share download/decode/compress
 * work even when different workers encounter them concurrently.
 */
export async function prepareImageInputs(
  referenceImages: readonly string[],
  maskImage: string | undefined,
  options: PrepareImageInputsOptions = {}
): Promise<PreparedImageInputs> {
  const telemetry = options.telemetry;
  const run = async (): Promise<PreparedImageInputs> => {
    const inputs = maskImage
      ? [...referenceImages, maskImage]
      : [...referenceImages];
    if (inputs.length === 0) {
      return Object.freeze({ referenceImages: Object.freeze([]) });
    }

    const materialize = options.materialize || materializeImageSource;
    const bySource = new Map<string, Promise<string>>();
    const prepared = await mapImageInvocationWithConcurrency(
      inputs,
      options.concurrency ?? IMAGE_REFERENCE_PREPARATION_CONCURRENCY,
      async (source) => {
        throwIfImageInvocationAborted(options.signal);
        let pending = bySource.get(source);
        if (!pending) {
          telemetry?.increment('referenceMaterializations');
          pending = materialize(source, options.signal);
          bySource.set(source, pending);
        }
        const value = await pending;
        throwIfImageInvocationAborted(options.signal);
        return value;
      },
      options.signal
    );

    const preparedReferences = Object.freeze(
      prepared.slice(0, referenceImages.length)
    );
    const preparedMask = maskImage ? prepared[prepared.length - 1] : undefined;
    return Object.freeze({
      referenceImages: preparedReferences,
      ...(preparedMask ? { maskImage: preparedMask } : undefined),
    });
  };

  return telemetry
    ? telemetry.measure('referencePreparation', run)
    : run();
}
