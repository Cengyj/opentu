export type ImageResolutionTier = '1k' | '2k' | '4k';
export type OfficialGPTImageQuality = 'auto' | 'low' | 'medium' | 'high';

type GPTImageAspectRatioKey =
  | '1x1'
  | '2x3'
  | '3x2'
  | '3x4'
  | '4x3'
  | '4x5'
  | '5x4'
  | '9x16'
  | '16x9'
  | '21x9';

type LegacyGPTImageAspectRatioKey = '1x1' | '2x3' | '3x2';

const GPT_IMAGE_2_MODEL_IDS = new Set(['gpt-image-2']);
const LEGACY_GPT_IMAGE_MODEL_IDS = new Set(['gpt-image-1', 'gpt-image-1.5']);

const OFFICIAL_GPT_IMAGE_QUALITY_VALUES = new Set<OfficialGPTImageQuality>([
  'auto',
  'low',
  'medium',
  'high',
]);

const LEGACY_RESOLUTION_VALUES = new Set<ImageResolutionTier>([
  '1k',
  '2k',
  '4k',
]);

const GPT_IMAGE_2_SIZE_MATRIX: Record<
  ImageResolutionTier,
  Record<GPTImageAspectRatioKey, string>
> = {
  '1k': {
    '1x1': '1024x1024',
    '2x3': '832x1248',
    '3x2': '1248x832',
    '3x4': '880x1184',
    '4x3': '1184x880',
    '4x5': '912x1152',
    '5x4': '1152x912',
    '9x16': '768x1360',
    '16x9': '1360x768',
    '21x9': '1568x672',
  },
  '2k': {
    '1x1': '2048x2048',
    '2x3': '1680x2512',
    '3x2': '2512x1680',
    '3x4': '1776x2368',
    '4x3': '2368x1776',
    '4x5': '1824x2288',
    '5x4': '2288x1824',
    '9x16': '1536x2736',
    '16x9': '2736x1536',
    '21x9': '3136x1344',
  },
  '4k': {
    '1x1': '2880x2880',
    '2x3': '2352x3520',
    '3x2': '3520x2352',
    '3x4': '2480x3312',
    '4x3': '3312x2480',
    '4x5': '2576x3216',
    '5x4': '3216x2576',
    '9x16': '2160x3840',
    '16x9': '3840x2160',
    '21x9': '3840x1632',
  },
};

const LEGACY_GPT_IMAGE_SIZE_BY_RATIO: Record<
  LegacyGPTImageAspectRatioKey,
  string
> = {
  '1x1': '1024x1024',
  '2x3': '1024x1536',
  '3x2': '1536x1024',
};

const LEGACY_GPT_IMAGE_SIZES = new Set(
  Object.values(LEGACY_GPT_IMAGE_SIZE_BY_RATIO).concat('auto')
);
const OFFICIAL_GPT_IMAGE_EDIT_SIZES = new Set([
  'auto',
  '1024x1024',
  '1536x1024',
  '1024x1536',
]);

const KNOWN_GPT_IMAGE_RATIOS = new Set<GPTImageAspectRatioKey>([
  '1x1',
  '2x3',
  '3x2',
  '3x4',
  '4x3',
  '4x5',
  '5x4',
  '9x16',
  '16x9',
  '21x9',
]);

function getNormalizedString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim()
    ? value.trim().toLowerCase()
    : undefined;
}

function parsePixelSize(
  value: string
): { width: number; height: number } | undefined {
  const match = value.match(/^(\d+)x(\d+)$/);
  if (!match) {
    return undefined;
  }

  const width = Number(match[1]);
  const height = Number(match[2]);
  if (!width || !height) {
    return undefined;
  }

  return { width, height };
}

function gcd(a: number, b: number): number {
  return b === 0 ? a : gcd(b, a % b);
}

function isPixelSize(value: string): boolean {
  const parsed = parsePixelSize(value);
  return !!parsed && (parsed.width > 32 || parsed.height > 32);
}

function resolveKnownAspectRatio(
  size?: string
): GPTImageAspectRatioKey | undefined {
  const normalized = size?.trim().toLowerCase().replace(':', 'x');
  if (!normalized || normalized === 'auto') {
    return undefined;
  }

  if (KNOWN_GPT_IMAGE_RATIOS.has(normalized as GPTImageAspectRatioKey)) {
    return normalized as GPTImageAspectRatioKey;
  }

  const parsed = parsePixelSize(normalized);
  if (!parsed) {
    return undefined;
  }

  const divisor = gcd(parsed.width, parsed.height);
  const ratioKey = `${parsed.width / divisor}x${parsed.height / divisor}`;
  if (KNOWN_GPT_IMAGE_RATIOS.has(ratioKey as GPTImageAspectRatioKey)) {
    return ratioKey as GPTImageAspectRatioKey;
  }

  if (parsed.width === parsed.height) {
    return '1x1';
  }

  return parsed.width > parsed.height ? '16x9' : '9x16';
}

/** gpt-image-2 官方自定义尺寸约束（与 OpenAI 文档一致） */
export const GPT_IMAGE_2_SIZE_STEP = 16; // 宽高必须是 16 的倍数
export const GPT_IMAGE_2_MAX_LONG_EDGE = 3840; // 长边不超过 4K
export const GPT_IMAGE_2_MAX_EDGE_RATIO = 3; // 长宽比不超过 3:1
export const GPT_IMAGE_2_MIN_PIXELS = 655_360; // 约 0.66MP
export const GPT_IMAGE_2_MAX_PIXELS = 8_294_400; // 约 8.29MP（4K）

export function isValidGPTImage2PixelSize(
  width: number,
  height: number
): boolean {
  const longEdge = Math.max(width, height);
  const shortEdge = Math.min(width, height);
  const totalPixels = width * height;

  if (longEdge > GPT_IMAGE_2_MAX_LONG_EDGE) {
    return false;
  }
  if (
    width % GPT_IMAGE_2_SIZE_STEP !== 0 ||
    height % GPT_IMAGE_2_SIZE_STEP !== 0
  ) {
    return false;
  }
  if (shortEdge === 0 || longEdge / shortEdge > GPT_IMAGE_2_MAX_EDGE_RATIO) {
    return false;
  }
  return (
    totalPixels >= GPT_IMAGE_2_MIN_PIXELS &&
    totalPixels <= GPT_IMAGE_2_MAX_PIXELS
  );
}

function roundToStep(value: number): number {
  return Math.round(value / GPT_IMAGE_2_SIZE_STEP) * GPT_IMAGE_2_SIZE_STEP;
}

function floorToStep(value: number): number {
  return Math.floor(value / GPT_IMAGE_2_SIZE_STEP) * GPT_IMAGE_2_SIZE_STEP;
}

/**
 * 将任意宽高吸附到最近的合法 gpt-image-2 尺寸：
 * 16 倍数 → 夹长边 ≤3840 → 收紧 3:1 → 按面积夹到 [0.66MP, 8.29MP]。
 * 缩放保持比例，因此前序约束不会被后序破坏。
 */
export function snapToValidGPTImage2Size(
  rawWidth: number,
  rawHeight: number
): { width: number; height: number } {
  const clampDim = (value: number): number => {
    if (!Number.isFinite(value) || value <= 0) {
      return GPT_IMAGE_2_SIZE_STEP;
    }
    const snapped = roundToStep(value);
    return Math.min(
      Math.max(snapped, GPT_IMAGE_2_SIZE_STEP),
      GPT_IMAGE_2_MAX_LONG_EDGE
    );
  };

  let width = clampDim(rawWidth);
  let height = clampDim(rawHeight);

  // 收紧到 3:1：缩短长边到短边的 3 倍
  const shortEdge = Math.min(width, height);
  const maxLong = Math.max(
    floorToStep(shortEdge * GPT_IMAGE_2_MAX_EDGE_RATIO),
    GPT_IMAGE_2_SIZE_STEP
  );
  if (width >= height) {
    width = Math.min(width, maxLong);
  } else {
    height = Math.min(height, maxLong);
  }

  // 等比缩放夹住总像素上限
  const total = width * height;
  if (total > GPT_IMAGE_2_MAX_PIXELS) {
    const scale = Math.sqrt(GPT_IMAGE_2_MAX_PIXELS / total);
    width = Math.max(floorToStep(width * scale), GPT_IMAGE_2_SIZE_STEP);
    height = Math.max(floorToStep(height * scale), GPT_IMAGE_2_SIZE_STEP);
  } else if (total < GPT_IMAGE_2_MIN_PIXELS) {
    const scale = Math.sqrt(GPT_IMAGE_2_MIN_PIXELS / total);
    width = Math.min(roundToStep(width * scale), GPT_IMAGE_2_MAX_LONG_EDGE);
    height = Math.min(roundToStep(height * scale), GPT_IMAGE_2_MAX_LONG_EDGE);
    // 向上取整后可能仍略低于下限，逐级补一个 step 直到达标
    while (
      width * height < GPT_IMAGE_2_MIN_PIXELS &&
      (width < GPT_IMAGE_2_MAX_LONG_EDGE || height < GPT_IMAGE_2_MAX_LONG_EDGE)
    ) {
      if (width <= height && width < GPT_IMAGE_2_MAX_LONG_EDGE) {
        width += GPT_IMAGE_2_SIZE_STEP;
      } else if (height < GPT_IMAGE_2_MAX_LONG_EDGE) {
        height += GPT_IMAGE_2_SIZE_STEP;
      } else {
        width = Math.min(
          width + GPT_IMAGE_2_SIZE_STEP,
          GPT_IMAGE_2_MAX_LONG_EDGE
        );
      }
    }
  }

  return { width, height };
}

export interface GPTImage2SizeInfo {
  width: number;
  height: number;
  /** 化简后的比例标签，如 "3:2" */
  ratioLabel: string;
  /** 百万像素 */
  megaPixels: number;
  /** 估算分辨率档位 */
  tier: ImageResolutionTier;
  valid: boolean;
}

/** 根据像素宽高生成 UI 展示所需的比例 / 像素 / 档位信息 */
export function getGPTImage2SizeInfo(
  width: number,
  height: number
): GPTImage2SizeInfo {
  const safeWidth = Math.max(Math.round(width) || 0, 0);
  const safeHeight = Math.max(Math.round(height) || 0, 0);
  const divisor = gcd(safeWidth, safeHeight) || 1;
  const ratioLabel =
    safeWidth && safeHeight
      ? `${safeWidth / divisor}:${safeHeight / divisor}`
      : '—';
  const totalPixels = safeWidth * safeHeight;
  const megaPixels = totalPixels / 1_000_000;
  const tier: ImageResolutionTier =
    totalPixels <= 1_600_000 ? '1k' : totalPixels <= 5_000_000 ? '2k' : '4k';

  return {
    width: safeWidth,
    height: safeHeight,
    ratioLabel,
    megaPixels,
    tier,
    valid: isValidGPTImage2PixelSize(safeWidth, safeHeight),
  };
}

function toLegacyAspectRatio(
  aspectRatio: GPTImageAspectRatioKey
): LegacyGPTImageAspectRatioKey {
  if (aspectRatio === '1x1') {
    return '1x1';
  }

  const portraitRatios = new Set<GPTImageAspectRatioKey>([
    '2x3',
    '3x4',
    '4x5',
    '9x16',
  ]);

  return portraitRatios.has(aspectRatio) ? '2x3' : '3x2';
}

export function isGPTImage2Model(modelId?: string | null): boolean {
  return !!modelId && GPT_IMAGE_2_MODEL_IDS.has(modelId);
}

export function isLegacyGPTImageModel(modelId?: string | null): boolean {
  return !!modelId && LEGACY_GPT_IMAGE_MODEL_IDS.has(modelId);
}

/** 将形如 "1536x1024" / "1536X1024" 的字符串解析为像素宽高 */
export function parseGPTImage2PixelSize(
  value: unknown
): { width: number; height: number } | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }
  return parsePixelSize(value.trim().toLowerCase());
}

/**
 * 判断某个 size 参数值是否可接受：
 * - 命中 enum options 列表 → 合法
 * - 参数声明 allowCustomPixelSize 且值是合法的 gpt-image-2 自定义像素串 → 合法
 * 供持久化校验闸（sanitize / AIInputBar）统一复用，避免各处重复实现判定。
 */
export function isAcceptableSizeValue(
  param:
    | {
        options?: Array<{ value: string }>;
        allowCustomPixelSize?: boolean;
      }
    | undefined,
  value: string | undefined
): boolean {
  if (!param || !value) {
    return false;
  }
  if (param.options?.some((option) => option.value === value)) {
    return true;
  }
  if (param.allowCustomPixelSize) {
    const parsed = parseGPTImage2PixelSize(value);
    return !!parsed && isValidGPTImage2PixelSize(parsed.width, parsed.height);
  }
  return false;
}

export function normalizeImageResolutionTier(
  value: unknown
): ImageResolutionTier | undefined {
  const normalized = getNormalizedString(value);
  if (
    normalized &&
    LEGACY_RESOLUTION_VALUES.has(normalized as ImageResolutionTier)
  ) {
    return normalized as ImageResolutionTier;
  }
  return undefined;
}

export function resolveImageResolutionTier(
  params?: Record<string, unknown>
): ImageResolutionTier | undefined {
  return (
    normalizeImageResolutionTier(params?.resolution) ||
    normalizeImageResolutionTier(params?.quality)
  );
}

export function normalizeOfficialGPTImageQuality(
  value: unknown
): OfficialGPTImageQuality | undefined {
  const normalized = getNormalizedString(value);
  if (
    normalized &&
    OFFICIAL_GPT_IMAGE_QUALITY_VALUES.has(normalized as OfficialGPTImageQuality)
  ) {
    return normalized as OfficialGPTImageQuality;
  }
  return undefined;
}

export function resolveOfficialGPTImageQuality(
  params?: Record<string, unknown>
): OfficialGPTImageQuality | undefined {
  return normalizeOfficialGPTImageQuality(params?.quality);
}

export function resolveOfficialGPTImageSize(
  modelId: string | undefined,
  size?: string,
  params?: Record<string, unknown>
): string | undefined {
  const normalizedSize = size?.trim().toLowerCase().replace(':', 'x');
  if (!normalizedSize || normalizedSize === 'auto') {
    return undefined;
  }

  const parsedPixelSize = parsePixelSize(normalizedSize);
  const useLegacySizing = isLegacyGPTImageModel(modelId);

  if (parsedPixelSize && isPixelSize(normalizedSize)) {
    if (isGPTImage2Model(modelId)) {
      if (
        isValidGPTImage2PixelSize(parsedPixelSize.width, parsedPixelSize.height)
      ) {
        return normalizedSize;
      }
    } else if (useLegacySizing && LEGACY_GPT_IMAGE_SIZES.has(normalizedSize)) {
      return normalizedSize;
    }
  }

  const aspectRatio = resolveKnownAspectRatio(normalizedSize);
  if (!aspectRatio) {
    return undefined;
  }

  if (useLegacySizing) {
    return LEGACY_GPT_IMAGE_SIZE_BY_RATIO[toLegacyAspectRatio(aspectRatio)];
  }

  const resolution = resolveImageResolutionTier(params) || '1k';
  return GPT_IMAGE_2_SIZE_MATRIX[resolution][aspectRatio];
}

export function resolveOfficialGPTImageEditSize(
  modelId: string | undefined,
  size?: string,
  params?: Record<string, unknown>
): string | undefined {
  if (isGPTImage2Model(modelId)) {
    return resolveOfficialGPTImageSize(modelId, size, params);
  }

  const normalizedSize = size?.trim().toLowerCase().replace(':', 'x');
  if (!normalizedSize || normalizedSize === 'auto') {
    return undefined;
  }

  if (OFFICIAL_GPT_IMAGE_EDIT_SIZES.has(normalizedSize)) {
    return normalizedSize;
  }

  const parsedPixelSize = parsePixelSize(normalizedSize);
  if (parsedPixelSize) {
    if (parsedPixelSize.width === parsedPixelSize.height) {
      return '1024x1024';
    }

    return parsedPixelSize.width > parsedPixelSize.height
      ? '1536x1024'
      : '1024x1536';
  }

  const aspectRatio = resolveKnownAspectRatio(normalizedSize);
  if (!aspectRatio) {
    return undefined;
  }

  if (aspectRatio === '1x1') {
    return '1024x1024';
  }

  const portraitRatios = new Set<GPTImageAspectRatioKey>([
    '2x3',
    '3x4',
    '4x5',
    '9x16',
  ]);

  return portraitRatios.has(aspectRatio) ? '1024x1536' : '1536x1024';
}
