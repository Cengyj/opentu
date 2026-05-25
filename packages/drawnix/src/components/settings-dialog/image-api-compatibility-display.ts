import {
  type ImageApiCompatibility,
  type ProviderProfile,
} from '../../utils/settings-manager';

export const IMAGE_API_COMPATIBILITY_META: Record<
  ImageApiCompatibility,
  { label: string }
> = {
  auto: {
    label: '自动',
  },
  'openai-gpt-image': {
    label: 'OpenAI GPT Image',
  },
  'openai-compatible-basic': {
    label: 'OpenAI-compatible 通用兼容（兜底）',
  },
};

function normalizeImageApiCompatibilityForDisplay(
  value?: ImageApiCompatibility | string | null
): ImageApiCompatibility {
  if (
    value === 'auto' ||
    value === 'openai-gpt-image' ||
    value === 'openai-compatible-basic'
  ) {
    return value;
  }

  if (
    value === 'for-gpt-image' ||
    value === 'tuzi-gpt-image' ||
    value === 'tuzi-compatible'
  ) {
    return 'openai-gpt-image';
  }

  return 'auto';
}

function isForOpenCodeBaseUrl(baseUrl: string): boolean {
  const trimmed = baseUrl.trim();
  if (!trimmed) {
    return false;
  }

  try {
    const url = new URL(
      /^[a-z][a-z\d+\-.]*:\/\//i.test(trimmed)
        ? trimmed
        : `https://${trimmed}`
    );
    return url.hostname.toLowerCase() === 'foropencode.com';
  } catch {
    return false;
  }
}

function resolveAutoImageApiCompatibilityForDisplay(
  profile: Pick<ProviderProfile, 'baseUrl'>
): Exclude<ImageApiCompatibility, 'auto'> {
  const normalizedBaseUrl = profile.baseUrl.trim().toLowerCase();

  if (
    normalizedBaseUrl.includes('api.openai.com') ||
    isForOpenCodeBaseUrl(profile.baseUrl)
  ) {
    return 'openai-gpt-image';
  }

  return 'openai-compatible-basic';
}

export function getImageApiCompatibilityHint(
  profile: Pick<ProviderProfile, 'baseUrl' | 'imageApiCompatibility'>
): string {
  const storedCompatibility = normalizeImageApiCompatibilityForDisplay(
    profile.imageApiCompatibility
  );

  if (storedCompatibility === 'auto') {
    const resolvedCompatibility =
      resolveAutoImageApiCompatibilityForDisplay(profile);
    return `默认推荐显式选择 OpenAI GPT Image；如果保留自动模式，GPT Image 模型当前会解析为 ${IMAGE_API_COMPATIBILITY_META[resolvedCompatibility].label}。`;
  }

  if (storedCompatibility === 'openai-gpt-image') {
    return '默认推荐模式。适用于官方 GPT Image 请求格式，也便于后续继续扩展官方图生图能力。';
  }

  return `同一个图片模型在不同 API Key 或网关下可能需要不同接口格式；当前已固定为 ${IMAGE_API_COMPATIBILITY_META[storedCompatibility].label}。`;
}
