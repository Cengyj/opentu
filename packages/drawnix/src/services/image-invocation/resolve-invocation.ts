import { getDefaultImageModel } from '../../constants/model-config';
import type { ModelRef } from '../../utils/settings-types';
import { getAdapterContextFromPlan } from '../model-adapters/context';
import { resolveAdapterForPlan } from '../model-adapters/registry';
import type {
  AdapterContext,
  ImageModelAdapter,
} from '../model-adapters/types';
import {
  InvocationPlanningError,
  resolveInvocationPlanFromRoute,
  type InvocationPlan,
} from '../provider-routing';
import {
  assertImageRequestCapabilities,
  resolveImageBindingCapabilities,
} from './capabilities';
import { ImageInvocationError } from './errors';
import { normalizeImageRequest } from './normalize-request';
import { resolveImageOperationIntent } from './operation-intent';
import {
  createImageInvocationTelemetry,
  type ImageInvocationTelemetry,
} from './performance';
import {
  GPT_IMAGE_EDIT_REQUEST_SCHEMAS,
  GPT_IMAGE_GENERATION_REQUEST_SCHEMAS,
} from './request-schemas';
import type {
  ImageBindingCapabilities,
  ImageOperationIntent,
  NormalizedImageRequest,
} from './types';

export interface ResolveImageInvocationOptions {
  /**
   * An already-selected durable plan. `null` explicitly selects the legacy
   * no-binding boundary; `undefined` lets this function plan exactly once.
   */
  readonly plan?: InvocationPlan | null;
  readonly fallbackModel?: string;
  readonly telemetry?: ImageInvocationTelemetry;
}

export interface ResolvedImageInvocation {
  readonly request: NormalizedImageRequest;
  readonly intent: ImageOperationIntent;
  readonly preferredRequestSchema?: readonly string[];
  readonly plan: InvocationPlan;
  readonly modelRef: Readonly<ModelRef>;
  readonly modelId: string;
  readonly adapter: ImageModelAdapter;
  readonly adapterContext: AdapterContext;
  readonly capabilities: ImageBindingCapabilities;
  readonly telemetry: ImageInvocationTelemetry;
}

function toPlanningErrorDetails(
  error: InvocationPlanningError,
  request: NormalizedImageRequest
): Readonly<Record<string, unknown>> {
  const source = error.details || {};
  const bindingIds = Array.isArray(source.bindingIds)
    ? source.bindingIds.filter(
        (bindingId): bindingId is string => typeof bindingId === 'string'
      )
    : undefined;

  return Object.freeze({
    profileId:
      typeof source.profileId === 'string'
        ? source.profileId
        : request.modelRef?.profileId,
    modelId:
      typeof source.modelId === 'string'
        ? source.modelId
        : request.modelRef?.modelId || request.model,
    operation: 'image',
    ...(typeof source.bindingId === 'string'
      ? { bindingId: source.bindingId }
      : request.bindingId
      ? { bindingId: request.bindingId }
      : {}),
    ...(bindingIds ? { bindingIds } : {}),
    planningReason: error.reason,
  });
}

function convertImagePlanningError(
  error: InvocationPlanningError,
  request: NormalizedImageRequest
): ImageInvocationError {
  const ambiguous = error.reason === 'AMBIGUOUS_BINDING';
  return new ImageInvocationError(
    ambiguous ? 'IMAGE_BINDING_AMBIGUOUS' : 'IMAGE_BINDING_UNAVAILABLE',
    ambiguous
      ? '图片模型存在多个同优先级协议 binding，无法安全选择接口'
      : '图片模型没有可执行的协议 binding',
    {
      stage: 'planning',
      cause: error,
      details: toPlanningErrorDetails(error, request),
    }
  );
}

function assertResolvedImagePlanIdentity(plan: InvocationPlan): void {
  const profileIds = [
    plan.provider.profileId,
    plan.modelRef.profileId,
    plan.binding.profileId,
  ];
  if (
    new Set(profileIds).size !== 1 ||
    plan.binding.modelId !== plan.modelRef.modelId ||
    plan.binding.operation !== 'image'
  ) {
    throw new ImageInvocationError(
      'IMAGE_BINDING_UNAVAILABLE',
      '图片调用计划中的 Profile、模型或 operation 身份不一致',
      {
        stage: 'planning',
        details: {
          providerProfileId: plan.provider.profileId,
          modelProfileId: plan.modelRef.profileId,
          bindingProfileId: plan.binding.profileId,
          modelId: plan.modelRef.modelId,
          bindingModelId: plan.binding.modelId,
          operation: plan.binding.operation,
          bindingId: plan.binding.id,
        },
      }
    );
  }
}

function assertResolvedImageProviderConfiguration(plan: InvocationPlan): void {
  const missingFields = [
    !plan.provider.baseUrl?.trim() ? 'baseUrl' : null,
    !plan.provider.apiKey?.trim() ? 'apiKey' : null,
  ].filter((field): field is 'baseUrl' | 'apiKey' => field !== null);

  if (missingFields.length === 0) {
    return;
  }

  throw new ImageInvocationError(
    'IMAGE_CONFIGURATION_MISSING',
    `图片供应商配置缺失: ${missingFields.join(', ')}`,
    {
      stage: 'planning',
      details: {
        profileId: plan.provider.profileId,
        modelId: plan.modelRef.modelId,
        operation: 'image',
        bindingId: plan.binding.id,
        missingFields,
      },
    }
  );
}

function withResolvedExecutionIdentity(
  request: NormalizedImageRequest,
  plan: InvocationPlan | null,
  modelRef: Readonly<ModelRef> | null,
  modelId: string
): NormalizedImageRequest {
  const bindingId = plan?.binding.id ?? request.bindingId;
  if (
    request.model === modelId &&
    request.modelRef?.profileId === modelRef?.profileId &&
    request.modelRef?.modelId === modelRef?.modelId &&
    request.bindingId === bindingId
  ) {
    return request;
  }

  return Object.freeze({
    ...request,
    model: modelId,
    modelRef,
    bindingId,
  });
}

/**
 * Resolve the complete image execution identity once. Downstream code must
 * pass this value forward and must not consult settings, the catalog, or the
 * adapter registry again for the same execution.
 */
export function resolveImageInvocation(
  rawRequest: unknown,
  options: ResolveImageInvocationOptions = {}
): ResolvedImageInvocation {
  const telemetry = options.telemetry || createImageInvocationTelemetry();
  return resolveNormalizedImageInvocation(
    normalizeImageRequest(rawRequest, { telemetry }),
    { ...options, telemetry }
  );
}

/**
 * Resolve a request that has already crossed the sole raw-input normalization
 * boundary. Queue and executor layers use this overload so aliases are never
 * parsed a second time during the same execution attempt.
 */
export function resolveNormalizedImageInvocation(
  normalizedRequest: NormalizedImageRequest,
  options: ResolveImageInvocationOptions = {}
): ResolvedImageInvocation {
  const request = normalizedRequest;
  const telemetry = options.telemetry || createImageInvocationTelemetry();
  const intent = resolveImageOperationIntent(request);
  const preferredRequestSchema =
    intent === 'edit'
      ? GPT_IMAGE_EDIT_REQUEST_SCHEMAS
      : GPT_IMAGE_GENERATION_REQUEST_SCHEMAS;
  const routeModel = request.modelRef || request.model || null;
  let plan: InvocationPlan | null;
  try {
    plan =
      options.plan !== undefined
        ? options.plan
        : telemetry.measureSync('planning', () => {
            telemetry.increment('plannerCalls');
            return resolveInvocationPlanFromRoute('image', routeModel, {
              bindingId: request.bindingId,
              preferredRequestSchema,
            });
          });
  } catch (error) {
    if (error instanceof InvocationPlanningError) {
      throw convertImagePlanningError(error, request);
    }
    throw error;
  }

  if (!plan && request.bindingId) {
    throw new ImageInvocationError(
      'IMAGE_BINDING_UNAVAILABLE',
      `图片调用 binding 已不可用: ${request.bindingId}`,
      {
        stage: 'planning',
        details: { bindingId: request.bindingId },
      }
    );
  }

  if (plan && request.bindingId && plan.binding.id !== request.bindingId) {
    throw new ImageInvocationError(
      'IMAGE_BINDING_UNAVAILABLE',
      `图片调用 binding 与持久化身份不一致: ${request.bindingId}`,
      {
        stage: 'planning',
        details: {
          bindingId: request.bindingId,
          resolvedBindingId: plan.binding.id,
        },
      }
    );
  }

  if (!plan) {
    const unresolvedModel =
      request.modelRef?.modelId ||
      request.model ||
      options.fallbackModel ||
      getDefaultImageModel();
    throw new ImageInvocationError(
      'IMAGE_BINDING_UNAVAILABLE',
      `图片模型没有可执行的协议 binding: ${unresolvedModel}`,
      {
        stage: 'planning',
        details: {
          profileId: request.modelRef?.profileId,
          modelId: unresolvedModel,
        },
      }
    );
  }

  assertResolvedImagePlanIdentity(plan);
  assertResolvedImageProviderConfiguration(plan);

  const modelId = plan.modelRef.modelId;
  const modelRef: Readonly<ModelRef> = Object.freeze({
    profileId: plan.modelRef.profileId,
    modelId: plan.modelRef.modelId,
  });
  const executionRequest = withResolvedExecutionIdentity(
    request,
    plan,
    modelRef,
    modelId
  );

  telemetry.increment('adapterResolutionCalls');
  const adapter = telemetry.measureSync('adapterResolution', () =>
    resolveAdapterForPlan(plan, 'image')
  );
  if (!adapter || adapter.kind !== 'image') {
    throw new ImageInvocationError(
      'IMAGE_ADAPTER_UNAVAILABLE',
      `没有适配 selected binding 的图片适配器: ${plan.binding.id}`,
      {
        stage: 'adapter',
        details: {
          profileId: plan.modelRef.profileId,
          modelId: plan.modelRef.modelId,
          bindingId: plan.binding.id,
          requestSchema: plan.binding.requestSchema,
        },
      }
    );
  }

  telemetry.increment('capabilityValidationCalls');
  const capabilities = telemetry.measureSync('capabilityValidation', () => {
    const resolvedCapabilities = resolveImageBindingCapabilities(plan.binding);
    assertImageRequestCapabilities(
      executionRequest,
      intent,
      resolvedCapabilities
    );
    return resolvedCapabilities;
  });

  return Object.freeze({
    request: executionRequest,
    intent,
    preferredRequestSchema,
    plan,
    modelRef,
    modelId,
    adapter,
    adapterContext: getAdapterContextFromPlan(plan, 'image'),
    capabilities,
    telemetry,
  });
}
