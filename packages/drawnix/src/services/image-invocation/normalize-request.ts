import type { ModelRef } from '../../utils/settings-types';
import { ImageInvocationError } from './errors';
import type { ImageInvocationTelemetry } from './performance';
import type {
  ImageGenerationMode,
  NormalizedImagePromptMetadata,
  NormalizedImageRequest,
} from './types';

type UnknownRecord = Record<string, unknown>;

const NORMALIZED_PARAM_ALIASES = new Set([
  'prompt',
  'taskId',
  'task_id',
  'model',
  'modelRef',
  'model_ref',
  'bindingId',
  'binding_id',
  'generationMode',
  'generation_mode',
  'referenceImages',
  'reference_images',
  'uploadedImages',
  'uploaded_images',
  'uploadedImage',
  'uploaded_image',
  'maskImage',
  'mask_image',
  'size',
  'aspectRatio',
  'aspect_ratio',
  'resolution',
  'quality',
  'inputFidelity',
  'input_fidelity',
  'background',
  'outputFormat',
  'output_format',
  'outputCompression',
  'output_compression',
  'compression',
  'count',
  'n',
  'responseFormat',
  'response_format',
  'moderation',
  'user',
  'assetMetadata',
  'asset_metadata',
  'promptMeta',
  'prompt_meta',
  'signal',
]);

function isRecord(value: unknown): value is UnknownRecord {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function invalidField(field: string, expected: string): never {
  throw new ImageInvocationError(
    'IMAGE_REQUEST_INVALID',
    `图片请求参数 ${field} 格式无效`,
    {
      stage: 'normalization',
      details: { field, expected },
    }
  );
}

function readString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function readAlias(
  top: UnknownRecord,
  nested: UnknownRecord,
  aliases: readonly string[]
): { key: string; value: unknown } | undefined {
  for (const source of [top, nested]) {
    for (const key of aliases) {
      const value = source[key];
      if (value === undefined || value === null || value === '') {
        continue;
      }
      return { key, value };
    }
  }
  return undefined;
}

function readStringAlias(
  top: UnknownRecord,
  nested: UnknownRecord,
  aliases: readonly string[]
): string | undefined {
  const found = readAlias(top, nested, aliases);
  if (!found) {
    return undefined;
  }
  const value = readString(found.value);
  return value ?? invalidField(found.key, 'non-empty string');
}

function normalizeBase64(value: string, mimeType?: string): string {
  const trimmed = value.trim();
  if (trimmed.startsWith('data:')) {
    return trimmed;
  }

  const compact = trimmed.replace(/\s+/g, '');
  const safeMime =
    mimeType && /^image\/[a-z0-9.+-]+$/i.test(mimeType.trim())
      ? mimeType.trim().toLowerCase()
      : 'image/png';
  return `data:${safeMime};base64,${compact}`;
}

function normalizeImageValue(value: unknown, field: string): string | null {
  if (typeof value === 'string') {
    return readString(value) || null;
  }
  if (!isRecord(value)) {
    invalidField(field, 'string or { url | base64 }');
  }

  const url = readString(value.url);
  if (url) {
    return url;
  }
  const base64 = readString(value.base64);
  if (base64) {
    const mimeType = readString(value.mimeType) || readString(value.mime_type);
    return normalizeBase64(base64, mimeType);
  }

  invalidField(field, 'object containing a non-empty url or base64');
}

function appendImages(
  target: string[],
  seen: Set<string>,
  value: unknown,
  field: string
): void {
  if (value === undefined || value === null || value === '') {
    return;
  }

  const values = Array.isArray(value) ? value : [value];
  values.forEach((item, index) => {
    const normalized = normalizeImageValue(item, `${field}[${index}]`);
    if (!normalized || seen.has(normalized)) {
      return;
    }
    seen.add(normalized);
    target.push(normalized);
  });
}

function normalizeReferenceImages(
  top: UnknownRecord,
  nested: UnknownRecord
): readonly string[] {
  const result: string[] = [];
  const seen = new Set<string>();
  const fields = [
    'referenceImages',
    'reference_images',
    'uploadedImages',
    'uploaded_images',
    'uploadedImage',
    'uploaded_image',
  ] as const;

  // Top-level input precedes nested compatibility data. Within each scope the
  // canonical reference list precedes uploaded-image aliases. First wins.
  for (const source of [top, nested]) {
    for (const field of fields) {
      appendImages(result, seen, source[field], field);
    }
  }

  return Object.freeze(result);
}

function normalizeGenerationMode(
  value: string | undefined
): ImageGenerationMode | undefined {
  if (!value) {
    return undefined;
  }
  const normalized = value.trim().toLowerCase();
  if (
    normalized === 'text_to_image' ||
    normalized === 'image_to_image' ||
    normalized === 'image_edit'
  ) {
    return normalized;
  }
  return invalidField(
    'generationMode',
    'text_to_image, image_to_image, or image_edit'
  );
}

function normalizeAllowedString<T extends string>(
  field: string,
  value: string | undefined,
  allowed: readonly T[]
): T | undefined {
  if (!value) {
    return undefined;
  }
  const normalized = value.trim().toLowerCase();
  if ((allowed as readonly string[]).includes(normalized)) {
    return normalized as T;
  }
  return invalidField(field, allowed.join(', '));
}

function normalizeSize(value: string | undefined): string | undefined {
  if (!value) {
    return undefined;
  }
  return value
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/^(\d+(?:\.\d+)?):(\d+(?:\.\d+)?)$/, '$1x$2');
}

function normalizeAspectRatio(value: string | undefined): string | undefined {
  if (!value) {
    return undefined;
  }
  return value
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/^(\d+(?:\.\d+)?)[x:](\d+(?:\.\d+)?)$/, '$1:$2');
}

function readNumberAlias(
  top: UnknownRecord,
  nested: UnknownRecord,
  aliases: readonly string[],
  options: { integer?: boolean; min?: number; max?: number } = {}
): number | undefined {
  const found = readAlias(top, nested, aliases);
  if (!found) {
    return undefined;
  }
  const value =
    typeof found.value === 'number'
      ? found.value
      : typeof found.value === 'string' && found.value.trim()
      ? Number(found.value)
      : Number.NaN;
  if (
    !Number.isFinite(value) ||
    (options.integer && !Number.isInteger(value)) ||
    (options.min !== undefined && value < options.min) ||
    (options.max !== undefined && value > options.max)
  ) {
    invalidField(found.key, 'number within the supported canonical range');
  }
  return value;
}

function normalizeModelRef(value: unknown): Readonly<ModelRef> | null {
  if (value === undefined || value === null) {
    return null;
  }
  if (!isRecord(value)) {
    invalidField('modelRef', '{ profileId, modelId }');
  }

  const profileId =
    readString(value.profileId) || readString(value.profile_id) || null;
  const modelId =
    readString(value.modelId) || readString(value.model_id) || null;
  if (!profileId && !modelId) {
    invalidField('modelRef', '{ profileId, modelId } with at least one ID');
  }
  return Object.freeze({ profileId, modelId });
}

function normalizeSignal(value: unknown): AbortSignal | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }
  if (
    typeof value === 'object' &&
    typeof (value as { aborted?: unknown }).aborted === 'boolean' &&
    typeof (value as { addEventListener?: unknown }).addEventListener ===
      'function'
  ) {
    return value as AbortSignal;
  }
  return invalidField('signal', 'AbortSignal');
}

function readMetadataString(
  value: unknown,
  field: string
): string | undefined {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }
  return readString(value) ?? invalidField(field, 'non-empty string');
}

function readRecordStringAlias(
  value: UnknownRecord,
  aliases: readonly string[],
  field: string
): string | undefined {
  for (const alias of aliases) {
    if (value[alias] !== undefined) {
      return readMetadataString(value[alias], `${field}.${alias}`);
    }
  }
  return undefined;
}

function normalizeStringList(
  value: unknown,
  field: string
): readonly string[] | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }
  if (!Array.isArray(value)) {
    invalidField(field, 'string[]');
  }
  const result = value.map((item, index) =>
    readMetadataString(item, `${field}[${index}]`)
  );
  return Object.freeze(result.filter((item): item is string => Boolean(item)));
}

function normalizeKnowledgeContextRefs(
  value: unknown,
  field: string
): NormalizedImagePromptMetadata['knowledgeContextRefs'] {
  if (value === undefined || value === null) {
    return undefined;
  }
  if (!Array.isArray(value)) {
    invalidField(field, 'KnowledgeContextRef[]');
  }
  return Object.freeze(
    value.map((item, index) => {
      if (!isRecord(item)) {
        invalidField(`${field}[${index}]`, 'KnowledgeContextRef');
      }
      const noteId = readRecordStringAlias(
        item,
        ['noteId', 'note_id'],
        `${field}[${index}]`
      );
      const title = readRecordStringAlias(
        item,
        ['title'],
        `${field}[${index}]`
      );
      if (!noteId || !title) {
        invalidField(`${field}[${index}]`, '{ noteId, title }');
      }
      const directoryId = readRecordStringAlias(
        item,
        ['directoryId', 'directory_id'],
        `${field}[${index}]`
      );
      const updatedAtValue = item.updatedAt ?? item.updated_at;
      const updatedAt =
        updatedAtValue === undefined || updatedAtValue === null
          ? undefined
          : typeof updatedAtValue === 'number' &&
            Number.isFinite(updatedAtValue)
          ? updatedAtValue
          : invalidField(`${field}[${index}].updatedAt`, 'finite number');
      return Object.freeze({
        noteId,
        title,
        ...(directoryId ? { directoryId } : undefined),
        ...(updatedAt !== undefined ? { updatedAt } : undefined),
      });
    })
  );
}

function normalizeAssetMetadata(
  value: unknown,
  field: string
): NormalizedImageRequest['assetMetadata'] {
  if (value === undefined || value === null) {
    return undefined;
  }
  if (!isRecord(value)) {
    invalidField(field, 'GenerationAssetMetadata');
  }
  const rawCategory = readRecordStringAlias(value, ['category'], field);
  const category = rawCategory?.toUpperCase();
  if (category && category !== 'GENERAL' && category !== 'CHARACTER') {
    invalidField(`${field}.category`, 'GENERAL or CHARACTER');
  }
  return Object.freeze({
    ...(category ? { category: category as 'GENERAL' | 'CHARACTER' } : {}),
    ...(readRecordStringAlias(
      value,
      ['characterName', 'character_name'],
      field
    )
      ? {
          characterName: readRecordStringAlias(
            value,
            ['characterName', 'character_name'],
            field
          ),
        }
      : {}),
    ...(readRecordStringAlias(
      value,
      ['characterPrompt', 'character_prompt'],
      field
    )
      ? {
          characterPrompt: readRecordStringAlias(
            value,
            ['characterPrompt', 'character_prompt'],
            field
          ),
        }
      : {}),
  });
}

function normalizePromptMetadata(
  value: unknown,
  field: string
): NormalizedImagePromptMetadata | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }
  if (!isRecord(value)) {
    invalidField(field, 'prompt metadata object');
  }
  const rawCategory = readRecordStringAlias(value, ['category'], field);
  const category = rawCategory?.toLowerCase();
  const allowedCategories = new Set([
    'image',
    'video',
    'audio',
    'text',
    'agent',
    'ppt-common',
    'ppt-slide',
  ]);
  if (category && !allowedCategories.has(category)) {
    invalidField(`${field}.category`, 'supported prompt category');
  }
  const tags = normalizeStringList(value.tags, `${field}.tags`);
  const knowledgeContextRefs = normalizeKnowledgeContextRefs(
    value.knowledgeContextRefs ?? value.knowledge_context_refs,
    `${field}.knowledgeContextRefs`
  );
  return Object.freeze({
    ...(readRecordStringAlias(
      value,
      ['initialPrompt', 'initial_prompt'],
      field
    )
      ? {
          initialPrompt: readRecordStringAlias(
            value,
            ['initialPrompt', 'initial_prompt'],
            field
          ),
        }
      : {}),
    ...(readRecordStringAlias(value, ['sentPrompt', 'sent_prompt'], field)
      ? {
          sentPrompt: readRecordStringAlias(
            value,
            ['sentPrompt', 'sent_prompt'],
            field
          ),
        }
      : {}),
    ...(readRecordStringAlias(value, ['title'], field)
      ? { title: readRecordStringAlias(value, ['title'], field) }
      : {}),
    ...(category
      ? {
          category: category as NormalizedImagePromptMetadata['category'],
        }
      : {}),
    ...(tags ? { tags } : {}),
    ...(knowledgeContextRefs ? { knowledgeContextRefs } : {}),
    ...(readRecordStringAlias(value, ['skillId', 'skill_id'], field)
      ? {
          skillId: readRecordStringAlias(
            value,
            ['skillId', 'skill_id'],
            field
          ),
        }
      : {}),
    ...(readRecordStringAlias(value, ['skillName', 'skill_name'], field)
      ? {
          skillName: readRecordStringAlias(
            value,
            ['skillName', 'skill_name'],
            field
          ),
        }
      : {}),
  });
}

function normalizeProviderParams(
  nested: UnknownRecord
): Readonly<UnknownRecord> {
  const entries = Object.entries(nested).filter(
    ([key]) => !NORMALIZED_PARAM_ALIASES.has(key)
  );
  return Object.freeze(Object.fromEntries(entries));
}

function normalizeImageRequestValue(raw: unknown): NormalizedImageRequest {
  if (!isRecord(raw)) {
    throw new ImageInvocationError(
      'IMAGE_REQUEST_INVALID',
      '图片请求必须是对象',
      {
        stage: 'normalization',
        details: { expected: 'object' },
      }
    );
  }

  const nestedValue = raw.params;
  if (
    nestedValue !== undefined &&
    nestedValue !== null &&
    !isRecord(nestedValue)
  ) {
    invalidField('params', 'object');
  }
  const nested = isRecord(nestedValue) ? nestedValue : {};
  const prompt = readStringAlias(raw, nested, ['prompt']);
  if (!prompt) {
    invalidField('prompt', 'non-empty string');
  }

  const modelRefAlias = readAlias(raw, nested, ['modelRef', 'model_ref']);
  const maskAlias = readAlias(raw, nested, ['maskImage', 'mask_image']);
  const maskImage = maskAlias
    ? normalizeImageValue(maskAlias.value, maskAlias.key) || undefined
    : undefined;
  const outputFormatValue = readStringAlias(raw, nested, [
    'outputFormat',
    'output_format',
  ]);
  const assetMetadataAlias = readAlias(raw, nested, [
    'assetMetadata',
    'asset_metadata',
  ]);
  const promptMetadataAlias = readAlias(raw, nested, [
    'promptMeta',
    'prompt_meta',
  ]);

  const normalized: NormalizedImageRequest = {
    prompt,
    taskId: readStringAlias(raw, nested, ['taskId', 'task_id']),
    model: readStringAlias(raw, nested, ['model']),
    modelRef: modelRefAlias ? normalizeModelRef(modelRefAlias.value) : null,
    bindingId: readStringAlias(raw, nested, ['bindingId', 'binding_id']),
    generationMode: normalizeGenerationMode(
      readStringAlias(raw, nested, ['generationMode', 'generation_mode'])
    ),
    referenceImages: normalizeReferenceImages(raw, nested),
    maskImage,
    size: normalizeSize(readStringAlias(raw, nested, ['size'])),
    aspectRatio: normalizeAspectRatio(
      readStringAlias(raw, nested, ['aspectRatio', 'aspect_ratio'])
    ),
    resolution: readStringAlias(raw, nested, ['resolution'])?.toLowerCase(),
    quality: readStringAlias(raw, nested, ['quality'])?.toLowerCase(),
    inputFidelity: readStringAlias(raw, nested, [
      'inputFidelity',
      'input_fidelity',
    ])?.toLowerCase(),
    background: readStringAlias(raw, nested, ['background'])?.toLowerCase(),
    outputFormat: outputFormatValue
      ? outputFormatValue.toLowerCase() === 'jpg'
        ? 'jpeg'
        : outputFormatValue.toLowerCase()
      : undefined,
    outputCompression: readNumberAlias(
      raw,
      nested,
      ['outputCompression', 'output_compression', 'compression'],
      { min: 0, max: 100 }
    ),
    count: readNumberAlias(raw, nested, ['count', 'n'], {
      integer: true,
      min: 1,
    }),
    responseFormat: normalizeAllowedString(
      'responseFormat',
      readStringAlias(raw, nested, ['responseFormat', 'response_format']),
      ['url', 'b64_json'] as const
    ),
    moderation: normalizeAllowedString(
      'moderation',
      readStringAlias(raw, nested, ['moderation']),
      ['low', 'auto'] as const
    ),
    user: readStringAlias(raw, nested, ['user']),
    assetMetadata: assetMetadataAlias
      ? normalizeAssetMetadata(assetMetadataAlias.value, assetMetadataAlias.key)
      : undefined,
    promptMeta: promptMetadataAlias
      ? normalizePromptMetadata(
          promptMetadataAlias.value,
          promptMetadataAlias.key
        )
      : undefined,
    params: normalizeProviderParams(nested),
    signal: normalizeSignal(raw.signal ?? nested.signal),
  };

  return Object.freeze(normalized);
}

export interface NormalizeImageRequestOptions {
  readonly telemetry?: ImageInvocationTelemetry;
}

export function normalizeImageRequest(
  raw: unknown,
  options: NormalizeImageRequestOptions = {}
): NormalizedImageRequest {
  const telemetry = options.telemetry;
  if (!telemetry) {
    return normalizeImageRequestValue(raw);
  }
  telemetry.increment('normalizationCalls');
  return telemetry.measureSync('normalization', () =>
    normalizeImageRequestValue(raw)
  );
}
