import {
  providerTransport,
  resolveProviderBindingAuthQueryKey,
  type ProviderModelBinding,
  type ProviderProtocol,
  type ProviderTransportRequest,
  type ResolvedProviderContext,
} from '../provider-routing';
import {
  resolveInvocationRoute,
  type ModelRef,
  type ResolvedInvocationRoute,
} from '../../utils/settings-manager';
import type { ModelType } from '../../constants/model-config';
import { IMAGE_GENERATION_TIMEOUT_MS } from '../../constants/TASK_CONSTANTS';
import {
  resolveInvocationPlanFromRoute,
  type InvocationPlan,
} from '../provider-routing';
import type { AdapterContext, ImageGenerationRequest } from './types';

interface AdapterContextRouteOptions {
  bindingId?: string | null;
  preferredRequestSchema?: string | readonly string[] | null;
}

interface SupportedImageBindingContract {
  readonly protocol: ProviderProtocol;
  readonly requestSchema: string;
}

interface RequireImageBindingOptions {
  readonly adapterLabel: string;
  readonly requirePollPath?: boolean;
  readonly supportedBindings?: readonly SupportedImageBindingContract[];
}

type ExecutableImageBinding = ProviderModelBinding & {
  readonly submitPath: string;
  readonly submitMethod: ProviderModelBinding['submitMethod'];
};

type PollingImageBinding = ExecutableImageBinding & {
  readonly pollPathTemplate: string;
  readonly pollMethod: NonNullable<ProviderModelBinding['pollMethod']>;
};

export function requireImageBinding(
  context: AdapterContext,
  request: ImageGenerationRequest,
  options: RequireImageBindingOptions & { readonly requirePollPath: true }
): PollingImageBinding;
export function requireImageBinding(
  context: AdapterContext,
  request: ImageGenerationRequest,
  options: RequireImageBindingOptions
): ExecutableImageBinding;
/**
 * Enforce the immutable image execution identity at the adapter boundary.
 *
 * Image adapters are serializers for an already-selected binding. They must
 * never manufacture a model, endpoint, or protocol when that plan is absent
 * or internally inconsistent.
 */
export function requireImageBinding(
  context: AdapterContext,
  request: ImageGenerationRequest,
  options: RequireImageBindingOptions
): ExecutableImageBinding | PollingImageBinding {
  const { adapterLabel, requirePollPath, supportedBindings } = options;
  const binding = context.binding;

  if (!binding) {
    throw new Error(`${adapterLabel} 缺少 InvocationPlan.binding`);
  }
  if (binding.operation !== 'image') {
    throw new Error(
      `${adapterLabel} binding operation 不是 image: ${binding.operation}`
    );
  }
  if (!binding.submitPath?.trim()) {
    throw new Error(`${adapterLabel} binding 缺少 submitPath: ${binding.id}`);
  }
  if (!binding.submitMethod?.trim()) {
    throw new Error(`${adapterLabel} binding 缺少 submitMethod: ${binding.id}`);
  }
  if (requirePollPath && !binding.pollPathTemplate?.trim()) {
    throw new Error(
      `${adapterLabel} binding 缺少 pollPathTemplate: ${binding.id}`
    );
  }
  if (requirePollPath && !binding.pollMethod?.trim()) {
    throw new Error(`${adapterLabel} binding 缺少 pollMethod: ${binding.id}`);
  }
  if (
    supportedBindings?.length &&
    !supportedBindings.some(
      (candidate) =>
        candidate.protocol === binding.protocol &&
        candidate.requestSchema === binding.requestSchema
    )
  ) {
    throw new Error(
      `${adapterLabel} 不支持 binding protocol/requestSchema: ${binding.protocol}/${binding.requestSchema}`
    );
  }

  const modelId = request.model;
  if (!modelId?.trim()) {
    throw new Error(`${adapterLabel} 请求缺少已解析模型 ID`);
  }
  if (binding.modelId !== modelId) {
    throw new Error(
      `${adapterLabel} 请求模型与 binding 不一致: ${modelId} != ${binding.modelId}`
    );
  }
  if (
    request.modelRef &&
    (request.modelRef.profileId !== binding.profileId ||
      request.modelRef.modelId !== binding.modelId)
  ) {
    throw new Error(
      `${adapterLabel} ModelRef 与 binding 不一致: ${String(
        request.modelRef.profileId
      )}/${String(request.modelRef.modelId)}`
    );
  }
  if (request.bindingId && request.bindingId !== binding.id) {
    throw new Error(
      `${adapterLabel} binding identity 不一致: ${request.bindingId} != ${binding.id}`
    );
  }
  if (context.provider && context.provider.profileId !== binding.profileId) {
    throw new Error(
      `${adapterLabel} provider 与 binding 不一致: ${context.provider.profileId} != ${binding.profileId}`
    );
  }

  return binding;
}

export const getAdapterContextFromPlan = (
  plan: InvocationPlan,
  operation: ModelType
): AdapterContext => ({
  baseUrl: plan.provider.baseUrl,
  operation,
  apiKey: plan.provider.apiKey,
  authType: plan.provider.authType,
  extraHeaders: plan.provider.extraHeaders,
  provider: plan.provider,
  binding: plan.binding,
});

export const getAdapterContextFromSettings = (
  routeType: ModelType,
  modelId?: string | ModelRef | null,
  options: AdapterContextRouteOptions = {}
): AdapterContext => {
  const plan = resolveInvocationPlanFromRoute(routeType, modelId, options);
  if (plan) {
    return getAdapterContextFromPlan(plan, routeType);
  }

  return getLegacyAdapterContextFromSettings(routeType, modelId);
};

/**
 * Build the pre-binding compatibility context without invoking the planner.
 * New provider-backed image execution must use `getAdapterContextFromPlan`.
 */
export const getLegacyAdapterContextFromSettings = (
  routeType: ModelType,
  modelId?: string | ModelRef | null
): AdapterContext => {
  const route: ResolvedInvocationRoute = resolveInvocationRoute(
    routeType,
    modelId
  );
  return {
    baseUrl: route.baseUrl,
    operation: routeType,
    apiKey: route.apiKey,
    authType: 'bearer',
    provider: null,
    binding: null,
  };
};

export function buildProviderContextFromAdapterContext(
  context: AdapterContext,
  baseUrlOverride?: string
): ResolvedProviderContext {
  if (context.provider) {
    return {
      ...context.provider,
      baseUrl: baseUrlOverride || context.provider.baseUrl,
    };
  }

  return {
    profileId: 'runtime',
    profileName: 'Runtime',
    providerType: 'custom',
    baseUrl: baseUrlOverride || context.baseUrl,
    apiKey: context.apiKey || '',
    authType: context.authType || 'bearer',
    extraHeaders: context.extraHeaders,
  };
}

export function sendAdapterRequest(
  context: AdapterContext,
  request: ProviderTransportRequest,
  baseUrlOverride?: string
): Promise<Response> {
  const timeoutMs =
    request.timeoutMs ??
    (context.operation === 'image' ? IMAGE_GENERATION_TIMEOUT_MS : undefined);

  return providerTransport.send(
    buildProviderContextFromAdapterContext(context, baseUrlOverride),
    {
      ...request,
      authQueryKey:
        request.authQueryKey ||
        resolveProviderBindingAuthQueryKey(context.binding),
      timeoutMs,
      fetcher: context.fetcher || request.fetcher,
    }
  );
}
