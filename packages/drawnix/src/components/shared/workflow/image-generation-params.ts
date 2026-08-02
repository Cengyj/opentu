import type { ModelRef } from '../../../utils/settings-types';
import {
  pruneSelectedImageParams,
  resolveImageParametersForSelection,
  type BindingScopedImageParameterState,
} from '../../../services/image-binding-parameter-capabilities';
import {
  normalizeImageRequest,
  resolveImageOperationIntent,
  type ImageEnumCapability,
  type ImageOperationIntent,
} from '../../../services/image-invocation';

export interface WorkflowImageSubmission {
  readonly model: string;
  readonly modelRef: ModelRef | null;
  readonly operation: ImageOperationIntent;
  readonly size?: string;
  readonly params?: Readonly<Record<string, string>>;
}

interface WorkflowImageSubmissionBase {
  readonly modelId: string;
  readonly modelRef: ModelRef | null;
  readonly selectedParams: Readonly<Record<string, string>>;
  readonly workflowAspectRatio?: string;
}

export interface PrepareWorkflowImageSubmissionInput
  extends WorkflowImageSubmissionBase {
  readonly operation: ImageOperationIntent;
  readonly parameterState: BindingScopedImageParameterState;
}

export interface ResolveWorkflowImageSubmissionInput
  extends WorkflowImageSubmissionBase {
  readonly referenceImages: readonly string[];
}

export function resolveWorkflowImageOperation(
  referenceImages: readonly string[]
): ImageOperationIntent {
  return resolveImageOperationIntent(
    normalizeImageRequest({
      prompt: 'workflow-image-capability-preview',
      referenceImages,
    })
  );
}

function normalizeCapabilityValue(
  parameter: 'size' | 'aspectRatio',
  value: string
): string | undefined {
  const request = normalizeImageRequest({
    prompt: 'workflow-image-capability-preview',
    [parameter]: value,
  });
  return request[parameter];
}

function supportsFallbackValue(
  capability: ImageEnumCapability | undefined,
  parameter: 'size' | 'aspectRatio',
  value: string
): boolean {
  if (!capability?.supported) {
    return false;
  }
  if (!capability.values) {
    return true;
  }
  try {
    const normalizedValue = normalizeCapabilityValue(parameter, value);
    return (
      normalizedValue !== undefined &&
      capability.values.includes(normalizedValue)
    );
  } catch {
    return false;
  }
}

function hasMatchingBinding(
  modelId: string,
  modelRef: ModelRef | null,
  state: BindingScopedImageParameterState
): boolean {
  return (
    state.resolution === 'binding' &&
    state.operationSupported === true &&
    !!modelRef?.profileId &&
    modelRef.modelId === modelId &&
    state.capabilities?.profileId === modelRef.profileId &&
    state.capabilities.modelId === modelId
  );
}

/**
 * Produces the image-only request fragment shared by workflow pages.
 * Canonical `size` is emitted once at the top level; provider parameters never
 * receive a duplicate copy. The workflow aspect ratio is injected only when
 * the exact binding declares support for the corresponding canonical field.
 */
export function prepareWorkflowImageSubmission(
  input: PrepareWorkflowImageSubmissionInput
): WorkflowImageSubmission {
  const prunedParams = pruneSelectedImageParams(
    input.selectedParams,
    input.parameterState.compatibleParams
  );
  const { size: selectedSize, ...providerParams } = prunedParams;
  let size = selectedSize;

  if (
    !size &&
    !providerParams.aspectRatio &&
    input.workflowAspectRatio &&
    hasMatchingBinding(input.modelId, input.modelRef, input.parameterState)
  ) {
    const capabilities = input.parameterState.capabilities;
    if (
      capabilities?.evidence.size &&
      supportsFallbackValue(
        capabilities.size,
        'size',
        input.workflowAspectRatio
      )
    ) {
      size = input.workflowAspectRatio;
    } else if (
      capabilities?.evidence.aspectRatio &&
      supportsFallbackValue(
        capabilities.aspectRatio,
        'aspectRatio',
        input.workflowAspectRatio
      )
    ) {
      providerParams.aspectRatio = input.workflowAspectRatio;
    }
  }

  return {
    model: input.modelId,
    modelRef: input.modelRef,
    operation: input.operation,
    ...(size ? { size } : {}),
    ...(Object.keys(providerParams).length > 0
      ? { params: providerParams }
      : {}),
  };
}

export function resolveWorkflowImageSubmission(
  input: ResolveWorkflowImageSubmissionInput
): WorkflowImageSubmission {
  const operation = resolveWorkflowImageOperation(input.referenceImages);
  const parameterState = resolveImageParametersForSelection(
    input.modelId,
    input.modelRef,
    operation
  );
  return prepareWorkflowImageSubmission({
    ...input,
    operation,
    parameterState,
  });
}
