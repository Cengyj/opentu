/**
 * Provider-independent image results.
 *
 * Provider payloads are normalized at the adapter boundary. Consumers receive
 * only renderable image sources and never need to inspect provider response
 * fields such as `b64_json` or `inlineData`.
 */

import {
  IMAGE_ARTIFACT_MIME_TYPES,
  type ImageArtifact,
  type ImageArtifactFormat,
  type ImageArtifactMimeType,
} from '../../types/image-artifact.types';

export {
  IMAGE_ARTIFACT_MIME_TYPES,
  type ImageArtifact,
  type ImageArtifactFormat,
  type ImageArtifactMimeType,
} from '../../types/image-artifact.types';

export type ImageArtifactErrorCode =
  | 'IMAGE_ARTIFACT_EMPTY_RESULT'
  | 'IMAGE_ARTIFACT_INVALID_SOURCE'
  | 'IMAGE_ARTIFACT_INVALID_BASE64'
  | 'IMAGE_ARTIFACT_MIME_REQUIRED'
  | 'IMAGE_ARTIFACT_UNSUPPORTED_MIME'
  | 'IMAGE_ARTIFACT_MIME_MISMATCH';

export class ImageArtifactError extends Error {
  readonly code: ImageArtifactErrorCode;
  readonly position?: number;

  constructor(
    code: ImageArtifactErrorCode,
    message: string,
    position?: number
  ) {
    super(message);
    this.name = 'ImageArtifactError';
    this.code = code;
    this.position = position;
  }
}

export interface ImageArtifactSourceInput {
  readonly value: string;
  readonly mimeType?: string;
  readonly width?: number;
  readonly height?: number;
}

export interface OpenAIImageArtifactOptions {
  /** OpenAI Images defaults binary output to PNG when no MIME is returned. */
  readonly defaultMimeType?: string;
}

export interface LegacyImageArtifactResult {
  readonly url: string;
  readonly urls?: string[];
  readonly format?: ImageArtifactFormat;
  readonly width?: number;
  readonly height?: number;
}

export interface LegacyImageArtifactResultOptions {
  readonly fallbackFormat?: ImageArtifactFormat;
  /** Some existing adapter consumers expect `urls` even for one artifact. */
  readonly includeSingleUrl?: boolean;
}

type UnknownRecord = Record<string, unknown>;

const SUPPORTED_MIME_TYPES = new Set<string>(IMAGE_ARTIFACT_MIME_TYPES);

const MIME_TO_FORMAT: Record<ImageArtifactMimeType, ImageArtifactFormat> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
  'image/gif': 'gif',
};

const EXTENSION_TO_MIME: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
  gif: 'image/gif',
  svg: 'image/svg+xml',
  bmp: 'image/bmp',
  avif: 'image/avif',
  ico: 'image/x-icon',
};

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function getNonEmptyString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function getFinitePositiveNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) && value > 0
    ? value
    : undefined;
}

function describePosition(position: number): string {
  return `第 ${position + 1} 个图片结果`;
}

function normalizeMimeType(
  mimeType: string,
  position: number
): ImageArtifactMimeType {
  const normalized = mimeType.trim().toLowerCase();
  const canonical = normalized === 'image/jpg' ? 'image/jpeg' : normalized;

  if (!SUPPORTED_MIME_TYPES.has(canonical)) {
    throw new ImageArtifactError(
      'IMAGE_ARTIFACT_UNSUPPORTED_MIME',
      `${describePosition(position)}使用了不支持的 MIME 类型: ${
        canonical || 'unknown'
      }`,
      position
    );
  }

  return canonical as ImageArtifactMimeType;
}

function mimeFromOutputFormat(value: unknown): string | undefined {
  const format = getNonEmptyString(value)?.toLowerCase();
  if (!format) {
    return undefined;
  }

  const normalized = format === 'jpg' ? 'jpeg' : format;
  return normalized.startsWith('image/') ? normalized : `image/${normalized}`;
}

function inferMimeTypeFromBase64(value: string): string | undefined {
  if (value.startsWith('iVBORw0KGgo')) {
    return 'image/png';
  }
  if (value.startsWith('/9j/')) {
    return 'image/jpeg';
  }
  if (value.startsWith('R0lGOD')) {
    return 'image/gif';
  }
  if (value.startsWith('UklGR')) {
    return 'image/webp';
  }
  if (value.startsWith('Qk')) {
    return 'image/bmp';
  }
  if (value.startsWith('PHN2Zy') || value.startsWith('PD94bWwg')) {
    return 'image/svg+xml';
  }
  if (
    value.startsWith('AAAAIGZ0eXBhdmlm') ||
    value.startsWith('AAAAGGZ0eXBhdmlm')
  ) {
    return 'image/avif';
  }
  return undefined;
}

function normalizeBase64(value: string, position: number): string {
  const normalized = value.trim().replace(/\s+/g, '');
  const hasValidAlphabet = /^[A-Za-z0-9+/]+={0,2}$/.test(normalized);
  const hasValidLength =
    normalized.length > 0 &&
    normalized.length % 4 !== 1 &&
    (!normalized.includes('=') || normalized.length % 4 === 0);

  if (!hasValidAlphabet || !hasValidLength) {
    throw new ImageArtifactError(
      'IMAGE_ARTIFACT_INVALID_BASE64',
      `${describePosition(position)}包含无效的 Base64 图片数据`,
      position
    );
  }

  return normalized;
}

function resolveInlineMimeType(
  base64: string,
  declaredMimeType: string | undefined,
  position: number
): ImageArtifactMimeType {
  const inferredMimeType = inferMimeTypeFromBase64(base64);
  const normalizedDeclaredMimeType = declaredMimeType
    ? normalizeMimeType(declaredMimeType, position)
    : undefined;
  const normalizedInferredMimeType = inferredMimeType
    ? normalizeMimeType(inferredMimeType, position)
    : undefined;

  if (
    normalizedDeclaredMimeType &&
    normalizedInferredMimeType &&
    normalizedDeclaredMimeType !== normalizedInferredMimeType
  ) {
    throw new ImageArtifactError(
      'IMAGE_ARTIFACT_MIME_MISMATCH',
      `${describePosition(position)}的 MIME 类型与图片内容不一致`,
      position
    );
  }

  const mimeType = normalizedInferredMimeType || normalizedDeclaredMimeType;
  if (!mimeType) {
    throw new ImageArtifactError(
      'IMAGE_ARTIFACT_MIME_REQUIRED',
      `${describePosition(position)}缺少可验证的图片 MIME 类型`,
      position
    );
  }

  return mimeType;
}

function createInlineArtifact(
  base64Value: string,
  declaredMimeType: string | undefined,
  position: number,
  dimensions?: { width?: number; height?: number }
): ImageArtifact {
  const base64 = normalizeBase64(base64Value, position);
  const mimeType = resolveInlineMimeType(base64, declaredMimeType, position);

  return {
    url: `data:${mimeType};base64,${base64}`,
    source: 'inline',
    mimeType,
    format: MIME_TO_FORMAT[mimeType],
    ...dimensions,
  };
}

function parseDataUrl(
  value: string,
  declaredMimeType: string | undefined,
  position: number,
  dimensions?: { width?: number; height?: number }
): ImageArtifact {
  const match = /^data:([^;,]+)(?:;[^,]*)?;base64,([\s\S]*)$/i.exec(value);
  if (!match) {
    throw new ImageArtifactError(
      'IMAGE_ARTIFACT_INVALID_BASE64',
      `${describePosition(position)}包含无效的 Base64 Data URL`,
      position
    );
  }

  const dataUrlMimeType = match[1];
  if (declaredMimeType) {
    const declared = normalizeMimeType(declaredMimeType, position);
    const embedded = normalizeMimeType(dataUrlMimeType, position);
    if (declared !== embedded) {
      throw new ImageArtifactError(
        'IMAGE_ARTIFACT_MIME_MISMATCH',
        `${describePosition(position)}的 MIME 类型与 Data URL 不一致`,
        position
      );
    }
  }

  return createInlineArtifact(match[2], dataUrlMimeType, position, dimensions);
}

function inferMimeTypeFromUrl(value: string): string | undefined {
  let path = value;
  try {
    path = new URL(value, 'https://local.invalid').pathname;
  } catch {
    path = value.split(/[?#]/, 1)[0];
  }

  const extensionMatch = /\.([A-Za-z0-9]+)$/.exec(path);
  return extensionMatch
    ? EXTENSION_TO_MIME[extensionMatch[1].toLowerCase()]
    : undefined;
}

function isSupportedUrl(value: string): boolean {
  return (
    /^https?:\/\//i.test(value) ||
    /^blob:/i.test(value) ||
    value.startsWith('/') ||
    value.startsWith('./') ||
    value.startsWith('../')
  );
}

function createUrlArtifact(
  value: string,
  declaredMimeType: string | undefined,
  position: number,
  dimensions?: { width?: number; height?: number }
): ImageArtifact {
  if (!isSupportedUrl(value)) {
    throw new ImageArtifactError(
      'IMAGE_ARTIFACT_INVALID_SOURCE',
      `${describePosition(position)}不是有效的图片 URL`,
      position
    );
  }

  const inferredMimeType = inferMimeTypeFromUrl(value);
  const mimeType = declaredMimeType
    ? normalizeMimeType(declaredMimeType, position)
    : inferredMimeType
    ? normalizeMimeType(inferredMimeType, position)
    : undefined;

  return {
    url: value,
    source: 'url',
    ...(mimeType ? { mimeType, format: MIME_TO_FORMAT[mimeType] } : undefined),
    ...dimensions,
  };
}

function normalizeSource(
  input: ImageArtifactSourceInput,
  position: number
): ImageArtifact {
  const value = input.value.trim();
  if (!value) {
    throw new ImageArtifactError(
      'IMAGE_ARTIFACT_INVALID_SOURCE',
      `${describePosition(position)}缺少图片来源`,
      position
    );
  }

  const dimensions = {
    ...(getFinitePositiveNumber(input.width)
      ? { width: getFinitePositiveNumber(input.width) }
      : undefined),
    ...(getFinitePositiveNumber(input.height)
      ? { height: getFinitePositiveNumber(input.height) }
      : undefined),
  };

  if (/^data:/i.test(value)) {
    return parseDataUrl(value, input.mimeType, position, dimensions);
  }

  if (isSupportedUrl(value)) {
    return createUrlArtifact(value, input.mimeType, position, dimensions);
  }

  return createInlineArtifact(value, input.mimeType, position, dimensions);
}

/** Normalize URL, Data URL, or raw Base64 sources without losing order. */
export function normalizeImageArtifacts(
  sources: readonly (string | ImageArtifactSourceInput)[]
): ImageArtifact[] {
  if (sources.length === 0) {
    throw new ImageArtifactError(
      'IMAGE_ARTIFACT_EMPTY_RESULT',
      '图片响应未包含任何结果'
    );
  }

  return sources.map((source, position) =>
    normalizeSource(
      typeof source === 'string' ? { value: source } : source,
      position
    )
  );
}

/**
 * Temporary projection for callers that still consume the historical
 * `url/urls/format` shape. Provider payloads must be normalized before this
 * boundary; this helper never accepts or exposes a raw response.
 */
export function artifactsToLegacyImageResult(
  artifacts: readonly ImageArtifact[],
  options: LegacyImageArtifactResultOptions = {}
): LegacyImageArtifactResult {
  if (artifacts.length === 0) {
    throw new ImageArtifactError(
      'IMAGE_ARTIFACT_EMPTY_RESULT',
      '图片响应未包含任何结果'
    );
  }

  const first = artifacts[0];
  const urls = artifacts.map((artifact) => artifact.url);

  return {
    url: first.url,
    ...(urls.length > 1 || options.includeSingleUrl ? { urls } : undefined),
    ...(first.format || options.fallbackFormat
      ? { format: first.format || options.fallbackFormat }
      : undefined),
    ...(first.width ? { width: first.width } : undefined),
    ...(first.height ? { height: first.height } : undefined),
  };
}

function readDimensions(record: UnknownRecord): {
  width?: number;
  height?: number;
} {
  const width = getFinitePositiveNumber(record.width);
  const height = getFinitePositiveNumber(record.height);
  return {
    ...(width ? { width } : undefined),
    ...(height ? { height } : undefined),
  };
}

/** Normalize OpenAI-compatible `data[].url|b64_json` responses. */
export function parseOpenAIImageArtifacts(
  response: unknown,
  options: OpenAIImageArtifactOptions = {}
): ImageArtifact[] {
  if (!isRecord(response) || !Array.isArray(response.data)) {
    throw new ImageArtifactError(
      'IMAGE_ARTIFACT_EMPTY_RESULT',
      '图片响应未包含任何结果'
    );
  }

  const responseMimeType = mimeFromOutputFormat(response.output_format);
  const defaultMimeType = options.defaultMimeType || 'image/png';
  const sources = response.data.map((item, position): ImageArtifact => {
    if (!isRecord(item)) {
      throw new ImageArtifactError(
        'IMAGE_ARTIFACT_INVALID_SOURCE',
        `${describePosition(position)}缺少图片来源`,
        position
      );
    }

    const declaredMimeType =
      getNonEmptyString(item.mime_type) ||
      getNonEmptyString(item.mimeType) ||
      responseMimeType;
    const url = getNonEmptyString(item.url);
    const base64 = getNonEmptyString(item.b64_json);
    const dimensions = readDimensions(item);

    if (url) {
      return normalizeSource(
        { value: url, mimeType: declaredMimeType, ...dimensions },
        position
      );
    }
    if (base64) {
      return createInlineArtifact(
        base64,
        declaredMimeType || defaultMimeType,
        position,
        dimensions
      );
    }

    throw new ImageArtifactError(
      'IMAGE_ARTIFACT_INVALID_SOURCE',
      `${describePosition(position)}缺少图片来源`,
      position
    );
  });

  if (sources.length === 0) {
    throw new ImageArtifactError(
      'IMAGE_ARTIFACT_EMPTY_RESULT',
      '图片响应未包含任何结果'
    );
  }

  return sources;
}

function getInlineDataRecord(part: UnknownRecord): UnknownRecord | undefined {
  const value = part.inlineData ?? part.inline_data;
  return isRecord(value) ? value : undefined;
}

function getFileDataRecord(part: UnknownRecord): UnknownRecord | undefined {
  const value = part.fileData ?? part.file_data;
  return isRecord(value) ? value : undefined;
}

function parseGeminiPart(
  part: unknown,
  position: number
): ImageArtifact | undefined {
  if (!isRecord(part)) {
    return undefined;
  }

  const hasInlineData = 'inlineData' in part || 'inline_data' in part;
  if (hasInlineData) {
    const inlineData = getInlineDataRecord(part);
    const data = inlineData ? getNonEmptyString(inlineData.data) : undefined;
    if (!inlineData || !data) {
      throw new ImageArtifactError(
        'IMAGE_ARTIFACT_INVALID_BASE64',
        `${describePosition(position)}包含无效的 Gemini inlineData`,
        position
      );
    }

    const mimeType =
      getNonEmptyString(inlineData.mimeType) ||
      getNonEmptyString(inlineData.mime_type);
    return createInlineArtifact(data, mimeType, position);
  }

  const hasFileData = 'fileData' in part || 'file_data' in part;
  if (hasFileData) {
    const fileData = getFileDataRecord(part);
    const fileUri = fileData
      ? getNonEmptyString(fileData.fileUri) ||
        getNonEmptyString(fileData.file_uri)
      : undefined;
    if (!fileData || !fileUri) {
      throw new ImageArtifactError(
        'IMAGE_ARTIFACT_INVALID_SOURCE',
        `${describePosition(position)}包含无效的 Gemini fileData`,
        position
      );
    }

    const mimeType =
      getNonEmptyString(fileData.mimeType) ||
      getNonEmptyString(fileData.mime_type);
    return normalizeSource({ value: fileUri, mimeType }, position);
  }

  return undefined;
}

function collectGeminiCandidateParts(response: UnknownRecord): unknown[] {
  if (!Array.isArray(response.candidates)) {
    return [];
  }

  return response.candidates.flatMap((candidate) => {
    if (!isRecord(candidate) || !isRecord(candidate.content)) {
      return [];
    }
    return Array.isArray(candidate.content.parts)
      ? candidate.content.parts
      : [];
  });
}

function parseGeminiInlineMediaItem(
  item: unknown,
  position: number
): ImageArtifact {
  if (!isRecord(item)) {
    throw new ImageArtifactError(
      'IMAGE_ARTIFACT_INVALID_SOURCE',
      `${describePosition(position)}缺少图片来源`,
      position
    );
  }

  const data = getNonEmptyString(item.data);
  const url = getNonEmptyString(item.url);
  const mimeType =
    getNonEmptyString(item.mimeType) || getNonEmptyString(item.mime_type);

  if (data) {
    return createInlineArtifact(data, mimeType, position);
  }
  if (url) {
    return normalizeSource({ value: url, mimeType }, position);
  }

  throw new ImageArtifactError(
    'IMAGE_ARTIFACT_INVALID_SOURCE',
    `${describePosition(position)}缺少图片来源`,
    position
  );
}

/**
 * Normalize Google generateContent image parts. Text parts are intentionally
 * ignored; malformed media parts fail the whole response before persistence.
 */
export function parseGeminiImageArtifacts(response: unknown): ImageArtifact[] {
  if (!isRecord(response)) {
    throw new ImageArtifactError(
      'IMAGE_ARTIFACT_EMPTY_RESULT',
      '图片响应未包含任何结果'
    );
  }

  const candidateParts = collectGeminiCandidateParts(response);
  const candidateArtifacts: ImageArtifact[] = [];
  for (const part of candidateParts) {
    const artifact = parseGeminiPart(part, candidateArtifacts.length);
    if (artifact) {
      candidateArtifacts.push(artifact);
    }
  }
  if (candidateArtifacts.length > 0) {
    return candidateArtifacts;
  }

  if (Array.isArray(response.inlineMedia)) {
    const inlineMediaArtifacts = response.inlineMedia.map((item, position) =>
      parseGeminiInlineMediaItem(item, position)
    );
    if (inlineMediaArtifacts.length > 0) {
      return inlineMediaArtifacts;
    }
  }

  throw new ImageArtifactError(
    'IMAGE_ARTIFACT_EMPTY_RESULT',
    '图片响应未包含任何结果'
  );
}
