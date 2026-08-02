import type { ImageGenerationResult } from '../model-adapters/types';
import {
  createImageAdapterRequest,
  type ImageAdapterRequestOverrides,
} from './adapter-request';
import { prepareImageInputs } from './reference-materializer';
import { throwIfImageInvocationAborted } from './bounded-concurrency';
import type { ResolvedImageInvocation } from './resolve-invocation';

export interface ExecuteResolvedImageInvocationOptions
  extends ImageAdapterRequestOverrides {
  readonly referenceConcurrency?: number;
  readonly materializeReference?: (
    source: string,
    signal?: AbortSignal
  ) => Promise<string>;
}

/** The only production boundary allowed to invoke an image adapter. */
export async function executeResolvedImageInvocation(
  invocation: ResolvedImageInvocation,
  options: ExecuteResolvedImageInvocationOptions = {}
): Promise<ImageGenerationResult> {
  const signal = options.signal ?? invocation.request.signal;
  throwIfImageInvocationAborted(signal);
  const preparedInputs = await prepareImageInputs(
    invocation.request.referenceImages,
    invocation.request.maskImage,
    {
      signal,
      concurrency: options.referenceConcurrency,
      telemetry: invocation.telemetry,
      materialize: options.materializeReference,
    }
  );
  throwIfImageInvocationAborted(signal);

  return invocation.adapter.generateImage(
    invocation.adapterContext,
    createImageAdapterRequest(invocation, {
      ...options,
      signal,
      referenceImages: preparedInputs.referenceImages,
      maskImage: preparedInputs.maskImage,
    })
  );
}
