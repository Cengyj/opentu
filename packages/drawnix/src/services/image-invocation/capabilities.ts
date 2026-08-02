import { ImageInvocationError } from './errors';
import type {
  ImageBindingCapabilities,
  ImageCapabilityBinding,
  ImageCapabilityEvidence,
  ImageCapabilityParameter,
  ImageCapabilityValidationIssue,
  ImageEnumCapability,
  ImageOperationIntent,
  ImageProviderParameterCapability,
  ImageRangeCapability,
  ImageReferenceCapability,
  NormalizedImageRequest,
} from './types';

type UnknownRecord = Record<string, unknown>;
type CapabilityValues = Omit<
  ImageBindingCapabilities,
  | 'bindingId'
  | 'profileId'
  | 'modelId'
  | 'requestSchema'
  | 'source'
  | 'evidence'
>;
type MutableCapabilityValues = {
  -readonly [Field in keyof CapabilityValues]: CapabilityValues[Field];
};
type EnumCapabilityField =
  | 'size'
  | 'aspectRatio'
  | 'resolution'
  | 'quality'
  | 'inputFidelity'
  | 'background'
  | 'outputFormat';

const RESOLUTION_VALUES = Object.freeze(['1k', '2k', '4k']);
const GPT_QUALITY_VALUES = Object.freeze(['auto', 'low', 'medium', 'high']);
const GPT_BACKGROUND_VALUES = Object.freeze(['auto', 'transparent', 'opaque']);
const IMAGE_OUTPUT_FORMAT_VALUES = Object.freeze(['png', 'jpeg', 'webp']);
const INPUT_FIDELITY_VALUES = Object.freeze(['low', 'high']);

function enumCapability(
  supported: boolean,
  values?: readonly string[]
): ImageEnumCapability {
  return Object.freeze({
    supported,
    ...(values ? { values: Object.freeze([...values]) } : {}),
  });
}

function rangeCapability(
  supported: boolean,
  options: Omit<ImageRangeCapability, 'supported'> = {}
): ImageRangeCapability {
  return Object.freeze({ supported, ...options });
}

function referenceCapability(
  supported: boolean,
  options: Omit<ImageReferenceCapability, 'supported'> = {}
): ImageReferenceCapability {
  return Object.freeze({ supported, ...options });
}

function freezeCapabilityValues(values: CapabilityValues): CapabilityValues {
  return Object.freeze({
    ...values,
    operations: values.operations
      ? Object.freeze([...values.operations])
      : undefined,
    referenceImages: values.referenceImages
      ? Object.freeze({ ...values.referenceImages })
      : undefined,
    size: values.size
      ? enumCapability(values.size.supported, values.size.values)
      : undefined,
    aspectRatio: values.aspectRatio
      ? enumCapability(values.aspectRatio.supported, values.aspectRatio.values)
      : undefined,
    resolution: values.resolution
      ? enumCapability(values.resolution.supported, values.resolution.values)
      : undefined,
    quality: values.quality
      ? enumCapability(values.quality.supported, values.quality.values)
      : undefined,
    inputFidelity: values.inputFidelity
      ? enumCapability(
          values.inputFidelity.supported,
          values.inputFidelity.values
        )
      : undefined,
    background: values.background
      ? enumCapability(values.background.supported, values.background.values)
      : undefined,
    outputFormat: values.outputFormat
      ? enumCapability(
          values.outputFormat.supported,
          values.outputFormat.values
        )
      : undefined,
    outputCompression: values.outputCompression
      ? Object.freeze({ ...values.outputCompression })
      : undefined,
    count: values.count ? Object.freeze({ ...values.count }) : undefined,
    providerParams: Object.freeze(
      Object.fromEntries(
        Object.entries(values.providerParams).map(([key, capability]) => [
          key,
          Object.freeze({
            ...capability,
            ...(capability.values
              ? { values: Object.freeze([...capability.values]) }
              : {}),
          }),
        ])
      )
    ),
  });
}

function providerParameter(
  valueType: ImageProviderParameterCapability['valueType'],
  options: Omit<ImageProviderParameterCapability, 'valueType'> = {}
): ImageProviderParameterCapability {
  return Object.freeze({ valueType, ...options });
}

const NO_PROVIDER_PARAMS = Object.freeze({});
const MJ_PROVIDER_PARAMS = Object.freeze({
  mj_ar: providerParameter('string-or-number'),
  mj_v: providerParameter('string-or-number'),
  mj_style: providerParameter('string-or-number'),
  mj_s: providerParameter('string-or-number'),
  mj_q: providerParameter('string-or-number'),
  mj_seed: providerParameter('string-or-number'),
});
const SEEDREAM_PROVIDER_PARAMS = Object.freeze({
  seedream_quality: providerParameter('string', {
    values: Object.freeze(['2k', '3k', '4k']),
  }),
});

const SCHEMA_CAPABILITIES: Readonly<Record<string, CapabilityValues>> =
  Object.freeze({
    'openai.image.gpt-generation-json': freezeCapabilityValues({
      operations: ['generation'],
      referenceImages: referenceCapability(false),
      maskImage: false,
      size: enumCapability(true),
      aspectRatio: enumCapability(true),
      resolution: enumCapability(true, RESOLUTION_VALUES),
      quality: enumCapability(true, GPT_QUALITY_VALUES),
      inputFidelity: enumCapability(false),
      background: enumCapability(true, GPT_BACKGROUND_VALUES),
      outputFormat: enumCapability(true, IMAGE_OUTPUT_FORMAT_VALUES),
      outputCompression: rangeCapability(true, { min: 0, max: 100 }),
      count: rangeCapability(true, { min: 1, max: 10, integer: true }),
      providerParams: NO_PROVIDER_PARAMS,
    }),
    'openai.image.gpt-edit-form': freezeCapabilityValues({
      operations: ['edit'],
      referenceImages: referenceCapability(true, {
        minCount: 1,
        maxCount: 16,
      }),
      maskImage: true,
      size: enumCapability(true),
      aspectRatio: enumCapability(true),
      resolution: enumCapability(true, RESOLUTION_VALUES),
      quality: enumCapability(true, GPT_QUALITY_VALUES),
      inputFidelity: enumCapability(true, INPUT_FIDELITY_VALUES),
      background: enumCapability(true, GPT_BACKGROUND_VALUES),
      outputFormat: enumCapability(true, IMAGE_OUTPUT_FORMAT_VALUES),
      outputCompression: rangeCapability(true, { min: 0, max: 100 }),
      count: rangeCapability(true, { min: 1, max: 10, integer: true }),
      providerParams: NO_PROVIDER_PARAMS,
    }),
    'openai.image.basic-json': freezeCapabilityValues({
      operations: ['generation', 'edit'],
      referenceImages: referenceCapability(true),
      maskImage: false,
      size: enumCapability(true),
      aspectRatio: enumCapability(true),
      resolution: enumCapability(true, RESOLUTION_VALUES),
      quality: enumCapability(true, RESOLUTION_VALUES),
      inputFidelity: enumCapability(false),
      background: enumCapability(false),
      outputFormat: enumCapability(false),
      outputCompression: rangeCapability(false),
      count: rangeCapability(true, { min: 1, max: 10, integer: true }),
      providerParams: NO_PROVIDER_PARAMS,
    }),
    'google.generate-content.image-inline': freezeCapabilityValues({
      operations: ['generation', 'edit'],
      referenceImages: referenceCapability(true),
      maskImage: false,
      size: enumCapability(true),
      aspectRatio: enumCapability(true),
      resolution: enumCapability(true, RESOLUTION_VALUES),
      quality: enumCapability(true, RESOLUTION_VALUES),
      inputFidelity: enumCapability(false),
      background: enumCapability(false),
      outputFormat: enumCapability(false),
      outputCompression: rangeCapability(false),
      count: rangeCapability(false),
      providerParams: NO_PROVIDER_PARAMS,
    }),
    'openai.async.image.form': freezeCapabilityValues({
      operations: ['generation', 'edit'],
      referenceImages: referenceCapability(true),
      maskImage: true,
      size: enumCapability(true),
      aspectRatio: enumCapability(true),
      resolution: enumCapability(false),
      quality: enumCapability(false),
      inputFidelity: enumCapability(false),
      background: enumCapability(false),
      outputFormat: enumCapability(false),
      outputCompression: rangeCapability(false),
      count: rangeCapability(false),
      providerParams: NO_PROVIDER_PARAMS,
    }),
    'openai.image.seedream-json': freezeCapabilityValues({
      operations: ['generation', 'edit'],
      referenceImages: referenceCapability(true),
      maskImage: false,
      size: enumCapability(true),
      aspectRatio: enumCapability(true),
      resolution: enumCapability(false),
      quality: enumCapability(false),
      inputFidelity: enumCapability(false),
      background: enumCapability(false),
      outputFormat: enumCapability(false),
      outputCompression: rangeCapability(false),
      count: rangeCapability(false),
      providerParams: SEEDREAM_PROVIDER_PARAMS,
    }),
    'flux.image.polling-json': freezeCapabilityValues({
      operations: ['generation', 'edit'],
      referenceImages: referenceCapability(true, { maxCount: 8 }),
      maskImage: false,
      size: enumCapability(true),
      aspectRatio: enumCapability(true),
      resolution: enumCapability(false),
      quality: enumCapability(false),
      inputFidelity: enumCapability(false),
      background: enumCapability(false),
      outputFormat: enumCapability(false),
      outputCompression: rangeCapability(false),
      count: rangeCapability(false),
      providerParams: NO_PROVIDER_PARAMS,
    }),
    'mj.imagine.base64-array': freezeCapabilityValues({
      operations: ['generation', 'edit'],
      referenceImages: referenceCapability(true),
      maskImage: false,
      size: enumCapability(false),
      aspectRatio: enumCapability(false),
      resolution: enumCapability(false),
      quality: enumCapability(false),
      inputFidelity: enumCapability(false),
      background: enumCapability(false),
      outputFormat: enumCapability(false),
      outputCompression: rangeCapability(false),
      count: rangeCapability(false),
      providerParams: MJ_PROVIDER_PARAMS,
    }),
  });

function isRecord(value: unknown): value is UnknownRecord {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function hasOwn(record: UnknownRecord, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(record, key);
}

function invalidMetadata(
  binding: ImageCapabilityBinding,
  field: string
): never {
  throw new ImageInvocationError(
    'IMAGE_CAPABILITY_METADATA_INVALID',
    `图片 binding 能力元数据 ${field} 格式无效`,
    {
      stage: 'capability-validation',
      details: {
        bindingId: binding.id,
        profileId: binding.profileId,
        modelId: binding.modelId,
        field,
      },
    }
  );
}

function normalizeEnumValue(
  parameter: ImageCapabilityParameter,
  value: string
): string {
  const trimmed = value.trim().toLowerCase().replace(/\s+/g, '');
  if (parameter === 'size') {
    return trimmed.replace(/^(\d+(?:\.\d+)?):(\d+(?:\.\d+)?)$/, '$1x$2');
  }
  if (parameter === 'aspectRatio') {
    return trimmed.replace(/^(\d+(?:\.\d+)?)[x:](\d+(?:\.\d+)?)$/, '$1:$2');
  }
  if (parameter === 'outputFormat' && trimmed === 'jpg') {
    return 'jpeg';
  }
  return trimmed;
}

function parseOperations(
  binding: ImageCapabilityBinding,
  value: unknown,
  field: string
): readonly ImageOperationIntent[] {
  if (!Array.isArray(value)) {
    invalidMetadata(binding, field);
  }
  const result: ImageOperationIntent[] = [];
  for (const operation of value) {
    if (operation !== 'generation' && operation !== 'edit') {
      invalidMetadata(binding, field);
    }
    if (!result.includes(operation)) {
      result.push(operation);
    }
  }
  return Object.freeze(result);
}

function parseEnumCapability(
  binding: ImageCapabilityBinding,
  parameter: ImageCapabilityParameter,
  value: unknown,
  field: string
): ImageEnumCapability {
  if (typeof value === 'boolean') {
    return enumCapability(value);
  }
  if (!Array.isArray(value)) {
    invalidMetadata(binding, field);
  }

  const values: string[] = [];
  for (const item of value) {
    if (typeof item !== 'string' || !item.trim()) {
      invalidMetadata(binding, field);
    }
    const normalized = normalizeEnumValue(parameter, item);
    if (!values.includes(normalized)) {
      values.push(normalized);
    }
  }
  return enumCapability(true, values);
}

function readNonNegativeInteger(
  binding: ImageCapabilityBinding,
  value: unknown,
  field: string
): number | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 0) {
    invalidMetadata(binding, field);
  }
  return value;
}

function readFiniteNumber(
  binding: ImageCapabilityBinding,
  value: unknown,
  field: string
): number | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    invalidMetadata(binding, field);
  }
  return value;
}

function parseReferenceCapability(
  binding: ImageCapabilityBinding,
  value: unknown,
  field: string
): ImageReferenceCapability {
  if (typeof value === 'boolean') {
    return referenceCapability(value);
  }
  if (!isRecord(value)) {
    invalidMetadata(binding, field);
  }

  const minCount = readNonNegativeInteger(
    binding,
    value.minCount,
    `${field}.minCount`
  );
  const maxCount = readNonNegativeInteger(
    binding,
    value.maxCount,
    `${field}.maxCount`
  );
  if (minCount !== undefined && maxCount !== undefined && minCount > maxCount) {
    invalidMetadata(binding, field);
  }
  return referenceCapability(true, { minCount, maxCount });
}

function parseRangeCapability(
  binding: ImageCapabilityBinding,
  value: unknown,
  field: string,
  allowInteger: boolean
): ImageRangeCapability {
  if (typeof value === 'boolean') {
    return rangeCapability(value);
  }
  if (!isRecord(value)) {
    invalidMetadata(binding, field);
  }

  const min = readFiniteNumber(binding, value.min, `${field}.min`);
  const max = readFiniteNumber(binding, value.max, `${field}.max`);
  if (min !== undefined && max !== undefined && min > max) {
    invalidMetadata(binding, field);
  }
  if (value.integer !== undefined && typeof value.integer !== 'boolean') {
    invalidMetadata(binding, `${field}.integer`);
  }
  return rangeCapability(true, {
    min,
    max,
    integer: allowInteger ? value.integer === true : undefined,
  });
}

function getExplicitValue(
  image: UnknownRecord,
  nested: UnknownRecord | null,
  field: string
): { value: unknown; field: string } | undefined {
  if (nested && hasOwn(nested, field)) {
    return { value: nested[field], field: `image.capabilities.${field}` };
  }
  if (hasOwn(image, field)) {
    return { value: image[field], field: `image.${field}` };
  }
  return undefined;
}

function applyExplicitMetadata(
  binding: ImageCapabilityBinding,
  fallback: CapabilityValues,
  evidence: Partial<Record<ImageCapabilityParameter, ImageCapabilityEvidence>>
): { values: CapabilityValues; hasMetadata: boolean } {
  const rawImage = binding.metadata?.image;
  if (rawImage === undefined) {
    return { values: fallback, hasMetadata: false };
  }
  if (!isRecord(rawImage)) {
    invalidMetadata(binding, 'image');
  }
  const nestedValue = rawImage.capabilities;
  if (
    nestedValue !== undefined &&
    nestedValue !== null &&
    !isRecord(nestedValue)
  ) {
    invalidMetadata(binding, 'image.capabilities');
  }
  const nested = isRecord(nestedValue) ? nestedValue : null;
  const result: MutableCapabilityValues = { ...fallback };
  let hasMetadata = false;

  const operations = getExplicitValue(rawImage, nested, 'operations');
  const action = hasOwn(rawImage, 'action') ? rawImage.action : undefined;
  if (operations) {
    result.operations = parseOperations(
      binding,
      operations.value,
      operations.field
    );
    evidence.operation = 'binding-metadata';
    hasMetadata = true;
  }
  if (action !== undefined) {
    if (action !== 'generation' && action !== 'edit') {
      invalidMetadata(binding, 'image.action');
    }
    if (
      result.operations &&
      operations &&
      !result.operations.includes(action)
    ) {
      invalidMetadata(binding, 'image.action');
    }
    if (!operations) {
      result.operations = Object.freeze([action]);
      evidence.operation = 'binding-metadata';
    }
    hasMetadata = true;
  }

  const referenceImages = getExplicitValue(rawImage, nested, 'referenceImages');
  if (referenceImages) {
    result.referenceImages = parseReferenceCapability(
      binding,
      referenceImages.value,
      referenceImages.field
    );
    evidence.referenceImages = 'binding-metadata';
    hasMetadata = true;
  }

  const legacyMaxImageCount = hasOwn(rawImage, 'maxImageCount')
    ? readNonNegativeInteger(
        binding,
        rawImage.maxImageCount,
        'image.maxImageCount'
      )
    : undefined;
  if (legacyMaxImageCount !== undefined) {
    const current = result.referenceImages;
    if (current?.supported === false) {
      invalidMetadata(binding, 'image.maxImageCount');
    }
    result.referenceImages = referenceCapability(true, {
      minCount: current?.minCount,
      maxCount: legacyMaxImageCount,
    });
    evidence.referenceImages = 'binding-metadata';
    hasMetadata = true;
  }

  const maskImage = getExplicitValue(rawImage, nested, 'maskImage');
  const legacySupportsMask = hasOwn(rawImage, 'supportsMask')
    ? rawImage.supportsMask
    : undefined;
  if (maskImage) {
    if (typeof maskImage.value !== 'boolean') {
      invalidMetadata(binding, maskImage.field);
    }
    result.maskImage = maskImage.value;
    evidence.maskImage = 'binding-metadata';
    hasMetadata = true;
  }
  if (legacySupportsMask !== undefined) {
    if (typeof legacySupportsMask !== 'boolean') {
      invalidMetadata(binding, 'image.supportsMask');
    }
    if (maskImage && result.maskImage !== legacySupportsMask) {
      invalidMetadata(binding, 'image.supportsMask');
    }
    result.maskImage = legacySupportsMask;
    evidence.maskImage = 'binding-metadata';
    hasMetadata = true;
  }

  const enumFields: ReadonlyArray<
    readonly [
      Exclude<
        ImageCapabilityParameter,
        | 'operation'
        | 'referenceImages'
        | 'maskImage'
        | 'outputCompression'
        | 'count'
      >,
      EnumCapabilityField
    ]
  > = [
    ['size', 'size'],
    ['aspectRatio', 'aspectRatio'],
    ['resolution', 'resolution'],
    ['quality', 'quality'],
    ['inputFidelity', 'inputFidelity'],
    ['background', 'background'],
    ['outputFormat', 'outputFormat'],
  ];
  for (const [parameter, field] of enumFields) {
    const explicit = getExplicitValue(rawImage, nested, field);
    if (!explicit) {
      continue;
    }
    result[field] = parseEnumCapability(
      binding,
      parameter,
      explicit.value,
      explicit.field
    );
    evidence[parameter] = 'binding-metadata';
    hasMetadata = true;
  }

  const outputCompression = getExplicitValue(
    rawImage,
    nested,
    'outputCompression'
  );
  if (outputCompression) {
    result.outputCompression = parseRangeCapability(
      binding,
      outputCompression.value,
      outputCompression.field,
      false
    );
    evidence.outputCompression = 'binding-metadata';
    hasMetadata = true;
  }

  const count = getExplicitValue(rawImage, nested, 'count');
  if (count) {
    result.count = parseRangeCapability(
      binding,
      count.value,
      count.field,
      true
    );
    evidence.count = 'binding-metadata';
    hasMetadata = true;
  }

  return { values: freezeCapabilityValues(result), hasMetadata };
}

function createSchemaEvidence(
  values: CapabilityValues
): Partial<Record<ImageCapabilityParameter, ImageCapabilityEvidence>> {
  const evidence: Partial<
    Record<ImageCapabilityParameter, ImageCapabilityEvidence>
  > = {};
  const fields: ReadonlyArray<
    readonly [keyof CapabilityValues, ImageCapabilityParameter]
  > = [
    ['operations', 'operation'],
    ['referenceImages', 'referenceImages'],
    ['maskImage', 'maskImage'],
    ['size', 'size'],
    ['aspectRatio', 'aspectRatio'],
    ['resolution', 'resolution'],
    ['quality', 'quality'],
    ['inputFidelity', 'inputFidelity'],
    ['background', 'background'],
    ['outputFormat', 'outputFormat'],
    ['outputCompression', 'outputCompression'],
    ['count', 'count'],
  ];
  for (const [field, parameter] of fields) {
    if (values[field] !== undefined) {
      evidence[parameter] = 'request-schema';
    }
  }
  return evidence;
}

export function resolveImageBindingCapabilities(
  binding: ImageCapabilityBinding
): ImageBindingCapabilities {
  const schemaFallback = SCHEMA_CAPABILITIES[binding.requestSchema] || {
    providerParams: NO_PROVIDER_PARAMS,
  };
  const evidence = createSchemaEvidence(schemaFallback);
  const { values, hasMetadata } = applyExplicitMetadata(
    binding,
    schemaFallback,
    evidence
  );
  const evidenceSources = new Set(Object.values(evidence));
  const source =
    evidenceSources.size === 0
      ? 'unknown'
      : evidenceSources.size > 1
      ? 'mixed'
      : hasMetadata
      ? 'binding-metadata'
      : 'request-schema';

  return Object.freeze({
    bindingId: binding.id,
    profileId: binding.profileId,
    modelId: binding.modelId,
    requestSchema: binding.requestSchema,
    source,
    evidence: Object.freeze({ ...evidence }),
    ...values,
  });
}

function issue(
  parameter: ImageCapabilityParameter,
  reason: ImageCapabilityValidationIssue['reason'],
  message: string
): ImageCapabilityValidationIssue {
  return Object.freeze({ parameter, reason, message });
}

function validateEnumParameter(
  issues: ImageCapabilityValidationIssue[],
  parameter: Exclude<
    ImageCapabilityParameter,
    | 'operation'
    | 'referenceImages'
    | 'maskImage'
    | 'outputCompression'
    | 'count'
  >,
  value: string | undefined,
  capability: ImageEnumCapability | undefined
): void {
  if (value === undefined) {
    return;
  }
  if (!capability) {
    issues.push(
      issue(parameter, 'unknown', `当前 binding 未声明 ${parameter} 能力`)
    );
    return;
  }
  if (!capability.supported) {
    issues.push(
      issue(parameter, 'unsupported', `当前 binding 不支持 ${parameter}`)
    );
    return;
  }
  const normalized = normalizeEnumValue(parameter, value);
  if (capability.values && !capability.values.includes(normalized)) {
    issues.push(
      issue(
        parameter,
        'invalid-value',
        `当前 binding 不支持所选 ${parameter} 值`
      )
    );
  }
}

function validateRangeParameter(
  issues: ImageCapabilityValidationIssue[],
  parameter: 'outputCompression' | 'count',
  value: number | undefined,
  capability: ImageRangeCapability | undefined
): void {
  if (value === undefined) {
    return;
  }
  if (!capability) {
    issues.push(
      issue(parameter, 'unknown', `当前 binding 未声明 ${parameter} 能力`)
    );
    return;
  }
  if (!capability.supported) {
    issues.push(
      issue(parameter, 'unsupported', `当前 binding 不支持 ${parameter}`)
    );
    return;
  }
  if (capability.integer && !Number.isInteger(value)) {
    issues.push(issue(parameter, 'invalid-value', `${parameter} 必须是整数`));
  } else if (capability.min !== undefined && value < capability.min) {
    issues.push(
      issue(parameter, 'below-minimum', `${parameter} 低于 binding 最小值`)
    );
  } else if (capability.max !== undefined && value > capability.max) {
    issues.push(
      issue(parameter, 'above-maximum', `${parameter} 超出 binding 最大值`)
    );
  }
}

function validateProviderParameters(
  issues: ImageCapabilityValidationIssue[],
  params: Readonly<Record<string, unknown>>,
  capabilities: ImageBindingCapabilities['providerParams']
): void {
  for (const [key, rawValue] of Object.entries(params)) {
    const parameter = `params.${key}` as const;
    const capability = capabilities[key];
    if (!capability) {
      issues.push(
        issue(
          parameter,
          'unsupported',
          `当前 binding 不支持供应商图片参数 ${key}`
        )
      );
      continue;
    }

    const isString = typeof rawValue === 'string' && rawValue.trim().length > 0;
    const isNumber = typeof rawValue === 'number' && Number.isFinite(rawValue);
    const typeValid =
      (capability.valueType === 'string' && isString) ||
      (capability.valueType === 'number' && isNumber) ||
      (capability.valueType === 'string-or-number' && (isString || isNumber));
    if (!typeValid) {
      issues.push(
        issue(parameter, 'invalid-value', `供应商图片参数 ${key} 的值格式无效`)
      );
      continue;
    }

    const serializedValue = String(rawValue);
    if (capability.values && !capability.values.includes(serializedValue)) {
      issues.push(
        issue(
          parameter,
          'invalid-value',
          `当前 binding 不支持供应商图片参数 ${key} 的所选值`
        )
      );
      continue;
    }

    if (isNumber) {
      if (capability.integer && !Number.isInteger(rawValue)) {
        issues.push(
          issue(parameter, 'invalid-value', `供应商图片参数 ${key} 必须是整数`)
        );
      } else if (capability.min !== undefined && rawValue < capability.min) {
        issues.push(
          issue(parameter, 'below-minimum', `供应商图片参数 ${key} 低于最小值`)
        );
      } else if (capability.max !== undefined && rawValue > capability.max) {
        issues.push(
          issue(parameter, 'above-maximum', `供应商图片参数 ${key} 超出最大值`)
        );
      }
    }
  }
}

export function validateImageRequestCapabilities(
  request: NormalizedImageRequest,
  intent: ImageOperationIntent,
  capabilities: ImageBindingCapabilities
): readonly ImageCapabilityValidationIssue[] {
  const issues: ImageCapabilityValidationIssue[] = [];

  if (!capabilities.operations) {
    issues.push(
      issue('operation', 'unknown', '当前 binding 未声明图片操作能力')
    );
  } else if (!capabilities.operations.includes(intent)) {
    issues.push(
      issue('operation', 'unsupported', `当前 binding 不支持 ${intent} 操作`)
    );
  }

  const referenceCount = request.referenceImages.length;
  if (referenceCount > 0) {
    const referenceCapability = capabilities.referenceImages;
    if (!referenceCapability) {
      issues.push(
        issue('referenceImages', 'unknown', '当前 binding 未声明参考图能力')
      );
    } else if (!referenceCapability.supported) {
      issues.push(
        issue('referenceImages', 'unsupported', '当前 binding 不支持参考图')
      );
    } else if (
      referenceCapability.maxCount !== undefined &&
      referenceCount > referenceCapability.maxCount
    ) {
      issues.push(
        issue('referenceImages', 'above-maximum', '参考图数量超出 binding 上限')
      );
    }
  }

  const minimumReferenceCount = capabilities.referenceImages?.minCount;
  if (
    intent === 'edit' &&
    capabilities.referenceImages?.supported &&
    minimumReferenceCount !== undefined &&
    referenceCount < minimumReferenceCount
  ) {
    issues.push(
      issue(
        'referenceImages',
        'below-minimum',
        '编辑请求缺少 binding 要求的参考图'
      )
    );
  }

  if (request.maskImage) {
    if (capabilities.maskImage === undefined) {
      issues.push(issue('maskImage', 'unknown', '当前 binding 未声明蒙版能力'));
    } else if (!capabilities.maskImage) {
      issues.push(issue('maskImage', 'unsupported', '当前 binding 不支持蒙版'));
    }
  }

  validateEnumParameter(issues, 'size', request.size, capabilities.size);
  validateEnumParameter(
    issues,
    'aspectRatio',
    request.aspectRatio,
    capabilities.aspectRatio
  );
  validateEnumParameter(
    issues,
    'resolution',
    request.resolution,
    capabilities.resolution
  );
  validateEnumParameter(
    issues,
    'quality',
    request.quality,
    capabilities.quality
  );
  validateEnumParameter(
    issues,
    'inputFidelity',
    request.inputFidelity,
    capabilities.inputFidelity
  );
  validateEnumParameter(
    issues,
    'background',
    request.background,
    capabilities.background
  );
  validateEnumParameter(
    issues,
    'outputFormat',
    request.outputFormat,
    capabilities.outputFormat
  );
  validateRangeParameter(
    issues,
    'outputCompression',
    request.outputCompression,
    capabilities.outputCompression
  );
  validateRangeParameter(issues, 'count', request.count, capabilities.count);
  validateProviderParameters(
    issues,
    request.params,
    capabilities.providerParams
  );

  return Object.freeze(issues);
}

export function assertImageRequestCapabilities(
  request: NormalizedImageRequest,
  intent: ImageOperationIntent,
  capabilities: ImageBindingCapabilities
): void {
  const issues = validateImageRequestCapabilities(
    request,
    intent,
    capabilities
  );
  const first = issues[0];
  if (!first) {
    return;
  }

  throw new ImageInvocationError('IMAGE_PARAMETER_UNSUPPORTED', first.message, {
    stage: 'capability-validation',
    details: {
      bindingId: capabilities.bindingId,
      profileId: capabilities.profileId,
      modelId: capabilities.modelId,
      requestSchema: capabilities.requestSchema,
      parameter: first.parameter,
      reason: first.reason,
      issueCount: issues.length,
    },
  });
}
