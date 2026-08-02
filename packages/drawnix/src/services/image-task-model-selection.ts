import { getDefaultImageModel } from '../constants/model-config';
import {
  createModelRef,
  resolveInvocationRoute,
  type ModelRef,
} from '../utils/settings-manager';

export interface ImageTaskModelSelection {
  readonly model: string;
  readonly modelRef: ModelRef | null;
}

/**
 * Freeze the provider-backed model identity before an image task enters the
 * queue. This delegates selection to the existing invocation route and does
 * not choose a binding, protocol, adapter, or endpoint.
 */
export function resolveImageTaskModelSelection(
  model?: string | null,
  modelRef?: ModelRef | null
): ImageTaskModelSelection {
  const explicitRef = createModelRef(
    modelRef?.profileId || null,
    modelRef?.modelId || null
  );
  if (explicitRef?.profileId && explicitRef.modelId) {
    return Object.freeze({
      model: explicitRef.modelId,
      modelRef: explicitRef,
    });
  }

  const requestedModel =
    explicitRef?.modelId ||
    (typeof model === 'string' && model.trim() ? model.trim() : null);
  const route = resolveInvocationRoute('image', requestedModel);
  const routedRef = createModelRef(route.profileId, route.modelId);
  const finalModel =
    routedRef?.modelId || requestedModel || getDefaultImageModel();

  return Object.freeze({
    model: finalModel,
    modelRef: routedRef?.profileId && routedRef.modelId ? routedRef : null,
  });
}
