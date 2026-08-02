import {
  providerPricingCacheSettings,
  type ProviderProfile,
} from './settings-manager';
import type {
  ModelPrice,
  NewApiGroupModelPricing,
  NewApiPricingApiResponse,
  NewApiPricingModelInfo,
  PricingApiResponse,
  PricingEndpointInfo,
  PricingGroup,
  PricingGroupPrice,
  ProviderPricingCache,
  ForPricingApiResponse,
} from './model-pricing-types';
import {
  buildProviderCredentialIdentity,
  IMAGE_ROUTING_EVIDENCE_VERSION,
} from './image-routing-evidence';

type PricingListener = () => void;
type FetchAndCacheOptions = {
  force?: boolean;
  promoteToAutoRefresh?: boolean;
};

type ResolvedProviderPricingConfig = {
  pricingUrl: string;
  pricingGroup: string;
  cnyPerUsd: number;
};

type SharedPricingResponseCacheEntry = {
  fetchedAt: number;
  ttlMs: number;
  response: PricingApiResponse;
};

type ProfilePricingRequestState = {
  sequence: number;
  sourceSignature: string;
  promoteToAutoRefresh: boolean;
};

type ProfilePricingRequest = {
  state: ProfilePricingRequestState;
  promise: Promise<ProviderPricingCache>;
};

const DEFAULT_API_HOST = 'foropencode.com';
const DEFAULT_GROUP_NAME = 'default';
export const DEFAULT_FOR_CNY_PER_USD = 0.7;
export const MODEL_PRICING_CACHE_TTL_MS = 5 * 60 * 1000;
export const FOR_PRICING_CACHE_TTL_MS = 24 * 60 * 60 * 1000;

function round4(v: number): number {
  return Math.round(v * 10000) / 10000;
}

function normalizePricingUrl(pricingUrl: string): string {
  return pricingUrl.trim();
}

function stripPricingUrlSearch(pricingUrl: string): string {
  const normalized = normalizePricingUrl(pricingUrl);
  if (!normalized) return normalized;
  try {
    const url = new URL(normalized);
    return `${url.origin}${url.pathname}`;
  } catch {
    return normalized.split('?')[0];
  }
}

function buildPricingUrlSourceIdentity(pricingUrl: string): string {
  const normalized = normalizePricingUrl(pricingUrl);
  if (!normalized) return normalized;

  const buildIdentity = (baseUrl: string, rawSearch: string): string => {
    const exactSearch = rawSearch.startsWith('?')
      ? rawSearch.slice(1)
      : rawSearch;
    return exactSearch
      ? `${baseUrl}\nquery:${buildProviderCredentialIdentity(
          `query:${exactSearch}`
        )}`
      : baseUrl;
  };

  try {
    const url = new URL(normalized);
    const authorityIdentity =
      url.username || url.password
        ? `\nauthority:${buildProviderCredentialIdentity(
            `authority:${url.username}:${url.password}`
          )}`
        : '';
    return buildIdentity(
      `${url.origin}${url.pathname}${authorityIdentity}`,
      url.search
    );
  } catch {
    const withoutFragment = normalized.split('#', 1)[0];
    const queryIndex = withoutFragment.indexOf('?');
    if (queryIndex < 0) {
      return withoutFragment;
    }
    return buildIdentity(
      withoutFragment.slice(0, queryIndex),
      withoutFragment.slice(queryIndex + 1)
    );
  }
}

export function derivePricingUrl(baseUrl: string): string {
  try {
    const origin = new URL(baseUrl).origin;
    return `${origin}/api/pricing`;
  } catch {
    return '';
  }
}

function isForPricingProvider(baseUrl: string): boolean {
  try {
    const hostname = new URL(baseUrl).hostname.toLowerCase();
    return hostname === DEFAULT_API_HOST;
  } catch {
    return false;
  }
}

function isBuiltInPricingUrl(pricingUrl: string): boolean {
  const normalized = normalizePricingUrl(pricingUrl);
  if (!normalized) return false;

  try {
    const url = new URL(normalized);
    const hostname = url.hostname.toLowerCase();
    return hostname === DEFAULT_API_HOST && url.pathname === '/api/pricing';
  } catch {
    return (
      stripPricingUrlSearch(normalized) ===
      `https://${DEFAULT_API_HOST}/api/pricing`
    );
  }
}

export function getPricingCacheTtlMs(pricingUrl: string): number {
  return isBuiltInPricingUrl(pricingUrl)
    ? FOR_PRICING_CACHE_TTL_MS
    : MODEL_PRICING_CACHE_TTL_MS;
}

export function buildPricingSourceSignature(
  pricingUrl: string,
  groupName: string,
  cnyPerUsd: number,
  apiKey: string
): string {
  return `${buildPricingUrlSourceIdentity(pricingUrl)}\n${
    groupName || DEFAULT_GROUP_NAME
  }\n${round4(cnyPerUsd)}\ncredential:${buildProviderCredentialIdentity(
    apiKey
  )}`;
}

function stripPricingCredentialIdentity(sourceSignature: string): string {
  return sourceSignature.replace(/\ncredential:[^\n]*$/, '');
}

export function isPricingCacheEligibleForWarmup(
  cache: ProviderPricingCache | null | undefined,
  sourceSignature: string
): boolean {
  if (!cache) {
    return false;
  }

  if (typeof cache.autoRefreshSourceSignature === 'string') {
    return (
      cache.autoRefreshSourceSignature === sourceSignature ||
      stripPricingCredentialIdentity(cache.autoRefreshSourceSignature) ===
        stripPricingCredentialIdentity(sourceSignature)
    );
  }

  if (cache.autoRefreshSourceSignature === null) {
    return false;
  }

  // 兼容旧缓存：历史版本没有显式标记时，保留当前签名的自动刷新能力。
  return (
    cache.sourceSignature === sourceSignature ||
    (typeof cache.sourceSignature === 'string' &&
      stripPricingCredentialIdentity(cache.sourceSignature) ===
        stripPricingCredentialIdentity(sourceSignature))
  );
}

export function resolveProviderPricingConfig(
  profile: Pick<
    ProviderProfile,
    'baseUrl' | 'pricingUrl' | 'pricingGroup' | 'cnyPerUsd'
  >
): ResolvedProviderPricingConfig | null {
  const explicitPricingUrl = normalizePricingUrl(profile.pricingUrl || '');
  const pricingUrl =
    explicitPricingUrl ||
    (profile.baseUrl ? derivePricingUrl(profile.baseUrl) : '');

  if (!pricingUrl) {
    return null;
  }

  return {
    pricingUrl,
    pricingGroup: profile.pricingGroup || DEFAULT_GROUP_NAME,
    cnyPerUsd:
      profile.cnyPerUsd ??
      (isForPricingProvider(profile.baseUrl || '')
        ? DEFAULT_FOR_CNY_PER_USD
        : 1),
  };
}

function toFiniteNumber(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function toOptionalFiniteNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value)
    ? value
    : undefined;
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function isForPricingResponse(
  json: PricingApiResponse
): json is ForPricingApiResponse {
  return (
    isPlainRecord(json.data) &&
    isPlainRecord(json.data.group_info) &&
    Array.isArray(json.data.model_info)
  );
}

function isNewApiPricingResponse(
  json: PricingApiResponse
): json is NewApiPricingApiResponse {
  const candidate = json as Partial<NewApiPricingApiResponse>;
  return (
    Array.isArray(json.data) &&
    (!candidate.group_ratio || isPlainRecord(candidate.group_ratio)) &&
    (!candidate.usable_group || isPlainRecord(candidate.usable_group)) &&
    (!candidate.group_info || isPlainRecord(candidate.group_info)) &&
    (!candidate.group_model_pricing ||
      isPlainRecord(candidate.group_model_pricing))
  );
}

function isSupportedPricingResponse(json: PricingApiResponse): boolean {
  return isForPricingResponse(json) || isNewApiPricingResponse(json);
}

function computeModelPrice(
  gp: PricingGroupPrice,
  groupRatio: number,
  cnyPerUsd: number
): ModelPrice {
  // quota_type=1: token 计费（用 model_ratio）
  if (gp.quota_type === 1) {
    const inputUsd = round4(gp.model_ratio * 2 * groupRatio);
    const outputUsd = round4(
      gp.model_ratio * 2 * gp.model_completion_ratio * groupRatio
    );
    return {
      inputCnyMtok: round4(inputUsd * cnyPerUsd),
      outputCnyMtok: round4(outputUsd * cnyPerUsd),
      flatCny: null,
      billingType: 'token',
    };
  }
  // quota_type=0: 按次计费, quota_type=2: 按秒计费（都用 model_price）
  const flatUsd = round4(gp.model_price * groupRatio);
  return {
    inputCnyMtok: null,
    outputCnyMtok: null,
    flatCny: round4(flatUsd * cnyPerUsd),
    billingType: gp.quota_type === 2 ? 'per-second' : 'flat',
  };
}

function extractTieredPerSecondPrices(
  billingExpr: string | undefined,
  groupRatio: number,
  cnyPerUsd: number
): Array<{ label: string; perSecondCny: number }> {
  if (!billingExpr) return [];

  const tiers: Array<{ label: string; perSecondCny: number }> = [];
  const tierPattern =
    /tier\(\s*["']([^"']+)["']\s*,\s*sec\s*\*\s*(-?\d+(?:\.\d+)?)\s*\)/g;
  let match: RegExpExecArray | null;
  while ((match = tierPattern.exec(billingExpr)) !== null) {
    const label = match[1]?.trim();
    const usdPerSecond = Number(match[2]);
    if (!label || !Number.isFinite(usdPerSecond)) {
      continue;
    }
    tiers.push({
      label,
      perSecondCny: round4(usdPerSecond * groupRatio * cnyPerUsd),
    });
  }

  return tiers;
}

function computeNewApiModelPrice(
  model: NewApiPricingModelInfo,
  groupRatio: number,
  cnyPerUsd: number,
  groupModelPricing?: NewApiGroupModelPricing
): ModelPrice {
  if (model.billing_mode === 'tiered_expr') {
    const tieredCny = extractTieredPerSecondPrices(
      model.billing_expr,
      groupRatio,
      cnyPerUsd
    );
    if (tieredCny.length > 0) {
      return {
        inputCnyMtok: null,
        outputCnyMtok: null,
        flatCny: null,
        billingType: 'tiered',
        tieredCny,
      };
    }
  }

  const modelName = model.model_name;
  const quotaType =
    toOptionalFiniteNumber(groupModelPricing?.model_quota_type?.[modelName]) ??
    toOptionalFiniteNumber(groupModelPricing?.quota_type?.[modelName]) ??
    model.quota_type;
  const modelRatio =
    toOptionalFiniteNumber(groupModelPricing?.model_ratio?.[modelName]) ??
    toFiniteNumber(model.model_ratio);
  const modelPrice =
    toOptionalFiniteNumber(groupModelPricing?.model_price?.[modelName]) ??
    toFiniteNumber(model.model_price);

  if (quotaType === 2 && modelPrice > 0) {
    const flatUsd = round4(modelPrice * groupRatio);
    return {
      inputCnyMtok: null,
      outputCnyMtok: null,
      flatCny: round4(flatUsd * cnyPerUsd),
      billingType: 'per-second',
    };
  }

  // 分组 pricing 的 token 模型可能是 quota_type=1，但仍通过 model_ratio 计价。
  if (modelRatio > 0) {
    const completionRatio =
      toOptionalFiniteNumber(
        groupModelPricing?.model_completion_ratio?.[modelName]
      ) ?? toFiniteNumber(model.completion_ratio, 1);
    const inputUsd = round4(modelRatio * 2 * groupRatio);
    const outputUsd = round4(modelRatio * 2 * completionRatio * groupRatio);
    const cacheRatio =
      toOptionalFiniteNumber(
        groupModelPricing?.model_cache_ratio?.[modelName]
      ) ?? toOptionalFiniteNumber(model.cache_ratio);
    const createCacheRatio =
      toOptionalFiniteNumber(
        groupModelPricing?.model_create_cache_ratio?.[modelName]
      ) ?? toOptionalFiniteNumber(model.create_cache_ratio);
    const imageRatio =
      toOptionalFiniteNumber(
        groupModelPricing?.model_image_ratio?.[modelName]
      ) ?? toOptionalFiniteNumber(model.image_ratio);
    const audioRatio =
      toOptionalFiniteNumber(
        groupModelPricing?.model_audio_ratio?.[modelName]
      ) ?? toOptionalFiniteNumber(model.audio_ratio);
    const audioCompletionRatio =
      toOptionalFiniteNumber(
        groupModelPricing?.model_audio_completion_ratio?.[modelName]
      ) ?? toOptionalFiniteNumber(model.audio_completion_ratio);
    const toCnyMtok = (usd: number) => round4(usd * cnyPerUsd);

    return {
      inputCnyMtok: toCnyMtok(inputUsd),
      outputCnyMtok: toCnyMtok(outputUsd),
      cacheReadCnyMtok:
        cacheRatio != null ? toCnyMtok(inputUsd * cacheRatio) : null,
      cacheCreateCnyMtok:
        createCacheRatio != null
          ? toCnyMtok(inputUsd * createCacheRatio)
          : null,
      imageInputCnyMtok:
        imageRatio != null ? toCnyMtok(inputUsd * imageRatio) : null,
      audioInputCnyMtok:
        audioRatio != null ? toCnyMtok(inputUsd * audioRatio) : null,
      audioOutputCnyMtok:
        audioRatio != null && audioCompletionRatio != null
          ? toCnyMtok(inputUsd * audioRatio * audioCompletionRatio)
          : null,
      flatCny: null,
      billingType: 'token',
    };
  }

  const flatUsd = round4(modelPrice * groupRatio);
  return {
    inputCnyMtok: null,
    outputCnyMtok: null,
    flatCny: round4(flatUsd * cnyPerUsd),
    billingType: 'flat',
  };
}

function normalizeNewApiEndpointInfo(
  endpoint: PricingEndpointInfo | string | undefined
): PricingEndpointInfo | null {
  if (typeof endpoint === 'string') {
    const path = endpoint.trim();
    return path ? { path, method: 'POST' } : null;
  }

  if (!endpoint || typeof endpoint !== 'object') {
    return null;
  }

  const path = typeof endpoint.path === 'string' ? endpoint.path.trim() : '';
  const method =
    typeof endpoint.method === 'string' && endpoint.method.trim()
      ? endpoint.method.trim().toUpperCase()
      : undefined;
  const docs = typeof endpoint.docs === 'string' ? endpoint.docs.trim() : '';
  const label = typeof endpoint.label === 'string' ? endpoint.label.trim() : '';
  const description =
    typeof endpoint.description === 'string' ? endpoint.description.trim() : '';
  const scenario =
    typeof endpoint.scenario === 'string' ? endpoint.scenario.trim() : '';
  const highlights = Array.isArray(endpoint.highlights)
    ? endpoint.highlights.filter(
        (item): item is string => typeof item === 'string'
      )
    : undefined;
  const parameters = Array.isArray(endpoint.parameters)
    ? endpoint.parameters
    : undefined;
  const requestTemplate =
    endpoint.request_template !== undefined
      ? endpoint.request_template
      : undefined;

  if (
    !path &&
    !method &&
    !docs &&
    !label &&
    !description &&
    !scenario &&
    !highlights?.length &&
    !parameters?.length &&
    requestTemplate === undefined
  ) {
    return null;
  }

  return {
    ...(path ? { path } : {}),
    ...(method ? { method } : {}),
    ...(docs ? { docs } : {}),
    ...(label ? { label } : {}),
    ...(description ? { description } : {}),
    ...(scenario ? { scenario } : {}),
    ...(highlights?.length ? { highlights } : {}),
    ...(parameters?.length ? { parameters } : {}),
    ...(requestTemplate !== undefined
      ? { request_template: requestTemplate }
      : {}),
  };
}

function buildNewApiModelEndpoints(
  model: NewApiPricingModelInfo,
  supportedEndpoint: NewApiPricingApiResponse['supported_endpoint']
): Record<string, PricingEndpointInfo> | null {
  const endpointKeys = Array.isArray(model.supported_endpoint_types)
    ? model.supported_endpoint_types.map(String)
    : [];
  const endpointSources = [model.endpoints, supportedEndpoint].filter(
    Boolean
  ) as Array<Record<string, PricingEndpointInfo | string>>;

  if (endpointSources.length === 0) {
    return null;
  }

  const endpoints: Record<string, PricingEndpointInfo> = {};
  const keys =
    endpointKeys.length > 0
      ? endpointKeys
      : Array.from(
          new Set(endpointSources.flatMap((source) => Object.keys(source)))
        );

  for (const key of keys) {
    for (const source of endpointSources) {
      const endpointInfo = normalizeNewApiEndpointInfo(source[key]);
      if (endpointInfo) {
        endpoints[key] = endpointInfo;
        break;
      }
    }
  }

  return Object.keys(endpoints).length > 0 ? endpoints : null;
}

function getNewApiGroupNames(json: NewApiPricingApiResponse): string[] {
  return Array.from(
    new Set([
      ...Object.keys(json.group_ratio || {}),
      ...Object.keys(json.usable_group || {}),
      ...Object.keys(json.group_info || {}),
      ...Object.keys(json.group_model_pricing || {}),
      ...json.data
        .flatMap((model) => getNewApiModelEnableGroups(model))
        .filter((name) => name && name !== 'all'),
    ])
  );
}

function getNewApiGroupDisplayName(
  json: NewApiPricingApiResponse,
  name: string
): string {
  const usableName = json.usable_group?.[name];
  if (usableName) return usableName;

  const info = json.group_info?.[name];
  if (typeof info === 'string') return info;
  if (typeof info === 'number') return name;
  return info?.DisplayName || info?.display_name || info?.name || name;
}

function getNewApiGroupRatio(
  json: NewApiPricingApiResponse,
  name: string
): number {
  const ratio = json.group_ratio?.[name];
  if (typeof ratio === 'number' && Number.isFinite(ratio)) return ratio;

  const info = json.group_info?.[name];
  if (typeof info === 'number' && Number.isFinite(info)) return info;
  if (info && typeof info === 'object') {
    return toFiniteNumber(info.GroupRatio ?? info.group_ratio ?? info.ratio, 1);
  }
  return 1;
}

function resolveNewApiEffectiveGroup(
  json: NewApiPricingApiResponse,
  requestedGroup: string
): string {
  const groupNames = getNewApiGroupNames(json);
  if (requestedGroup && groupNames.includes(requestedGroup)) {
    return requestedGroup;
  }
  return groupNames[0] || requestedGroup || DEFAULT_GROUP_NAME;
}

function getNewApiModelEnableGroups(model: NewApiPricingModelInfo): string[] {
  return model.enable_groups || model.enable_group || [];
}

function resolveNewApiModelEffectiveGroup(
  json: NewApiPricingApiResponse,
  model: NewApiPricingModelInfo,
  requestedGroup: string
): string | null {
  const groupNames = getNewApiGroupNames(json);
  const enableGroups = getNewApiModelEnableGroups(model);
  const hasRequestedGroup = groupNames.includes(requestedGroup);

  if (enableGroups.length === 0 || enableGroups.includes('all')) {
    return resolveNewApiEffectiveGroup(json, requestedGroup);
  }

  if (hasRequestedGroup) {
    return enableGroups.includes(requestedGroup) ? requestedGroup : null;
  }

  return (
    groupNames.find((groupName) => enableGroups.includes(groupName)) || null
  );
}

function buildModelPriceParts(price: ModelPrice): string[] {
  if (price.billingType === 'tiered' && price.tieredCny?.length) {
    return price.tieredCny.map(
      (tier) => `${tier.label} ¥${tier.perSecondCny.toFixed(2)}/秒`
    );
  }
  if (
    price.billingType === 'per-second' &&
    price.flatCny != null &&
    price.flatCny > 0
  ) {
    return [`¥${price.flatCny.toFixed(2)}/秒`];
  }
  if (
    price.billingType === 'flat' &&
    price.flatCny != null &&
    price.flatCny > 0
  ) {
    return [`¥${price.flatCny.toFixed(2)}/次`];
  }
  if (
    price.billingType === 'token' &&
    price.inputCnyMtok != null &&
    price.outputCnyMtok != null &&
    (price.inputCnyMtok > 0 || price.outputCnyMtok > 0)
  ) {
    const parts = [
      `输入 ¥${price.inputCnyMtok.toFixed(2)}`,
      `补全 ¥${price.outputCnyMtok.toFixed(2)}`,
    ];
    if (price.cacheReadCnyMtok != null) {
      parts.push(`缓存读取 ¥${price.cacheReadCnyMtok.toFixed(2)}`);
    }
    if (price.cacheCreateCnyMtok != null) {
      parts.push(`缓存创建 ¥${price.cacheCreateCnyMtok.toFixed(2)}`);
    }
    if (price.audioInputCnyMtok != null) {
      parts.push(`音频输入 ¥${price.audioInputCnyMtok.toFixed(2)}`);
    }
    if (price.audioOutputCnyMtok != null) {
      parts.push(`音频补全 ¥${price.audioOutputCnyMtok.toFixed(2)}`);
    }
    return parts;
  }
  return [];
}

function getModelPriceUnit(price: ModelPrice): string {
  return price.billingType === 'token' ? ' / 1M Tokens' : '';
}

export function formatModelPrice(price: ModelPrice): string {
  const parts = buildModelPriceParts(price);
  if (parts.length === 0) {
    return '';
  }
  return `${parts.join(' · ')}${getModelPriceUnit(price)}`;
}

export function formatModelPriceSummary(price: ModelPrice): string {
  const parts = buildModelPriceParts(price);
  if (parts.length === 0) {
    return '';
  }
  return `${parts.slice(0, 2).join(' · ')}${getModelPriceUnit(price)}`;
}

export function formatModelPriceDetail(price: ModelPrice): string {
  return formatModelPrice(price);
}

class ModelPricingService {
  private cacheMap = new Map<string, ProviderPricingCache>();
  private listeners = new Set<PricingListener>();
  private sharedResponseCacheMap = new Map<
    string,
    SharedPricingResponseCacheEntry
  >();
  private inflightRequestMap = new Map<string, Promise<PricingApiResponse>>();
  private profileRequestSequenceMap = new Map<string, number>();
  private inflightProfileRequestMap = new Map<string, ProfilePricingRequest>();
  private persistenceQueue: Promise<void> = Promise.resolve();
  private version = 0;

  constructor() {
    const saved = providerPricingCacheSettings.get();
    if (Array.isArray(saved)) {
      saved.forEach((cache) => this.cacheMap.set(cache.profileId, cache));
    }
    providerPricingCacheSettings.addListener?.(
      this.handlePersistedCacheSettingsChange
    );
  }

  private handlePersistedCacheSettingsChange = (
    caches: ProviderPricingCache[]
  ): void => {
    const nextCacheMap = new Map(
      caches.map((cache) => [cache.profileId, cache] as const)
    );
    if (this.areCacheMapsEqual(nextCacheMap)) {
      return;
    }

    const profileIds = new Set([
      ...this.cacheMap.keys(),
      ...nextCacheMap.keys(),
    ]);
    for (const profileId of profileIds) {
      if (
        !this.areCachesEqual(
          this.cacheMap.get(profileId),
          nextCacheMap.get(profileId)
        )
      ) {
        this.supersedeProfileRequest(profileId);
      }
    }

    this.cacheMap = nextCacheMap;
    this.notify();
  };

  private areCachesEqual(
    currentCache: ProviderPricingCache | undefined,
    nextCache: ProviderPricingCache | undefined
  ): boolean {
    if (!currentCache || !nextCache) {
      return currentCache === nextCache;
    }
    return JSON.stringify(currentCache) === JSON.stringify(nextCache);
  }

  private areCacheMapsEqual(
    nextCacheMap: ReadonlyMap<string, ProviderPricingCache>
  ): boolean {
    if (this.cacheMap.size !== nextCacheMap.size) {
      return false;
    }

    for (const [profileId, nextCache] of nextCacheMap) {
      const currentCache = this.cacheMap.get(profileId);
      if (!this.areCachesEqual(currentCache, nextCache)) {
        return false;
      }
    }

    return true;
  }

  subscribe(listener: PricingListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify(): void {
    this.version += 1;
    this.listeners.forEach((fn) => fn());
  }

  private buildSharedCacheKey(pricingUrl: string, apiKey: string): string {
    return `${buildPricingUrlSourceIdentity(
      pricingUrl
    )}\ncredential:${buildProviderCredentialIdentity(apiKey)}`;
  }

  private beginProfileRequest(profileId: string): number {
    const sequence = (this.profileRequestSequenceMap.get(profileId) || 0) + 1;
    this.profileRequestSequenceMap.set(profileId, sequence);
    return sequence;
  }

  private supersedeProfileRequest(profileId: string): void {
    this.beginProfileRequest(profileId);
    this.inflightProfileRequestMap.delete(profileId);
  }

  private isProfileRequestCurrent(
    profileId: string,
    sequence: number
  ): boolean {
    return this.profileRequestSequenceMap.get(profileId) === sequence;
  }

  private async resolveSupersededProfileRequest(
    profileId: string,
    sequence: number
  ): Promise<ProviderPricingCache> {
    const currentRequest = this.inflightProfileRequestMap.get(profileId);
    if (currentRequest && currentRequest.state.sequence !== sequence) {
      return currentRequest.promise;
    }

    const currentCache = this.cacheMap.get(profileId);
    if (currentCache) {
      return currentCache;
    }

    throw new Error('Pricing cache request was superseded');
  }

  private buildSourceSignature(
    pricingUrl: string,
    groupName: string,
    cnyPerUsd: number,
    apiKey: string
  ): string {
    return buildPricingSourceSignature(
      pricingUrl,
      groupName,
      cnyPerUsd,
      apiKey
    );
  }

  private isFresh(
    fetchedAt: number | undefined,
    ttlMs: number,
    now = Date.now()
  ): boolean {
    return typeof fetchedAt === 'number' && now - fetchedAt < ttlMs;
  }

  private pruneExpiredSharedResponses(now = Date.now()): void {
    this.sharedResponseCacheMap.forEach((entry, key) => {
      if (!this.isFresh(entry.fetchedAt, entry.ttlMs, now)) {
        this.sharedResponseCacheMap.delete(key);
      }
    });
  }

  private async fetchPricingResponse(
    pricingUrl: string,
    apiKey: string,
    options: FetchAndCacheOptions = {}
  ): Promise<PricingApiResponse> {
    const normalizedPricingUrl = normalizePricingUrl(pricingUrl);
    const requestKey = this.buildSharedCacheKey(normalizedPricingUrl, apiKey);
    const ttlMs = getPricingCacheTtlMs(normalizedPricingUrl);
    const now = Date.now();

    this.pruneExpiredSharedResponses(now);

    if (!options.force) {
      const cached = this.sharedResponseCacheMap.get(requestKey);
      if (cached && this.isFresh(cached.fetchedAt, cached.ttlMs, now)) {
        return cached.response;
      }
    }

    const inflight = this.inflightRequestMap.get(requestKey);
    if (inflight) {
      return inflight;
    }

    const promise = (async () => {
      const headers: Record<string, string> = { Accept: 'application/json' };
      if (apiKey) {
        headers['Authorization'] = `Bearer ${apiKey}`;
      }
      const response = await fetch(normalizedPricingUrl, { headers });
      if (!response.ok) {
        throw new Error(`Pricing API error: ${response.status}`);
      }
      const json = (await response.json()) as PricingApiResponse;
      if (!isSupportedPricingResponse(json)) {
        throw new Error('Invalid pricing API response');
      }
      this.sharedResponseCacheMap.set(requestKey, {
        fetchedAt: Date.now(),
        ttlMs,
        response: json,
      });
      return json;
    })();

    this.inflightRequestMap.set(requestKey, promise);

    try {
      return await promise;
    } finally {
      this.inflightRequestMap.delete(requestKey);
    }
  }

  private buildForProviderCache(
    profileId: string,
    json: ForPricingApiResponse,
    groupName: string,
    cnyPerUsd: number,
    sourceSignature: string,
    autoRefreshSourceSignature: string | null
  ): ProviderPricingCache {
    const groups: PricingGroup[] = Object.entries(json.data.group_info).map(
      ([name, info]) => ({
        name,
        displayName: info.DisplayName || name,
        ratio: info.GroupRatio ?? 1,
      })
    );

    const effectiveGroup = groupName || DEFAULT_GROUP_NAME;
    const groupInfo = json.data.group_info[effectiveGroup];
    const groupRatio = groupInfo?.GroupRatio ?? 1;

    const prices: Record<string, ModelPrice> = {};
    const modelEndpoints: Record<
      string,
      Record<string, PricingEndpointInfo>
    > = {};
    for (const model of json.data.model_info) {
      const groupPrices = model.price_info?.[effectiveGroup];
      const gp: PricingGroupPrice | undefined = groupPrices?.['default'];
      if (!gp) continue;
      const firstDocs = Object.values(model.endpoints || {}).find(
        (ep) => ep.docs
      )?.docs;
      prices[model.model_name] = {
        ...computeModelPrice(gp, groupRatio, cnyPerUsd),
        description: model.description || undefined,
        docsUrl: firstDocs || undefined,
      };
      if (model.endpoints && Object.keys(model.endpoints).length > 0) {
        modelEndpoints[model.model_name] = model.endpoints;
      }
    }

    return {
      profileId,
      routingEvidenceVersion: IMAGE_ROUTING_EVIDENCE_VERSION,
      fetchedAt: Date.now(),
      sourceSignature,
      autoRefreshSourceSignature,
      groups,
      prices,
      modelEndpoints,
    };
  }

  private buildNewApiProviderCache(
    profileId: string,
    json: NewApiPricingApiResponse,
    groupName: string,
    cnyPerUsd: number,
    sourceSignature: string,
    autoRefreshSourceSignature: string | null
  ): ProviderPricingCache {
    const groups: PricingGroup[] = getNewApiGroupNames(json).map((name) => ({
      name,
      displayName: getNewApiGroupDisplayName(json, name),
      ratio: getNewApiGroupRatio(json, name),
    }));

    const requestedGroup = groupName || DEFAULT_GROUP_NAME;

    const prices: Record<string, ModelPrice> = {};
    const modelEndpoints: Record<
      string,
      Record<string, PricingEndpointInfo>
    > = {};
    for (const model of json.data) {
      if (!model.model_name) continue;
      const effectiveGroup = resolveNewApiModelEffectiveGroup(
        json,
        model,
        requestedGroup
      );
      if (!effectiveGroup) {
        continue;
      }
      const groupRatio = getNewApiGroupRatio(json, effectiveGroup);
      const groupModelPricing = json.group_model_pricing?.[effectiveGroup];

      const endpoints = buildNewApiModelEndpoints(
        model,
        json.supported_endpoint
      );
      const firstDocs = endpoints
        ? Object.values(endpoints).find((ep) => ep.docs)?.docs
        : undefined;
      prices[model.model_name] = {
        ...computeNewApiModelPrice(
          model,
          groupRatio,
          cnyPerUsd,
          groupModelPricing
        ),
        description: model.description || undefined,
        docsUrl: firstDocs || undefined,
      };
      if (endpoints) {
        modelEndpoints[model.model_name] = endpoints;
      }
    }

    return {
      profileId,
      routingEvidenceVersion: IMAGE_ROUTING_EVIDENCE_VERSION,
      fetchedAt: Date.now(),
      sourceSignature,
      autoRefreshSourceSignature,
      groups,
      prices,
      modelEndpoints,
    };
  }

  private buildProviderCache(
    profileId: string,
    json: PricingApiResponse,
    groupName: string,
    cnyPerUsd: number,
    sourceSignature: string,
    autoRefreshSourceSignature: string | null
  ): ProviderPricingCache {
    if (isForPricingResponse(json)) {
      return this.buildForProviderCache(
        profileId,
        json,
        groupName,
        cnyPerUsd,
        sourceSignature,
        autoRefreshSourceSignature
      );
    }

    if (isNewApiPricingResponse(json)) {
      return this.buildNewApiProviderCache(
        profileId,
        json,
        groupName,
        cnyPerUsd,
        sourceSignature,
        autoRefreshSourceSignature
      );
    }

    throw new Error('Invalid pricing API response');
  }

  async fetchAndCache(
    profileId: string,
    pricingUrl: string,
    apiKey: string,
    groupName: string,
    cnyPerUsd: number,
    options: FetchAndCacheOptions = {}
  ): Promise<ProviderPricingCache> {
    const normalizedPricingUrl = normalizePricingUrl(pricingUrl);
    const normalizedApiKey = apiKey.trim();
    const ttlMs = getPricingCacheTtlMs(normalizedPricingUrl);
    const sourceSignature = this.buildSourceSignature(
      normalizedPricingUrl,
      groupName,
      cnyPerUsd,
      normalizedApiKey
    );
    const cached = this.cacheMap.get(profileId);
    if (
      !options.force &&
      cached &&
      cached.routingEvidenceVersion === IMAGE_ROUTING_EVIDENCE_VERSION &&
      cached.sourceSignature === sourceSignature &&
      this.isFresh(cached.fetchedAt, ttlMs)
    ) {
      return cached;
    }

    const existingRequest = this.inflightProfileRequestMap.get(profileId);
    if (existingRequest?.state.sourceSignature === sourceSignature) {
      if (options.promoteToAutoRefresh) {
        existingRequest.state.promoteToAutoRefresh = true;
      }
      return existingRequest.promise;
    }

    const requestState: ProfilePricingRequestState = {
      sequence: this.beginProfileRequest(profileId),
      sourceSignature,
      promoteToAutoRefresh: options.promoteToAutoRefresh === true,
    };
    const promise = this.performFetchAndCache(
      profileId,
      normalizedPricingUrl,
      normalizedApiKey,
      groupName,
      cnyPerUsd,
      options,
      cached,
      requestState
    );
    this.inflightProfileRequestMap.set(profileId, {
      state: requestState,
      promise,
    });

    try {
      return await promise;
    } finally {
      const currentRequest = this.inflightProfileRequestMap.get(profileId);
      if (currentRequest?.state.sequence === requestState.sequence) {
        this.inflightProfileRequestMap.delete(profileId);
      }
    }
  }

  private async performFetchAndCache(
    profileId: string,
    normalizedPricingUrl: string,
    apiKey: string,
    groupName: string,
    cnyPerUsd: number,
    options: FetchAndCacheOptions,
    cachedAtStart: ProviderPricingCache | undefined,
    requestState: ProfilePricingRequestState
  ): Promise<ProviderPricingCache> {
    const sourceSignature = requestState.sourceSignature;

    let json: PricingApiResponse;
    try {
      json = await this.fetchPricingResponse(
        normalizedPricingUrl,
        apiKey,
        options
      );
    } catch (error) {
      if (!this.isProfileRequestCurrent(profileId, requestState.sequence)) {
        return this.resolveSupersededProfileRequest(
          profileId,
          requestState.sequence
        );
      }
      throw error;
    }
    if (!this.isProfileRequestCurrent(profileId, requestState.sequence)) {
      return this.resolveSupersededProfileRequest(
        profileId,
        requestState.sequence
      );
    }

    const autoRefreshSourceSignature =
      requestState.promoteToAutoRefresh ||
      isPricingCacheEligibleForWarmup(cachedAtStart, sourceSignature)
        ? sourceSignature
        : null;
    const cache = this.buildProviderCache(
      profileId,
      json,
      groupName,
      cnyPerUsd,
      sourceSignature,
      autoRefreshSourceSignature
    );

    this.cacheMap.set(profileId, cache);
    this.notify();
    await this.persist();
    if (!this.isProfileRequestCurrent(profileId, requestState.sequence)) {
      return this.resolveSupersededProfileRequest(
        profileId,
        requestState.sequence
      );
    }
    return cache;
  }

  getCache(profileId: string): ProviderPricingCache | null {
    return this.cacheMap.get(profileId) ?? null;
  }

  getModelPrice(
    profileId: string | undefined | null,
    modelId: string
  ): ModelPrice | null {
    if (!profileId) return null;
    return this.cacheMap.get(profileId)?.prices[modelId] ?? null;
  }

  getModelEndpoints(
    profileId: string | undefined | null,
    modelId: string
  ): Record<string, PricingEndpointInfo> | null {
    if (!profileId) return null;
    return this.cacheMap.get(profileId)?.modelEndpoints?.[modelId] ?? null;
  }

  getFreshRoutingModelEndpoints(
    profile: Pick<
      ProviderProfile,
      'id' | 'baseUrl' | 'apiKey' | 'pricingUrl' | 'pricingGroup' | 'cnyPerUsd'
    >,
    now = Date.now()
  ): ProviderPricingCache['modelEndpoints'] | null {
    const cache = this.cacheMap.get(profile.id);
    const pricingConfig = resolveProviderPricingConfig(profile);
    if (!cache || !pricingConfig) {
      return null;
    }

    const sourceSignature = this.buildSourceSignature(
      pricingConfig.pricingUrl,
      pricingConfig.pricingGroup,
      pricingConfig.cnyPerUsd,
      profile.apiKey
    );
    if (
      cache.routingEvidenceVersion !== IMAGE_ROUTING_EVIDENCE_VERSION ||
      cache.sourceSignature !== sourceSignature ||
      !profile.apiKey.trim() ||
      !this.isFresh(
        cache.fetchedAt,
        getPricingCacheTtlMs(pricingConfig.pricingUrl),
        now
      )
    ) {
      return null;
    }

    return cache.modelEndpoints ?? null;
  }

  removeCache(profileId: string): void {
    const removed = this.cacheMap.delete(profileId);
    this.supersedeProfileRequest(profileId);
    if (removed) {
      void this.persist();
      this.notify();
    }
  }

  getVersion(): number {
    return this.version;
  }

  warmupProfiles(profiles: ProviderProfile[]): void {
    profiles
      .filter((profile) => profile.enabled !== false)
      .forEach((profile) => {
        const pricingConfig = resolveProviderPricingConfig(profile);
        if (!pricingConfig) {
          return;
        }
        const sourceSignature = this.buildSourceSignature(
          pricingConfig.pricingUrl,
          pricingConfig.pricingGroup,
          pricingConfig.cnyPerUsd,
          profile.apiKey
        );
        const cached = this.cacheMap.get(profile.id);
        if (!isPricingCacheEligibleForWarmup(cached, sourceSignature)) {
          return;
        }
        void this.fetchAndCache(
          profile.id,
          pricingConfig.pricingUrl,
          profile.apiKey,
          pricingConfig.pricingGroup,
          pricingConfig.cnyPerUsd
        ).catch((error) => {
          console.warn(
            `[ModelPricingService] Warmup failed for profile ${profile.id}:`,
            error
          );
        });
      });
  }

  private persist(): Promise<void> {
    const persistence = this.persistenceQueue.then(() =>
      providerPricingCacheSettings.update(Array.from(this.cacheMap.values()))
    );
    this.persistenceQueue = persistence.catch((error) => {
      console.warn(
        '[ModelPricingService] Failed to persist pricing cache:',
        error instanceof Error ? error.name : 'UnknownError'
      );
    });
    return this.persistenceQueue;
  }
}

export const modelPricingService = new ModelPricingService();
