import type {
  Task,
  TaskInvocationBindingSnapshot,
  TaskInvocationOperation,
  TaskInvocationRouteSnapshot,
} from '../types/task.types';
import {
  createModelRef,
  providerProfilesSettings,
  resolveInvocationRoute,
  type ModelRef,
} from '../utils/settings-manager';
import {
  listSettingsProviderProfiles,
  resolveInvocationPlanFromRoute,
  type InvocationPlan,
  type ProviderModelBinding,
} from './provider-routing';
import { normalizeProviderHttpMethod } from './provider-routing/binding-http-method';
import {
  GPT_IMAGE_EDIT_REQUEST_SCHEMAS,
  GPT_IMAGE_GENERATION_REQUEST_SCHEMAS,
} from './image-invocation/request-schemas';
import { normalizeImageRequest } from './image-invocation/normalize-request';
import type { NormalizedImageRequest } from './image-invocation/types';
import { resolveImageOperationIntent } from './image-invocation/operation-intent';
import { ImageInvocationError } from './image-invocation/errors';

const DEFAULT_BASE_URL = 'https://foropencode.com/v1';

function normalizeString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function toRouteModel(
  modelRef?: ModelRef | null,
  modelId?: string | null
): ModelRef | string | null {
  if (modelRef?.profileId || modelRef?.modelId) {
    return modelRef;
  }
  return normalizeString(modelId);
}

function cloneMetadata(
  metadata: ProviderModelBinding['metadata']
): Record<string, unknown> | undefined {
  if (!metadata) {
    return undefined;
  }

  try {
    return JSON.parse(JSON.stringify(metadata)) as Record<string, unknown>;
  } catch {
    return undefined;
  }
}

function snapshotBinding(
  binding?: ProviderModelBinding | null
): TaskInvocationBindingSnapshot | null {
  if (!binding) {
    return null;
  }

  return {
    id: binding.id,
    protocol: binding.protocol,
    requestSchema: binding.requestSchema,
    responseSchema: binding.responseSchema,
    submitPath: binding.submitPath,
    submitMethod: normalizeProviderHttpMethod(binding.submitMethod, 'POST'),
    pollPathTemplate: binding.pollPathTemplate,
    pollMethod: binding.pollPathTemplate?.trim()
      ? normalizeProviderHttpMethod(binding.pollMethod, 'GET')
      : undefined,
    baseUrlStrategy: binding.baseUrlStrategy,
    metadata: cloneMetadata(binding.metadata),
  };
}

function isExecutableBindingSnapshot(
  binding: TaskInvocationBindingSnapshot | null | undefined
): binding is Required<
  Pick<
    TaskInvocationBindingSnapshot,
    'id' | 'protocol' | 'requestSchema' | 'responseSchema' | 'submitPath'
  >
> &
  TaskInvocationBindingSnapshot {
  return Boolean(
    normalizeString(binding?.id) &&
      normalizeString(binding?.protocol) &&
      normalizeString(binding?.requestSchema) &&
      normalizeString(binding?.responseSchema) &&
      normalizeString(binding?.submitPath)
  );
}

/**
 * Rehydrate the immutable execution identity recorded when a task was
 * submitted. Catalog bindings may legitimately change after a refresh; they
 * must not change the endpoint of an existing paid invocation. Credentials
 * are deliberately refreshed only from the same enabled profile.
 */
export function resolveTaskInvocationPlanFromSnapshot(
  operation: TaskInvocationOperation,
  task: Pick<Task, 'invocationRoute'>
): InvocationPlan | null {
  const route = task.invocationRoute;
  if (!route?.providerProfileId) {
    return null;
  }
  if (!isExecutableBindingSnapshot(route.binding)) {
    if (operation === 'image') {
      throw new ImageInvocationError(
        'IMAGE_BINDING_UNAVAILABLE',
        '图片任务调用快照缺少完整 binding，无法安全执行',
        {
          stage: 'planning',
          details: {
            profileId: route.providerProfileId,
            modelId: route.modelRef?.modelId || route.modelId,
            bindingId: route.binding?.id,
          },
        }
      );
    }
    return null;
  }

  if (route.operation !== operation) {
    throw new Error(
      `任务调用类型不匹配：记录为 ${route.operation}，当前请求为 ${operation}`
    );
  }

  const storedProfile = providerProfilesSettings
    .get()
    .find((item) => item.id === route.providerProfileId);
  const profile =
    storedProfile ||
    listSettingsProviderProfiles().find(
      (item) => item.id === route.providerProfileId
    );
  if (!profile) {
    throw new Error('原供应商配置已删除，无法继续执行图片任务');
  }
  if (storedProfile && !storedProfile.enabled) {
    throw new Error('原供应商配置已停用，无法继续执行图片任务');
  }
  if (!profile.apiKey?.trim()) {
    throw new Error('原供应商 API Key 未配置，无法继续执行图片任务');
  }
  const profileId = normalizeString(route.providerProfileId);
  const modelId =
    normalizeString(route.modelRef?.modelId) || normalizeString(route.modelId);
  if (!profileId || !modelId) {
    throw new Error('任务调用快照缺少供应商或模型身份，无法继续执行图片任务');
  }

  const binding: ProviderModelBinding = {
    id: route.binding.id,
    profileId,
    modelId,
    operation,
    protocol: route.binding.protocol,
    requestSchema: route.binding.requestSchema,
    responseSchema: route.binding.responseSchema,
    submitPath: route.binding.submitPath,
    submitMethod: normalizeProviderHttpMethod(
      route.binding.submitMethod,
      'POST'
    ),
    pollPathTemplate: route.binding.pollPathTemplate,
    pollMethod: route.binding.pollPathTemplate?.trim()
      ? normalizeProviderHttpMethod(route.binding.pollMethod, 'GET')
      : undefined,
    baseUrlStrategy: route.binding.baseUrlStrategy,
    metadata: cloneMetadata(route.binding.metadata),
    // Selection rank/source are planner inputs only. A hydrated snapshot is
    // already selected and therefore never competes with catalog candidates.
    priority: 0,
    confidence: 'high',
    source: 'manual',
  };

  const providerBaseUrl =
    normalizeString(route.providerBaseUrl) || normalizeString(profile.baseUrl);
  if (!providerBaseUrl) {
    throw new Error('原供应商 Base URL 未配置，无法继续执行图片任务');
  }

  return {
    provider: {
      profileId,
      profileName: profile.name,
      providerType:
        normalizeString(route.providerType) || profile.providerType,
      baseUrl: providerBaseUrl,
      apiKey: profile.apiKey,
      authType: profile.authType,
      extraHeaders: profile.extraHeaders,
    },
    modelRef: { profileId, modelId },
    binding,
  };
}

export function createTaskInvocationRouteSnapshot(
  operation: TaskInvocationOperation,
  routeModel?: ModelRef | string | null,
  options: {
    bindingId?: string | null;
    preferredRequestSchema?: string | readonly string[] | null;
  } = {}
): TaskInvocationRouteSnapshot {
  const plan = resolveInvocationPlanFromRoute(operation, routeModel, {
    bindingId: options.bindingId,
    preferredRequestSchema: options.preferredRequestSchema,
  });

  if (plan) {
    return createTaskInvocationRouteSnapshotFromPlan(operation, plan);
  }

  const route = resolveInvocationRoute(operation, routeModel);
  return {
    operation,
    modelRef: createModelRef(route.profileId, route.modelId),
    providerProfileId: route.profileId,
    providerType: route.providerType,
    providerBaseUrl: route.baseUrl,
    modelId: route.modelId,
    binding: null,
  };
}

export function createTaskInvocationRouteSnapshotFromPlan(
  operation: TaskInvocationOperation,
  plan: InvocationPlan
): TaskInvocationRouteSnapshot {
  if (plan.binding.operation !== operation) {
    throw new Error(
      `调用计划类型不匹配：binding=${plan.binding.operation}, route=${operation}`
    );
  }

  return {
    operation,
    modelRef: createModelRef(plan.modelRef.profileId, plan.modelRef.modelId),
    providerProfileId: plan.provider.profileId,
    providerType: plan.provider.providerType,
    providerBaseUrl: plan.provider.baseUrl,
    modelId: plan.modelRef.modelId,
    binding: snapshotBinding(plan.binding),
  };
}

function hasImageEditIntent(
  params: Task['params'],
  normalizedRequest?: NormalizedImageRequest
): boolean {
  return (
    resolveImageOperationIntent(
      normalizedRequest || normalizeImageRequest(params)
    ) === 'edit'
  );
}

export function createTaskInvocationRouteSnapshotFromTask(
  task: Pick<Task, 'type' | 'params'>,
  operation?: TaskInvocationOperation,
  normalizedImageRequest?: NormalizedImageRequest
): TaskInvocationRouteSnapshot | undefined {
  const routeOperation =
    operation ||
    (task.type === 'video'
      ? 'video'
      : task.type === 'audio'
      ? 'audio'
      : task.type === 'chat'
      ? 'text'
      : task.type === 'image'
      ? 'image'
      : undefined);

  if (!routeOperation) {
    return undefined;
  }

  return createTaskInvocationRouteSnapshot(
    routeOperation,
    task.params.modelRef || task.params.model || null,
    {
      preferredRequestSchema:
        routeOperation === 'image'
          ? hasImageEditIntent(task.params, normalizedImageRequest)
            ? GPT_IMAGE_EDIT_REQUEST_SCHEMAS
            : GPT_IMAGE_GENERATION_REQUEST_SCHEMAS
          : undefined,
    }
  );
}

export function resolveTaskInvocationRouteModel(
  task: Pick<Task, 'params' | 'invocationRoute'>
): ModelRef | string | null {
  const route = task.invocationRoute;
  if (route) {
    const profileId =
      normalizeString(route.modelRef?.profileId) ||
      normalizeString(route.providerProfileId);
    const modelId =
      normalizeString(route.modelRef?.modelId) ||
      normalizeString(route.modelId);
    const ref = createModelRef(profileId, modelId);
    if (ref) {
      return ref;
    }
  }

  return task.params.modelRef || task.params.model || null;
}

/**
 * Rehydrate a pending image task from its durable invocation snapshot.
 * The snapshot model and binding must win over stale UI params during recovery.
 */
export function resolveImageTaskGenerationParams(
  task: Pick<Task, 'params' | 'invocationRoute'>
): Task['params'] {
  const routeModel = resolveTaskInvocationRouteModel(task);
  const bindingId = task.invocationRoute?.binding?.id;

  if (!routeModel && !bindingId) {
    return task.params;
  }

  return {
    ...task.params,
    ...(typeof routeModel === 'string'
      ? { model: routeModel, modelRef: null }
      : routeModel
      ? { model: routeModel.modelId || task.params.model, modelRef: routeModel }
      : {}),
    ...(bindingId ? { bindingId } : {}),
  };
}

export function resolveLegacyTaskInvocationRouteModel(
  operation: TaskInvocationOperation,
  task: Pick<Task, 'params' | 'invocationRoute'>
): ModelRef | string | null {
  const routeModel = resolveTaskInvocationRouteModel(task);
  if (typeof routeModel !== 'string') {
    return routeModel;
  }

  const modelId = normalizeString(routeModel);
  if (!modelId) {
    return routeModel;
  }

  const directRoute = resolveInvocationRoute(operation, modelId);
  if (directRoute.profileId) {
    return createModelRef(directRoute.profileId, directRoute.modelId);
  }

  const matchingProfiles = providerProfilesSettings
    .get()
    .filter((profile) => profile.enabled && profile.baseUrl && profile.apiKey);

  for (const profile of matchingProfiles) {
    const candidate = createModelRef(profile.id, modelId);
    if (resolveInvocationPlanFromRoute(operation, candidate)) {
      return candidate;
    }
  }

  return routeModel;
}

export function shouldUseStrictTaskInvocationRoute(
  task: Pick<Task, 'invocationRoute'>
): boolean {
  return Boolean(task.invocationRoute?.providerProfileId);
}

export function assertTaskInvocationRouteAvailable(
  operation: TaskInvocationOperation,
  task: Pick<Task, 'invocationRoute'>
): void {
  const route = task.invocationRoute;
  if (!route?.providerProfileId) {
    return;
  }

  // A complete binding snapshot is the execution contract. Hydrating it also
  // validates the owning profile and credentials without consulting the
  // mutable catalog.
  if (isExecutableBindingSnapshot(route.binding)) {
    resolveTaskInvocationPlanFromSnapshot(operation, task);
    return;
  }

  if (operation === 'image') {
    // Provider-scoped image retries/recovery must never reconstruct a paid
    // execution contract from the mutable catalog or from a binding ID alone.
    resolveTaskInvocationPlanFromSnapshot(operation, task);
    return;
  }

  const profile = providerProfilesSettings
    .get()
    .find((item) => item.id === route.providerProfileId);

  if (!profile) {
    throw new Error('原供应商配置已删除，无法继续查询异步任务状态');
  }

  if (!profile.enabled) {
    throw new Error('原供应商配置已停用，无法继续查询异步任务状态');
  }

  if (!profile.apiKey?.trim()) {
    throw new Error('原供应商 API Key 未配置，无法继续查询异步任务状态');
  }

  if (!profile.baseUrl?.trim()) {
    throw new Error('原供应商 Base URL 未配置，无法继续查询异步任务状态');
  }

  const routeModel = toRouteModel(route.modelRef, route.modelId);
  const plan = resolveInvocationPlanFromRoute(operation, routeModel, {
    bindingId: route.binding?.id,
  });

  if (!plan) {
    throw new Error('原供应商模型绑定已不可用，无法继续查询异步任务状态');
  }
}

export function mergeTaskInvocationRoute(
  existing: TaskInvocationRouteSnapshot | undefined,
  next: TaskInvocationRouteSnapshot | undefined
): TaskInvocationRouteSnapshot | undefined {
  return next || existing;
}

export function isLegacyDefaultVideoBaseUrl(baseUrl?: string | null): boolean {
  const normalized = normalizeString(baseUrl);
  return !normalized || normalized === DEFAULT_BASE_URL;
}
