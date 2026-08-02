import { describe, expect, it } from 'vitest';
import type { ParamConfig } from '../../../constants/model-config';
import type { BindingScopedImageParameterState } from '../../../services/image-binding-parameter-capabilities';
import type {
  ImageBindingCapabilities,
  ImageEnumCapability,
  ImageOperationIntent,
} from '../../../services/image-invocation';
import type { ModelRef } from '../../../utils/settings-types';
import {
  prepareWorkflowImageSubmission,
  resolveWorkflowImageOperation,
} from './image-generation-params';

const MODEL_ID = 'shared-image-model';
const MODEL_REF: ModelRef = {
  profileId: 'profile-primary',
  modelId: MODEL_ID,
};

function enumParam(id: string, values: readonly string[]): ParamConfig {
  return {
    id,
    label: id,
    valueType: 'enum',
    options: values.map((value) => ({ value, label: value })),
    compatibleModels: [MODEL_ID],
    modelType: 'image',
  };
}

function enumCapability(
  supported: boolean,
  values?: readonly string[]
): ImageEnumCapability {
  return { supported, ...(values ? { values } : {}) };
}

function parameterState(options: {
  operation: ImageOperationIntent;
  compatibleParams?: readonly ParamConfig[];
  size?: ImageEnumCapability;
  aspectRatio?: ImageEnumCapability;
  evidence?: Partial<ImageBindingCapabilities['evidence']>;
  profileId?: string;
}): BindingScopedImageParameterState {
  const capabilities: ImageBindingCapabilities = {
    bindingId: `binding-${options.operation}`,
    profileId: options.profileId || MODEL_REF.profileId || '',
    modelId: MODEL_ID,
    requestSchema: `test.image.${options.operation}`,
    source: 'binding-metadata',
    evidence: options.evidence || {},
    operations: [options.operation],
    size: options.size,
    aspectRatio: options.aspectRatio,
  };
  return {
    resolution: 'binding',
    compatibleParams: options.compatibleParams || [],
    capabilities,
    bindingId: capabilities.bindingId,
    operationSupported: true,
  };
}

describe('workflow image generation params', () => {
  it('uses the canonical operation resolver for generation and edit requests', () => {
    expect(resolveWorkflowImageOperation([])).toBe('generation');
    expect(
      resolveWorkflowImageOperation(['https://example.com/reference.png'])
    ).toBe('edit');
  });

  it('preserves the complete ModelRef and emits size only at the top level', () => {
    const result = prepareWorkflowImageSubmission({
      modelId: MODEL_ID,
      modelRef: MODEL_REF,
      operation: 'generation',
      selectedParams: { size: '1024x1024', quality: 'high' },
      parameterState: parameterState({
        operation: 'generation',
        compatibleParams: [
          enumParam('size', ['1024x1024']),
          enumParam('quality', ['high']),
        ],
        size: enumCapability(true, ['1024x1024']),
        evidence: { size: 'binding-metadata' },
      }),
    });

    expect(result.modelRef).toBe(MODEL_REF);
    expect(result).toMatchObject({
      model: MODEL_ID,
      operation: 'generation',
      size: '1024x1024',
      params: { quality: 'high' },
    });
    expect(result.params).not.toHaveProperty('size');
  });

  it('uses the workflow aspect ratio as size only when the binding supports its value', () => {
    const supported = prepareWorkflowImageSubmission({
      modelId: MODEL_ID,
      modelRef: MODEL_REF,
      operation: 'generation',
      selectedParams: {},
      workflowAspectRatio: '16:9',
      parameterState: parameterState({
        operation: 'generation',
        size: enumCapability(true, ['16x9']),
        evidence: { size: 'binding-metadata' },
      }),
    });
    const unsupportedValue = prepareWorkflowImageSubmission({
      modelId: MODEL_ID,
      modelRef: MODEL_REF,
      operation: 'generation',
      selectedParams: {},
      workflowAspectRatio: '16:9',
      parameterState: parameterState({
        operation: 'generation',
        size: enumCapability(true, ['1x1']),
        evidence: { size: 'binding-metadata' },
      }),
    });

    expect(supported.size).toBe('16:9');
    expect(supported.params).toBeUndefined();
    expect(unsupportedValue.size).toBeUndefined();
  });

  it('uses the canonical aspectRatio field when size is unsupported', () => {
    const result = prepareWorkflowImageSubmission({
      modelId: MODEL_ID,
      modelRef: MODEL_REF,
      operation: 'edit',
      selectedParams: {},
      workflowAspectRatio: '9:16',
      parameterState: parameterState({
        operation: 'edit',
        size: enumCapability(false),
        aspectRatio: enumCapability(true, ['9:16']),
        evidence: {
          size: 'binding-metadata',
          aspectRatio: 'binding-metadata',
        },
      }),
    });

    expect(result.operation).toBe('edit');
    expect(result.size).toBeUndefined();
    expect(result.params).toEqual({ aspectRatio: '9:16' });
  });

  it('does not inject a fallback for unsupported or mismatched bindings', () => {
    const unsupported = prepareWorkflowImageSubmission({
      modelId: MODEL_ID,
      modelRef: MODEL_REF,
      operation: 'generation',
      selectedParams: {},
      workflowAspectRatio: '16:9',
      parameterState: parameterState({
        operation: 'generation',
        size: enumCapability(false),
        aspectRatio: enumCapability(false),
        evidence: {
          size: 'binding-metadata',
          aspectRatio: 'binding-metadata',
        },
      }),
    });
    const mismatchedProfile = prepareWorkflowImageSubmission({
      modelId: MODEL_ID,
      modelRef: MODEL_REF,
      operation: 'generation',
      selectedParams: {},
      workflowAspectRatio: '16:9',
      parameterState: parameterState({
        operation: 'generation',
        size: enumCapability(true),
        evidence: { size: 'binding-metadata' },
        profileId: 'profile-other',
      }),
    });

    expect(unsupported.size).toBeUndefined();
    expect(unsupported.params).toBeUndefined();
    expect(mismatchedProfile.size).toBeUndefined();
    expect(mismatchedProfile.params).toBeUndefined();
  });
});
