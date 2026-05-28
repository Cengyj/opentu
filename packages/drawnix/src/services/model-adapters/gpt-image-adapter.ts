import {
  resolveOfficialGPTImageQuality,
  resolveOfficialGPTImageEditSize,
  resolveOfficialGPTImageSize,
} from './image-size-quality-resolver';
import { sendAdapterRequest } from './context';
import { registerModelAdapter } from './registry';
import type {
  ImageGenerationRequest,
  ImageGenerationResult,
  ImageModelAdapter,
} from './types';

const GPT_IMAGE_OUTPUT_FORMATS = new Set(['png', 'jpeg', 'webp']);
const GPT_IMAGE_BACKGROUND_VALUES = new Set(['transparent', 'opaque', 'auto']);
const GPT_IMAGE_MODERATION_VALUES = new Set(['low', 'auto']);
const GPT_IMAGE_INPUT_FIDELITY_VALUES = new Set(['high', 'low']);
const GPT_IMAGE_RESPONSE_FORMAT_VALUES = new Set(['url', 'b64_json']);
const BASE64_IMAGE_SIGNATURES: Array<{ prefix: string; mimeType: string }> = [
  { prefix: 'iVBORw0KGgo', mimeType: 'image/png' },
  { prefix: '/9j/', mimeType: 'image/jpeg' },
  { prefix: 'R0lGOD', mimeType: 'image/gif' },
  { prefix: 'UklGR', mimeType: 'image/webp' },
  { prefix: 'PHN2Zy', mimeType: 'image/svg+xml' },
];
const BASE64_IMAGE_BODY_REGEX = /^[A-Za-z0-9+/=\r\n]+$/;
const MIME_EXTENSION_MAP: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'image/svg+xml': 'svg',
};

async function loadImageUrlUtils() {
  return import('@aitu/utils');
}

type GetFileExtension = (
  url: string,
  mimeType?: string | undefined
) => string;

function sanitizeBase64Payload(base64: string): string {
  return base64.trim().replace(/\s+/g, '');
}

function inferImageMimeTypeFromBase64(base64: string): string | undefined {
  const normalized = sanitizeBase64Payload(base64);
  return BASE64_IMAGE_SIGNATURES.find(({ prefix }) =>
    normalized.startsWith(prefix)
  )?.mimeType;
}

function normalizeImageDataUrl(
  value: string,
  fallbackMimeType = 'image/png'
): string {
  const trimmed = value.trim();
  if (!trimmed) return value;
  if (
    trimmed.startsWith('data:') ||
    trimmed.startsWith('blob:') ||
    trimmed.startsWith('http://') ||
    trimmed.startsWith('https://')
  ) {
    return trimmed;
  }

  if (
    (trimmed.startsWith('/') ||
      trimmed.startsWith('./') ||
      trimmed.startsWith('../')) &&
    !inferImageMimeTypeFromBase64(trimmed)
  ) {
    return trimmed;
  }

  const normalized = sanitizeBase64Payload(trimmed);
  if (!BASE64_IMAGE_BODY_REGEX.test(normalized) || normalized.length < 32) {
    return trimmed;
  }

  const mimeType = inferImageMimeTypeFromBase64(normalized) || fallbackMimeType;
  return `data:${mimeType};base64,${normalized}`;
}

function getFileExtension(url: string, mimeType?: string): string {
  const normalizedMimeType = mimeType?.split(';')[0]?.toLowerCase();
  if (normalizedMimeType && MIME_EXTENSION_MAP[normalizedMimeType]) {
    return MIME_EXTENSION_MAP[normalizedMimeType];
  }

  const dataUrlMimeType = url.match(/^data:([^;,]+)/)?.[1]?.toLowerCase();
  if (dataUrlMimeType && MIME_EXTENSION_MAP[dataUrlMimeType]) {
    return MIME_EXTENSION_MAP[dataUrlMimeType];
  }

  const extension = url
    .split(/[?#]/)[0]
    ?.match(/\.([a-z0-9]{1,8})$/i)?.[1]
    ?.toLowerCase();
  return extension || 'bin';
}

export function isGPTImage2ModelId(model: string | undefined): boolean {
  return typeof model === 'string' && model.trim() === 'gpt-image-2';
}

function supportsGPTImageResponseFormat(model: string | undefined): boolean {
  return !isGPTImage2ModelId(model);
}

function supportsGPTImageInputFidelity(model: string | undefined): boolean {
  return !isGPTImage2ModelId(model);
}

function normalizeGPTImageBackground(
  model: string | undefined,
  background: string | undefined
): string | undefined {
  if (isGPTImage2ModelId(model) && background === 'transparent') {
    return 'auto';
  }
  return background;
}

function getStringParam(
  params: Record<string, unknown> | undefined,
  key: string
): string | undefined {
  const value = params?.[key];
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function getNumberParam(
  params: Record<string, unknown> | undefined,
  key: string
): number | undefined {
  const value = params?.[key];
  return typeof value === 'number' && Number.isFinite(value)
    ? value
    : undefined;
}

function getStringFieldOrParam(
  fieldValue: string | undefined,
  params: Record<string, unknown> | undefined,
  key: string
): string | undefined {
  return fieldValue && fieldValue.trim()
    ? fieldValue.trim()
    : getStringParam(params, key);
}

function getNumberFieldOrParam(
  fieldValue: number | undefined,
  params: Record<string, unknown> | undefined,
  key: string
): number | undefined {
  return typeof fieldValue === 'number' && Number.isFinite(fieldValue)
    ? fieldValue
    : getNumberParam(params, key);
}

function setAllowedStringParam(
  body: Record<string, unknown>,
  params: Record<string, unknown> | undefined,
  key: string,
  allowed: Set<string>
): void {
  const value = getStringParam(params, key);
  if (value && allowed.has(value)) {
    body[key] = value;
  }
}

function setAllowedStringValue(
  body: Record<string, unknown>,
  key: string,
  value: string | undefined,
  allowed: Set<string>
): void {
  if (value && allowed.has(value)) {
    body[key] = value;
  }
}

function getGPTImageResponseFormat(
  params: Record<string, unknown> | undefined
): 'url' | 'b64_json' {
  const value = getStringParam(params, 'response_format');
  return value && GPT_IMAGE_RESPONSE_FORMAT_VALUES.has(value)
    ? (value as 'url' | 'b64_json')
    : 'url';
}

function applyCommonGPTImageOptions(
  body: Record<string, unknown>,
  request: ImageGenerationRequest,
  mode: 'generation' | 'edit' = 'generation'
): void {
  const params = request.params;
  const requestedSize = getStringParam(params, 'size') || request.size;
  const size =
    mode === 'edit'
      ? resolveOfficialGPTImageEditSize(request.model, requestedSize, params)
      : resolveOfficialGPTImageSize(request.model, requestedSize, params);
  const quality = resolveOfficialGPTImageQuality(params);
  const n = getNumberParam(params, 'n') ?? getNumberParam(params, 'count');
  const outputCompression = getNumberFieldOrParam(
    request.outputCompression,
    params,
    'output_compression'
  );
  const user = getStringParam(params, 'user');
  const outputFormat = getStringFieldOrParam(
    request.outputFormat,
    params,
    'output_format'
  );
  const background = normalizeGPTImageBackground(
    request.model,
    getStringFieldOrParam(request.background, params, 'background')
  );

  if (size) {
    body.size = size;
  }
  if (n !== undefined && n >= 1 && n <= 10) {
    body.n = n;
  }
  if (
    outputCompression !== undefined &&
    outputCompression >= 0 &&
    outputCompression <= 100
  ) {
    body.output_compression = outputCompression;
  }
  if (user) {
    body.user = user;
  }
  if (quality) {
    body.quality = quality;
  }

  setAllowedStringValue(
    body,
    'output_format',
    outputFormat,
    GPT_IMAGE_OUTPUT_FORMATS
  );
  setAllowedStringValue(
    body,
    'background',
    background,
    GPT_IMAGE_BACKGROUND_VALUES
  );
  setAllowedStringParam(
    body,
    params,
    'moderation',
    GPT_IMAGE_MODERATION_VALUES
  );
}

export function buildGPTImageGenerationBody(
  request: ImageGenerationRequest
): Record<string, unknown> {
  if (!request.model) {
    throw new Error('GPT Image 请求缺少模型 ID');
  }

  const body: Record<string, unknown> = {
    model: request.model,
    prompt: request.prompt,
  };

  if (supportsGPTImageResponseFormat(request.model)) {
    body.response_format = getGPTImageResponseFormat(request.params);
  }

  applyCommonGPTImageOptions(body, request, 'generation');

  return body;
}

function appendFormValue(
  formData: FormData,
  key: string,
  value: unknown
): void {
  if (value === undefined || value === null) {
    return;
  }
  formData.append(key, String(value));
}

function getBlobExtension(
  blob: Blob,
  source: string,
  getFileExtension: GetFileExtension
): string {
  const sourceExtension = getFileExtension(source, blob.type);
  if (sourceExtension && sourceExtension !== 'bin') {
    return sourceExtension;
  }

  const mimeExtension = getFileExtension('', blob.type || 'image/png');
  return mimeExtension === 'bin' ? 'png' : mimeExtension;
}

async function imageInputToBlob(
  value: string,
  filenamePrefix: string,
  fetcher: typeof fetch = fetch
): Promise<{ blob: Blob; filename: string }> {
  const { base64ToBlob, getFileExtension, normalizeImageDataUrl } =
    await loadImageUrlUtils();
  const normalized = normalizeImageDataUrl(value, 'image/png');

  if (normalized.startsWith('data:')) {
    const blob = await normalizeFormDataBlob(base64ToBlob(normalized));
    return {
      blob,
      filename: `${filenamePrefix}.${getBlobExtension(
        blob,
        normalized,
        getFileExtension
      )}`,
    };
  }

  const response = await fetcher(normalized);
  if (!response.ok) {
    throw new Error(
      `GPT Image 编辑图片读取失败: ${response.status} ${response.statusText}`
    );
  }

  const blob = await normalizeFormDataBlob(await response.blob());
  return {
    blob,
    filename: `${filenamePrefix}.${getBlobExtension(
      blob,
      normalized,
      getFileExtension
    )}`,
  };
}

async function normalizeFormDataBlob(blob: Blob): Promise<Blob> {
  if (blob instanceof Blob) {
    return blob;
  }

  return new Blob([await blob.arrayBuffer()], {
    type: blob.type || 'application/octet-stream',
  });
}

export async function buildGPTImageEditFormData(
  request: ImageGenerationRequest,
  fetcher?: typeof fetch
): Promise<FormData> {
  if (!request.model) {
    throw new Error('GPT Image 编辑请求缺少模型 ID');
  }

  const referenceImages = request.referenceImages || [];
  if (referenceImages.length === 0) {
    throw new Error('GPT Image 编辑请求缺少参考图片');
  }

  const params = request.params;
  const inputFidelity = getStringFieldOrParam(
    request.inputFidelity,
    params,
    'input_fidelity'
  );
  const maskImage =
    getStringFieldOrParam(request.maskImage, params, 'maskImage') ||
    getStringParam(params, 'mask_image');
  const fields: Record<string, unknown> = {
    model: request.model,
    prompt: request.prompt,
  };

  if (supportsGPTImageResponseFormat(request.model)) {
    fields.response_format = getGPTImageResponseFormat(params);
  }

  if (supportsGPTImageInputFidelity(request.model)) {
    setAllowedStringValue(
      fields,
      'input_fidelity',
      inputFidelity,
      GPT_IMAGE_INPUT_FIDELITY_VALUES
    );
  }
  applyCommonGPTImageOptions(fields, request, 'edit');

  const formData = new FormData();
  for (const [key, value] of Object.entries(fields)) {
    appendFormValue(formData, key, value);
  }

  for (const [index, referenceImage] of referenceImages.entries()) {
    const { blob, filename } = await imageInputToBlob(
      referenceImage,
      `image-${index + 1}`,
      fetcher
    );
    formData.append('image[]', blob, filename);
  }

  if (maskImage) {
    const { blob, filename } = await imageInputToBlob(
      maskImage,
      'mask',
      fetcher
    );
    formData.append('mask', blob, filename);
  }

  return formData;
}

function isGPTImageEditRequest(
  request: ImageGenerationRequest,
  requestSchema?: string
): boolean {
  if (requestSchema === 'openai.image.gpt-edit-form') {
    return true;
  }
  return (
    request.generationMode === 'image_edit' ||
    request.generationMode === 'image_to_image'
  );
}

function resolveGPTImagePath(
  context: { binding?: { submitPath?: string; requestSchema?: string } | null },
  isEditRequest: boolean
): string {
  const binding = context.binding;

  if (isEditRequest) {
    return binding?.requestSchema === 'openai.image.gpt-edit-form' &&
      binding.submitPath
      ? binding.submitPath
      : '/images/edits';
  }

  if (binding?.submitPath) {
    return binding.submitPath;
  }

  return '/images/generations';
}

function normalizeImageValue(
  value: unknown,
  fallbackFormat?: string
): string | undefined {
  if (typeof value !== 'string' || !value.trim()) {
    return undefined;
  }

  const mimeType = fallbackFormat ? `image/${fallbackFormat}` : 'image/png';
  return normalizeImageDataUrl(value, mimeType);
}

export function parseGPTImageResponse(
  response: unknown,
  fallbackFormat?: string
): ImageGenerationResult {
  const data = response as {
    data?: Array<Record<string, unknown>>;
    output_format?: string;
  };
  const formatHint =
    typeof data?.output_format === 'string'
      ? data.output_format
      : fallbackFormat;

  if (Array.isArray(data?.data)) {
    const urls = data.data
      .map((item) =>
        normalizeImageValue(item.b64_json || item.url, formatHint || 'png')
      )
      .filter(Boolean) as string[];
    const firstUrl = urls[0];

    if (firstUrl) {
      const format = getFileExtension(firstUrl) || formatHint || 'png';
      return {
        url: firstUrl,
        urls,
        format: format === 'bin' ? formatHint || 'png' : format,
        raw: response,
      };
    }
  }

  throw new Error('GPT Image API 未返回有效的图片数据');
}

async function readErrorMessage(response: Response): Promise<string> {
  const data = await response.json().catch(() => null);
  if (typeof data?.error === 'string') {
    return data.error;
  }
  if (typeof data?.error?.message === 'string') {
    return data.error.message;
  }
  if (typeof data?.message === 'string') {
    return data.message;
  }
  return `GPT Image request failed: ${response.status}`;
}

export const gptImageAdapter: ImageModelAdapter = {
  id: 'gpt-image-adapter',
  label: 'GPT Image',
  kind: 'image',
  docsUrl: 'https://platform.openai.com/docs/api-reference/images',
  matchRequestSchemas: [
    'openai.image.gpt-generation-json',
    'openai.image.gpt-edit-form',
  ],
  defaultModel: 'gpt-image-2',
  async generateImage(context, request) {
    const isEditRequest = isGPTImageEditRequest(
      request,
      context.binding?.requestSchema
    );
    const editFormData = isEditRequest
      ? await buildGPTImageEditFormData(request, context.fetcher)
      : null;
    const generationBody = isEditRequest
      ? null
      : buildGPTImageGenerationBody(request);
    const outputFormat = editFormData
      ? (editFormData.get('output_format') as string | null) || undefined
      : typeof generationBody?.output_format === 'string'
      ? generationBody.output_format
      : undefined;
    const response = await sendAdapterRequest(context, {
      path: resolveGPTImagePath(context, isEditRequest),
      method: 'POST',
      headers: isEditRequest
        ? undefined
        : {
            'Content-Type': 'application/json',
          },
      body: editFormData || JSON.stringify(generationBody),
    });

    if (!response.ok) {
      throw new Error(await readErrorMessage(response));
    }

    const result = await response.json();
    return parseGPTImageResponse(result, outputFormat);
  },
};

export const registerGPTImageAdapter = (): void => {
  registerModelAdapter(gptImageAdapter);
};
