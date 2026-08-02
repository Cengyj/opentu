import {
  getCompatibleParams,
  type ParamConfig,
} from '../constants/model-config';
import type { ModelRef } from '../utils/settings-types';
import { modelPricingService } from '../utils/model-pricing-service';
import { runtimeModelDiscovery } from '../utils/runtime-model-discovery';
import {
  GPT_IMAGE_EDIT_REQUEST_SCHEMAS,
  GPT_IMAGE_GENERATION_REQUEST_SCHEMAS,
  resolveImageBindingCapabilities,
  type ImageBindingCapabilities,
  type ImageEnumCapability,
  type ImageOperationIntent,
  type ImageRangeCapability,
} from './image-invocation';
import { resolveInvocationPlanFromRoute } from './provider-routing';

const IMAGE_BINDING_CAPABILITY_CACHE_LIMIT = 128;

interface CachedImageBindingCapabilities {
  readonly capabilities: ImageBindingCapabilities;
}

const imageBindingCapabilityCache = new Map<
  string,
  CachedImageBindingCapabilities
>();
const imageBindingCapabilityRouteIndex = new Map<string, string>();

/**
 * Runtime catalogs/profile settings and pricing endpoint metadata are the two
 * mutable inputs used while constructing a binding. Keeping both revisions in
 * the cache identity prevents an old capability snapshot from surviving a
 * catalog, profile, or endpoint-metadata update.
 */
export function getImageBindingCapabilityRevision(): string {
  return `${runtimeModelDiscovery.getRevision()}:${modelPricingService.getVersion()}`;
}

export function subscribeImageBindingCapabilityRevision(
  listener: () => void
): () => void {
  const unsubscribeRuntime = runtimeModelDiscovery.subscribe(listener);
  const unsubscribePricing = modelPricingService.subscribe(listener);
  return () => {
    unsubscribeRuntime();
    unsubscribePricing();
  };
}

export function clearImageBindingParameterCapabilityCache(): void {
  imageBindingCapabilityCache.clear();
  imageBindingCapabilityRouteIndex.clear();
}

function touchCacheEntry(
  bindingCacheKey: string,
  entry: CachedImageBindingCapabilities
): void {
  imageBindingCapabilityCache.delete(bindingCacheKey);
  imageBindingCapabilityCache.set(bindingCacheKey, entry);
}

function deleteRoutesForBindingCacheKey(bindingCacheKey: string): void {
  for (const [
    routeKey,
    indexedBindingKey,
  ] of imageBindingCapabilityRouteIndex) {
    if (indexedBindingKey === bindingCacheKey) {
      imageBindingCapabilityRouteIndex.delete(routeKey);
    }
  }
}

function enforceImageBindingCapabilityCacheLimit(): void {
  while (
    imageBindingCapabilityCache.size > IMAGE_BINDING_CAPABILITY_CACHE_LIMIT
  ) {
    const oldestBindingCacheKey = imageBindingCapabilityCache.keys().next()
      .value as string | undefined;
    if (!oldestBindingCacheKey) {
      return;
    }
    imageBindingCapabilityCache.delete(oldestBindingCacheKey);
    deleteRoutesForBindingCacheKey(oldestBindingCacheKey);
  }
}

function buildCapabilityRouteKey(
  modelRef: ModelRef,
  intent: ImageOperationIntent,
  revision: string
): string {
  return JSON.stringify([
    revision,
    modelRef.profileId,
    modelRef.modelId,
    intent,
  ]);
}

function buildBindingCapabilityCacheKey(
  modelRef: ModelRef,
  intent: ImageOperationIntent,
  revision: string,
  binding: {
    readonly id: string;
    readonly profileId: string;
    readonly modelId: string;
    readonly protocol: string;
    readonly requestSchema: string;
    readonly responseSchema: string;
    readonly submitPath: string;
    readonly submitMethod: string;
    readonly pollPathTemplate?: string;
    readonly pollMethod?: string;
  }
): string {
  return JSON.stringify([
    revision,
    modelRef.profileId,
    modelRef.modelId,
    intent,
    binding.id,
    binding.profileId,
    binding.modelId,
    binding.protocol,
    binding.requestSchema,
    binding.responseSchema,
    binding.submitPath,
    binding.submitMethod,
    binding.pollPathTemplate || null,
    binding.pollMethod || null,
  ]);
}

function getCachedBindingCapabilities(
  routeKey: string
): ImageBindingCapabilities | null {
  const bindingCacheKey = imageBindingCapabilityRouteIndex.get(routeKey);
  if (!bindingCacheKey) {
    return null;
  }
  const entry = imageBindingCapabilityCache.get(bindingCacheKey);
  if (!entry) {
    imageBindingCapabilityRouteIndex.delete(routeKey);
    return null;
  }

  imageBindingCapabilityRouteIndex.delete(routeKey);
  imageBindingCapabilityRouteIndex.set(routeKey, bindingCacheKey);
  touchCacheEntry(bindingCacheKey, entry);
  return entry.capabilities;
}

function cacheBindingCapabilities(
  routeKey: string,
  bindingCacheKey: string,
  capabilities: ImageBindingCapabilities
): void {
  const previousBindingCacheKey =
    imageBindingCapabilityRouteIndex.get(routeKey);
  if (previousBindingCacheKey && previousBindingCacheKey !== bindingCacheKey) {
    deleteRoutesForBindingCacheKey(previousBindingCacheKey);
    imageBindingCapabilityCache.delete(previousBindingCacheKey);
  }
  const entry = { capabilities };
  touchCacheEntry(bindingCacheKey, entry);
  imageBindingCapabilityRouteIndex.delete(routeKey);
  imageBindingCapabilityRouteIndex.set(routeKey, bindingCacheKey);
  enforceImageBindingCapabilityCacheLimit();
}

function resolveCachedImageBindingCapabilities(
  modelRef: ModelRef,
  intent: ImageOperationIntent,
  revision: string
): ImageBindingCapabilities | null {
  const routeKey = buildCapabilityRouteKey(modelRef, intent, revision);
  const cached = getCachedBindingCapabilities(routeKey);
  if (cached) {
    return cached;
  }

  const plan = resolveInvocationPlanFromRoute('image', modelRef, {
    preferredRequestSchema:
      intent === 'edit'
        ? GPT_IMAGE_EDIT_REQUEST_SCHEMAS
        : GPT_IMAGE_GENERATION_REQUEST_SCHEMAS,
  });
  if (!plan) {
    return null;
  }

  const capabilities = resolveImageBindingCapabilities(plan.binding);
  const bindingCacheKey = buildBindingCapabilityCacheKey(
    modelRef,
    intent,
    revision,
    plan.binding
  );
  cacheBindingCapabilities(routeKey, bindingCacheKey, capabilities);
  return capabilities;
}

type BindingScopedParameterResolution = 'binding' | 'unresolved';

export interface BindingScopedImageParameterState {
  readonly resolution: BindingScopedParameterResolution;
  readonly compatibleParams: readonly ParamConfig[];
  readonly capabilities?: ImageBindingCapabilities;
  readonly bindingId?: string;
  readonly operationSupported?: boolean;
}

type CanonicalParameterCapability = ImageEnumCapability | ImageRangeCapability;

type EnumParameterField =
  | 'size'
  | 'aspectRatio'
  | 'resolution'
  | 'quality'
  | 'inputFidelity'
  | 'background'
  | 'outputFormat';
type RangeParameterField = 'outputCompression' | 'count';
type CanonicalParameterField = EnumParameterField | RangeParameterField;

interface CanonicalParameterTemplate {
  readonly field: CanonicalParameterField;
  readonly id: string;
  readonly label: string;
  readonly shortLabel: string;
  readonly description: string;
  readonly valueType: 'enum' | 'number';
}

const CANONICAL_PARAMETER_TEMPLATES: readonly CanonicalParameterTemplate[] =
  Object.freeze([
    {
      field: 'size',
      id: 'size',
      label: '图片尺寸',
      shortLabel: '尺寸',
      description: '选择当前接口明确支持的图片尺寸',
      valueType: 'enum',
    },
    {
      field: 'aspectRatio',
      id: 'aspectRatio',
      label: '图片宽高比',
      shortLabel: '宽高比',
      description: '选择当前接口明确支持的图片宽高比',
      valueType: 'enum',
    },
    {
      field: 'resolution',
      id: 'resolution',
      label: '图片分辨率',
      shortLabel: '分辨率',
      description: '选择当前接口明确支持的输出分辨率',
      valueType: 'enum',
    },
    {
      field: 'quality',
      id: 'quality',
      label: '图片质量',
      shortLabel: '质量',
      description: '选择当前接口明确支持的图片质量',
      valueType: 'enum',
    },
    {
      field: 'inputFidelity',
      id: 'inputFidelity',
      label: '输入保真度',
      shortLabel: '保真度',
      description: '选择当前接口明确支持的参考图保真度',
      valueType: 'enum',
    },
    {
      field: 'background',
      id: 'background',
      label: '图片背景',
      shortLabel: '背景',
      description: '选择当前接口明确支持的背景模式',
      valueType: 'enum',
    },
    {
      field: 'outputFormat',
      id: 'outputFormat',
      label: '输出格式',
      shortLabel: '格式',
      description: '选择当前接口明确支持的图片输出格式',
      valueType: 'enum',
    },
    {
      field: 'outputCompression',
      id: 'outputCompression',
      label: '输出压缩率',
      shortLabel: '压缩率',
      description: '设置当前接口明确支持的输出压缩率',
      valueType: 'number',
    },
    {
      field: 'count',
      id: 'count',
      label: '生成数量',
      shortLabel: '数量',
      description: '设置当前接口单次请求明确支持的图片数量',
      valueType: 'number',
    },
  ]);

const ENUM_PARAMETER_FIELDS: Readonly<Record<string, EnumParameterField>> =
  Object.freeze({
    size: 'size',
    aspectRatio: 'aspectRatio',
    aspect_ratio: 'aspectRatio',
    resolution: 'resolution',
    quality: 'quality',
    inputFidelity: 'inputFidelity',
    input_fidelity: 'inputFidelity',
    background: 'background',
    outputFormat: 'outputFormat',
    output_format: 'outputFormat',
  });

const RANGE_PARAMETER_FIELDS: Readonly<Record<string, RangeParameterField>> =
  Object.freeze({
    outputCompression: 'outputCompression',
    output_compression: 'outputCompression',
    compression: 'outputCompression',
    count: 'count',
    n: 'count',
  });

function normalizeEnumValue(value: string): string {
  const normalized = value.trim().toLowerCase().replace(/:/g, 'x');
  return normalized === 'jpg' ? 'jpeg' : normalized;
}

function getCanonicalCapability(
  paramId: string,
  capabilities: ImageBindingCapabilities
): CanonicalParameterCapability | undefined {
  const enumField = ENUM_PARAMETER_FIELDS[paramId];
  if (enumField) {
    return capabilities[enumField];
  }

  const rangeField = RANGE_PARAMETER_FIELDS[paramId];
  return rangeField ? capabilities[rangeField] : undefined;
}

function getCanonicalParameterField(
  paramId: string
): CanonicalParameterField | undefined {
  return ENUM_PARAMETER_FIELDS[paramId] || RANGE_PARAMETER_FIELDS[paramId];
}

function isCanonicalImageParameter(paramId: string): boolean {
  return getCanonicalParameterField(paramId) !== undefined;
}

function unresolvedImageParams(
  _compatibleParams: readonly ParamConfig[]
): readonly ParamConfig[] {
  return [];
}

function hasExplicitBindingMetadataEvidence(
  capabilities: ImageBindingCapabilities,
  field: CanonicalParameterField
): boolean {
  return capabilities.evidence[field] === 'binding-metadata';
}

function createEnumParameterFromCapability(
  template: CanonicalParameterTemplate,
  capability: ImageEnumCapability,
  modelId: string
): ParamConfig | null {
  if (
    template.valueType !== 'enum' ||
    !capability.supported ||
    !capability.values?.length
  ) {
    return null;
  }

  const seenValues = new Set<string>();
  const options = capability.values.flatMap((rawValue) => {
    const value = normalizeEnumValue(rawValue);
    if (!value || seenValues.has(value)) {
      return [];
    }
    seenValues.add(value);
    return [{ value, label: rawValue.trim() }];
  });
  if (options.length === 0) {
    return null;
  }

  return {
    id: template.id,
    label: template.label,
    shortLabel: template.shortLabel,
    description: template.description,
    valueType: 'enum',
    options,
    compatibleModels: [modelId],
    modelType: 'image',
  };
}

function createRangeParameterFromCapability(
  template: CanonicalParameterTemplate,
  capability: ImageRangeCapability,
  modelId: string
): ParamConfig | null {
  const min = capability.min;
  const max = capability.max;
  if (
    template.valueType !== 'number' ||
    !capability.supported ||
    !Number.isFinite(min) ||
    !Number.isFinite(max) ||
    (min as number) > (max as number) ||
    (template.field === 'count' && capability.integer !== true)
  ) {
    return null;
  }

  return {
    id: template.id,
    label: template.label,
    shortLabel: template.shortLabel,
    description: template.description,
    valueType: 'number',
    min,
    max,
    step: capability.integer ? 1 : undefined,
    integer: capability.integer,
    compatibleModels: [modelId],
    modelType: 'image',
  };
}

function mergeMaterializedBindingParams(
  compatibleParams: readonly ParamConfig[],
  capabilities: ImageBindingCapabilities
): readonly ParamConfig[] {
  const result: ParamConfig[] = [];
  const representedIds = new Set<string>();
  const representedFields = new Set<CanonicalParameterField>();

  compatibleParams.forEach((param) => {
    const field = getCanonicalParameterField(param.id);
    if (
      representedIds.has(param.id) ||
      (field !== undefined && representedFields.has(field))
    ) {
      return;
    }
    result.push(param);
    representedIds.add(param.id);
    if (field) {
      representedFields.add(field);
    }
  });

  CANONICAL_PARAMETER_TEMPLATES.forEach((template) => {
    if (
      representedFields.has(template.field) ||
      !hasExplicitBindingMetadataEvidence(capabilities, template.field)
    ) {
      return;
    }

    const capability = capabilities[template.field];
    if (!capability || typeof capability !== 'object') {
      return;
    }
    const param =
      template.valueType === 'enum'
        ? createEnumParameterFromCapability(
            template,
            capability as ImageEnumCapability,
            capabilities.modelId
          )
        : createRangeParameterFromCapability(
            template,
            capability as ImageRangeCapability,
            capabilities.modelId
          );
    if (!param || representedIds.has(param.id)) {
      return;
    }
    result.push(param);
    representedIds.add(param.id);
    representedFields.add(template.field);
  });

  return result;
}

function constrainEnumParam(
  param: ParamConfig,
  capability: ImageEnumCapability
): ParamConfig | null {
  if (!capability.supported) {
    return null;
  }
  if (!capability.values || param.valueType !== 'enum') {
    return param;
  }

  const supportedValues = new Set(
    capability.values.map((value) => normalizeEnumValue(value))
  );
  const options = (param.options || []).filter((option) =>
    supportedValues.has(normalizeEnumValue(option.value))
  );
  if (options.length === 0) {
    return null;
  }

  const defaultValue = options.some(
    (option) => option.value === param.defaultValue
  )
    ? param.defaultValue
    : options[0]?.value;
  return { ...param, options, defaultValue };
}

function constrainRangeParam(
  param: ParamConfig,
  capability: ImageRangeCapability
): ParamConfig | null {
  if (!capability.supported) {
    return null;
  }

  return {
    ...param,
    min: capability.min ?? param.min,
    max: capability.max ?? param.max,
    integer: capability.integer ?? param.integer,
  };
}

/**
 * Intersects the existing UI declaration with the selected binding contract.
 *
 * This function never creates a parameter from a model ID or model family.
 * Adapter-specific parameters are shown only when the selected request schema
 * owns a serializer contract for that exact key.
 */
export function filterImageParamsForBinding(
  compatibleParams: readonly ParamConfig[],
  capabilities: ImageBindingCapabilities,
  intent: ImageOperationIntent
): readonly ParamConfig[] {
  if (!capabilities.operations || !capabilities.operations.includes(intent)) {
    return [];
  }

  return compatibleParams.flatMap((param) => {
    if (!isCanonicalImageParameter(param.id)) {
      const capability = capabilities.providerParams[param.id];
      if (!capability) {
        return [];
      }
      if (param.valueType === 'enum' && capability.values) {
        const supportedValues = new Set(capability.values);
        const options = (param.options || []).filter((option) =>
          supportedValues.has(option.value.trim().toLowerCase())
        );
        return options.length > 0
          ? [
              {
                ...param,
                options,
                defaultValue: options.some(
                  (option) => option.value === param.defaultValue
                )
                  ? param.defaultValue
                  : options[0]?.value,
              },
            ]
          : [];
      }
      if (param.valueType === 'number') {
        return [
          {
            ...param,
            min: capability.min ?? param.min,
            max: capability.max ?? param.max,
            integer: capability.integer ?? param.integer,
          },
        ];
      }
      return [param];
    }

    const capability = getCanonicalCapability(param.id, capabilities);
    if (!capability) {
      // An unknown canonical capability is not proof that the field is safe.
      return [];
    }

    const constrained =
      'values' in capability || ENUM_PARAMETER_FIELDS[param.id] !== undefined
        ? constrainEnumParam(param, capability as ImageEnumCapability)
        : constrainRangeParam(param, capability as ImageRangeCapability);
    return constrained ? [constrained] : [];
  });
}

export function pruneSelectedImageParams(
  selectedParams: Readonly<Record<string, string>>,
  compatibleParams: readonly ParamConfig[]
): Record<string, string> {
  const compatibleById = new Map(
    compatibleParams.map((param) => [param.id, param])
  );
  const next: Record<string, string> = {};

  Object.entries(selectedParams).forEach(([paramId, value]) => {
    const param = compatibleById.get(paramId);
    if (!param) {
      return;
    }
    if (
      param.valueType === 'enum' &&
      !param.options?.some((option) => option.value === value)
    ) {
      return;
    }
    if (param.valueType === 'number') {
      const numericValue = Number(value);
      if (
        !Number.isFinite(numericValue) ||
        (param.min !== undefined && numericValue < param.min) ||
        (param.max !== undefined && numericValue > param.max) ||
        (param.integer && !Number.isInteger(numericValue))
      ) {
        return;
      }
    }
    next[paramId] = value;
  });

  return next;
}

export function areImageParamSelectionsEqual(
  left: Readonly<Record<string, string>>,
  right: Readonly<Record<string, string>>
): boolean {
  const leftKeys = Object.keys(left);
  const rightKeys = Object.keys(right);
  return (
    leftKeys.length === rightKeys.length &&
    leftKeys.every((key) => left[key] === right[key])
  );
}

/**
 * Resolves presentation capabilities from the exact provider-backed model.
 * Missing plans, planning errors, and unknown schemas expose no inferred
 * canonical parameters.
 */
export function resolveBindingScopedImageParameters(
  modelRef: ModelRef,
  intent: ImageOperationIntent,
  compatibleParams: readonly ParamConfig[],
  capabilityRevision = getImageBindingCapabilityRevision()
): BindingScopedImageParameterState {
  try {
    const capabilities = resolveCachedImageBindingCapabilities(
      modelRef,
      intent,
      capabilityRevision
    );
    if (!capabilities) {
      return {
        resolution: 'unresolved',
        compatibleParams: unresolvedImageParams(compatibleParams),
      };
    }

    const operationSupported =
      capabilities.operations?.includes(intent) === true;
    const filteredParams = filterImageParamsForBinding(
      compatibleParams,
      capabilities,
      intent
    );
    return {
      resolution: 'binding',
      compatibleParams: operationSupported
        ? mergeMaterializedBindingParams(filteredParams, capabilities)
        : filteredParams,
      capabilities,
      bindingId: capabilities.bindingId,
      operationSupported,
    };
  } catch {
    return {
      resolution: 'unresolved',
      compatibleParams: unresolvedImageParams(compatibleParams),
    };
  }
}

/**
 * Shared UI boundary for every provider-backed image selection. A missing or
 * mismatched ModelRef is unresolved rather than falling back to bare-model
 * canonical parameters.
 */
export function resolveImageParametersForSelection(
  modelId: string,
  modelRef: ModelRef | null | undefined,
  intent: ImageOperationIntent,
  capabilityRevision = getImageBindingCapabilityRevision()
): BindingScopedImageParameterState {
  const compatibleParams = getCompatibleParams(modelId);
  if (
    !modelRef?.profileId ||
    !modelRef.modelId ||
    modelRef.modelId !== modelId
  ) {
    return {
      resolution: 'unresolved',
      compatibleParams: unresolvedImageParams(compatibleParams),
    };
  }
  return resolveBindingScopedImageParameters(
    modelRef,
    intent,
    compatibleParams,
    capabilityRevision
  );
}

export function isImageBindingParameterSupported(
  state: BindingScopedImageParameterState,
  parameter: 'size' | 'aspectRatio'
): boolean {
  if (state.resolution !== 'binding') {
    return false;
  }
  if (!state.operationSupported) {
    return false;
  }
  return state.capabilities?.[parameter]?.supported === true;
}
