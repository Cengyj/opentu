export type DefaultModelVendor = 'gpt' | 'other';
export type DefaultModelFamily = 'gpt-image' | 'gpt-text' | 'unknown';
export type DefaultModelVariantTag =
  | 'canonical'
  | 'compact'
  | 'draw'
  | 'legacy'
  | 'proxy'
  | 'retired';
export type DefaultModelHiddenReason =
  | 'compact'
  | 'draw'
  | 'retired'
  | 'non-gpt'
  | 'unknown';

export interface DefaultModelClassification {
  id: string;
  normalizedId: string;
  vendor: DefaultModelVendor;
  family: DefaultModelFamily;
  variantTags: DefaultModelVariantTag[];
  visibleByDefault: boolean;
  hiddenReason: DefaultModelHiddenReason | null;
}

export interface HiddenDefaultModelReportItem {
  id: string;
  hiddenReason: DefaultModelHiddenReason;
  vendor: DefaultModelVendor;
  family: DefaultModelFamily;
  variantTags: DefaultModelVariantTag[];
}

export interface DefaultModelVisibilityReport {
  visibleModelIds: string[];
  hiddenModels: HiddenDefaultModelReportItem[];
}

export const DEFAULT_MODEL_VISIBILITY_POLICY_SUMMARY = [
  'visible defaults must be GPT models',
  'visible defaults must be canonical GPT text or GPT image variants',
  'compact/proxy variants are hidden',
  'gpt-draw variants are hidden',
  'legacy/retired variants are hidden',
  'non-GPT and unknown variants are hidden',
] as const;

const RETIRED_DEFAULT_MODEL_IDS = new Set(['gpt-image-2-vip']);
const GPT_TEXT_CANONICAL_SUFFIXES = new Set([
  '',
  'mini',
  'pro',
  'codex',
  'chat-latest',
]);

function getModelIdFromListItem(item: unknown): string {
  if (typeof item === 'string') {
    return item;
  }
  const id = (item as { id?: unknown } | null)?.id;
  return typeof id === 'string' ? id : '';
}

function stripRoutingVariantTokens(tokens: string[]): string[] {
  if (tokens[tokens.length - 1] !== 'compact') {
    return tokens;
  }

  const compactPrefix = tokens.slice(0, -1);
  const prefixLast = compactPrefix[compactPrefix.length - 1];
  if (prefixLast === 'openai' || prefixLast === 'proxy') {
    return compactPrefix.slice(0, -1);
  }
  return compactPrefix;
}

function getFamily(tokens: string[]): DefaultModelFamily {
  const familyTokens = stripRoutingVariantTokens(tokens);
  if (tokens[0] !== 'gpt') {
    return 'unknown';
  }

  if (
    familyTokens[1] === 'image' &&
    /^\d+(?:\.\d+)?$/.test(familyTokens[2] || '')
  ) {
    return 'gpt-image';
  }

  if (!/^\d+(?:\.\d+)?[a-z]?$/.test(familyTokens[1] || '')) {
    return 'unknown';
  }

  return 'gpt-text';
}

function isCanonicalDefaultVariant(
  tokens: string[],
  family: DefaultModelFamily
): boolean {
  if (family === 'gpt-image') {
    return tokens[0] === 'gpt' && tokens[1] === 'image' && tokens.length === 3;
  }

  if (family === 'gpt-text') {
    const suffix = tokens.slice(2).join('-');
    return GPT_TEXT_CANONICAL_SUFFIXES.has(suffix);
  }

  return false;
}

function getHiddenReason(
  vendor: DefaultModelVendor,
  family: DefaultModelFamily,
  variantTags: DefaultModelVariantTag[]
): DefaultModelHiddenReason | null {
  if (vendor !== 'gpt') {
    return 'non-gpt';
  }
  if (variantTags.includes('retired') || variantTags.includes('legacy')) {
    return 'retired';
  }
  if (variantTags.includes('draw')) {
    return 'draw';
  }
  if (variantTags.includes('compact')) {
    return 'compact';
  }
  if (family === 'unknown' || !variantTags.includes('canonical')) {
    return 'unknown';
  }
  return null;
}

export function classifyDefaultModelId(
  modelId: string
): DefaultModelClassification {
  const id = modelId.trim();
  const normalizedId = id.toLowerCase();
  const tokens = normalizedId.split('-').filter(Boolean);
  const vendor: DefaultModelVendor = normalizedId.startsWith('gpt-')
    ? 'gpt'
    : 'other';
  const variantTags = new Set<DefaultModelVariantTag>();

  if (RETIRED_DEFAULT_MODEL_IDS.has(normalizedId)) {
    variantTags.add('legacy');
    variantTags.add('retired');
  }
  if (tokens[0] === 'gpt' && tokens[1] === 'draw') {
    variantTags.add('draw');
  }
  if (tokens[tokens.length - 1] === 'compact') {
    variantTags.add('compact');
    if (tokens.includes('openai') || tokens.includes('proxy')) {
      variantTags.add('proxy');
    }
  }

  const family = vendor === 'gpt' ? getFamily(tokens) : 'unknown';
  if (vendor === 'gpt' && isCanonicalDefaultVariant(tokens, family)) {
    variantTags.add('canonical');
  }
  const hiddenReason = getHiddenReason(
    vendor,
    family,
    Array.from(variantTags)
  );

  return {
    id,
    normalizedId,
    vendor,
    family,
    variantTags: Array.from(variantTags),
    visibleByDefault: hiddenReason === null,
    hiddenReason,
  };
}

export function isDefaultProviderDisplayModel(modelId: string): boolean {
  return classifyDefaultModelId(modelId).visibleByDefault;
}

export function buildDefaultModelVisibilityReportFromModelListResponse(
  response: unknown
): DefaultModelVisibilityReport {
  const data = (response as { data?: unknown } | null)?.data;
  if (!Array.isArray(data)) {
    throw new Error('ForOpenCode /v1/models response must contain data[]');
  }

  const seen = new Set<string>();
  const visibleModelIds: string[] = [];
  const hiddenModels: HiddenDefaultModelReportItem[] = [];

  for (const item of data) {
    const id = getModelIdFromListItem(item).trim();
    if (!id) {
      continue;
    }

    const classification = classifyDefaultModelId(id);
    if (seen.has(classification.normalizedId)) {
      continue;
    }
    seen.add(classification.normalizedId);

    if (classification.visibleByDefault) {
      visibleModelIds.push(id);
      continue;
    }

    hiddenModels.push({
      id,
      hiddenReason: classification.hiddenReason || 'unknown',
      vendor: classification.vendor,
      family: classification.family,
      variantTags: classification.variantTags,
    });
  }

  return { visibleModelIds, hiddenModels };
}
