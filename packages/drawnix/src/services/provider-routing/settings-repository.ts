import {
  getDefaultAudioModel,
  getDefaultImageModel,
  getDefaultTextModel,
  getDefaultVideoModel,
  getModelConfig,
  ModelVendor,
  type ModelConfig,
  type ModelType,
} from '../../constants/model-config';
import {
  DEFAULT_PROVIDER_IMAGE_API_COMPATIBILITY,
  LEGACY_DEFAULT_PROVIDER_PROFILE_ID,
  FOR_DEFAULT_PROVIDER_NAME,
  FOR_PROVIDER_DEFAULT_BASE_URL,
  createModelRef,
  geminiSettings,
  providerCatalogsSettings,
  providerProfilesSettings,
  resolveInvocationRoute,
  type GeminiSettings,
  type ModelRef,
  type ProviderCatalog,
  type ProviderProfile,
} from '../../utils/settings-manager';
import {
  InvocationPlanner,
  InvocationPlanningError,
} from './invocation-planner';
import { inferBindingsForProviderCatalog } from './binding-inference';
import { modelPricingService } from '../../utils/model-pricing-service';
import type { ProviderPricingCache } from '../../utils/model-pricing-types';
import { isProviderCatalogImageRoutingEvidenceCurrent } from '../../utils/image-routing-evidence';
import type {
  InvocationPlan,
  InvocationPlanRequest,
  InvocationPlannerRepositories,
  NormalizedModelRef,
  ProviderAuthStrategy,
  ProviderModelBinding,
  ProviderProfileSnapshot,
} from './types';

export interface SettingsInvocationPlannerOptions {
  includeLegacyProfile?: boolean;
  manualBindings?: ProviderModelBinding[];
  bindingId?: string | null;
  preferredRequestSchema?: string | readonly string[] | null;
}

function inferProviderTypeFromBaseUrl(
  baseUrl: string
): ProviderProfile['providerType'] {
  const normalizedBaseUrl = baseUrl.trim().toLowerCase();

  if (
    normalizedBaseUrl.includes('generativelanguage.googleapis.com') ||
    normalizedBaseUrl.includes('vertex.googleapis.com')
  ) {
    return 'gemini-compatible';
  }

  if (
    normalizedBaseUrl.includes('/openai') ||
    normalizedBaseUrl.endsWith('/v1') ||
    normalizedBaseUrl.includes('api.openai.com') ||
    isBuiltInProviderBaseUrl(normalizedBaseUrl)
  ) {
    return 'openai-compatible';
  }

  return 'custom';
}

function isBuiltInProviderBaseUrl(baseUrl: string): boolean {
  const normalizedBaseUrl = baseUrl.trim().toLowerCase();
  if (!normalizedBaseUrl) {
    return false;
  }

  try {
    const url = new URL(
      /^[a-z][a-z\d+\-.]*:\/\//i.test(normalizedBaseUrl)
        ? normalizedBaseUrl
        : `https://${normalizedBaseUrl}`
    );
    const hostname = url.hostname.toLowerCase();
    return hostname === 'foropencode.com';
  } catch {
    return false;
  }
}

function inferAuthType(
  baseUrl: string,
  providerType: ProviderProfile['providerType'],
  authType?: ProviderProfile['authType']
): ProviderAuthStrategy {
  if (
    authType === 'bearer' ||
    authType === 'header' ||
    authType === 'query' ||
    authType === 'custom'
  ) {
    return authType;
  }

  return 'bearer';
}

function normalizeSnapshotImageApiCompatibility(
  value?: ProviderProfile['imageApiCompatibility'] | string | null
): ProviderProfile['imageApiCompatibility'] {
  if (
    value === 'auto' ||
    value === 'openai-gpt-image' ||
    value === 'openai-compatible-basic'
  ) {
    return value;
  }

  return DEFAULT_PROVIDER_IMAGE_API_COMPATIBILITY;
}

function toProviderProfileSnapshot(
  profile: Pick<
    ProviderProfile,
    | 'id'
    | 'name'
    | 'providerType'
    | 'baseUrl'
    | 'apiKey'
    | 'authType'
    | 'imageApiCompatibility'
    | 'extraHeaders'
  >
): ProviderProfileSnapshot {
  return {
    id: profile.id,
    name: profile.name,
    providerType: profile.providerType,
    baseUrl: profile.baseUrl,
    apiKey: profile.apiKey,
    authType: inferAuthType(
      profile.baseUrl,
      profile.providerType,
      profile.authType
    ),
    imageApiCompatibility: normalizeSnapshotImageApiCompatibility(
      profile.imageApiCompatibility
    ),
    extraHeaders: profile.extraHeaders,
  };
}

function inferVendorFromModelId(modelId: string): ModelVendor {
  const lowerId = modelId.toLowerCase();

  if (lowerId.includes('flux')) return ModelVendor.FLUX;
  if (lowerId.startsWith('mj') || lowerId.includes('midjourney')) {
    return ModelVendor.MIDJOURNEY;
  }
  if (lowerId.includes('suno') || lowerId.includes('chirp')) {
    return ModelVendor.SUNO;
  }
  if (lowerId.includes('kling')) return ModelVendor.KLING;
  if (lowerId.includes('happyhorse')) return ModelVendor.HAPPYHORSE;
  if (lowerId.includes('seedance') || lowerId.includes('seedream')) {
    return ModelVendor.DOUBAO;
  }
  if (lowerId.includes('veo')) return ModelVendor.VEO;
  if (
    lowerId.includes('gemini') ||
    lowerId.includes('gemma') ||
    lowerId.includes('imagen')
  ) {
    return ModelVendor.GEMINI;
  }

  return ModelVendor.OTHER;
}

function buildFallbackModelConfig(
  modelId: string,
  type: ModelType
): ModelConfig {
  return {
    id: modelId,
    label: modelId,
    shortLabel: modelId,
    type,
    vendor: inferVendorFromModelId(modelId),
  };
}

function getLegacyModelConfig(modelId: string, type: ModelType): ModelConfig {
  const staticModel = getModelConfig(modelId);
  if (staticModel) {
    return staticModel;
  }
  return buildFallbackModelConfig(modelId, type);
}

function buildLegacyProfileSnapshot(
  gemini: GeminiSettings,
  storedProfiles: readonly ProviderProfile[]
): ProviderProfileSnapshot {
  const existingLegacyProfile = storedProfiles.find(
    (profile) => profile.id === LEGACY_DEFAULT_PROVIDER_PROFILE_ID
  );
  const baseUrl = gemini.baseUrl?.trim() || FOR_PROVIDER_DEFAULT_BASE_URL;
  const providerType =
    existingLegacyProfile?.providerType === 'auto' ||
    existingLegacyProfile?.providerType === 'openai-compatible' ||
    existingLegacyProfile?.providerType === 'gemini-compatible' ||
    existingLegacyProfile?.providerType === 'custom'
      ? existingLegacyProfile.providerType
      : inferProviderTypeFromBaseUrl(baseUrl);

  return {
    id: LEGACY_DEFAULT_PROVIDER_PROFILE_ID,
    name: FOR_DEFAULT_PROVIDER_NAME,
    providerType,
    baseUrl,
    apiKey: gemini.apiKey?.trim() || '',
    authType: inferAuthType(
      baseUrl,
      providerType,
      existingLegacyProfile?.authType
    ),
    imageApiCompatibility: normalizeSnapshotImageApiCompatibility(
      existingLegacyProfile?.imageApiCompatibility
    ),
    extraHeaders: existingLegacyProfile?.extraHeaders,
  };
}

function buildLegacyBindings(
  profile: ProviderProfileSnapshot,
  gemini: GeminiSettings
): ProviderModelBinding[] {
  const legacyModels: Array<{ modelId: string; type: ModelType }> = [
    {
      modelId:
        gemini.textModelName?.trim() ||
        gemini.chatModel?.trim() ||
        getDefaultTextModel(),
      type: 'text',
    },
    {
      modelId: gemini.audioModelName?.trim() || getDefaultAudioModel(),
      type: 'audio',
    },
    {
      modelId: gemini.imageModelName?.trim() || getDefaultImageModel(),
      type: 'image',
    },
    {
      modelId: gemini.videoModelName?.trim() || getDefaultVideoModel(),
      type: 'video',
    },
  ];

  return inferBindingsForProviderCatalog(
    profile,
    legacyModels.map((entry) => getLegacyModelConfig(entry.modelId, entry.type))
  );
}

function groupBindingsByModel(
  bindings: readonly ProviderModelBinding[]
): Map<string, ProviderModelBinding[]> {
  const grouped = new Map<string, ProviderModelBinding[]>();

  bindings.forEach((binding) => {
    const key = `${binding.profileId}:${binding.modelId}:${binding.operation}`;
    const current = grouped.get(key) || [];
    current.push(binding);
    grouped.set(key, current);
  });

  return grouped;
}

interface SettingsProviderProfileSnapshot {
  readonly profiles: readonly ProviderProfileSnapshot[];
  readonly sourceProfileById: ReadonlyMap<string, ProviderProfile>;
  readonly legacySettings: GeminiSettings | null;
}

interface SettingsInvocationRepositorySnapshot {
  readonly profileById: ReadonlyMap<string, ProviderProfileSnapshot>;
  readonly bindings: readonly ProviderModelBinding[];
  readonly bindingsByModel: ReadonlyMap<string, readonly ProviderModelBinding[]>;
}

function buildSettingsProviderProfileSnapshot(
  options: SettingsInvocationPlannerOptions
): SettingsProviderProfileSnapshot {
  // SettingsManager#get performs a defensive deep clone. Read each source once
  // so one planning attempt observes a coherent, immutable source snapshot.
  const storedProfiles = providerProfilesSettings.get();
  const profiles = storedProfiles
    .filter((profile) => profile.enabled !== false)
    .filter((profile) => profile.id !== LEGACY_DEFAULT_PROVIDER_PROFILE_ID)
    .map((profile) => toProviderProfileSnapshot(profile));
  const legacySettings =
    options.includeLegacyProfile === false ? null : geminiSettings.get();

  if (legacySettings) {
    profiles.unshift(
      buildLegacyProfileSnapshot(legacySettings, storedProfiles)
    );
  }

  return {
    profiles: Object.freeze(profiles),
    sourceProfileById: new Map(
      storedProfiles.map((profile) => [profile.id, profile])
    ),
    legacySettings,
  };
}

function buildCatalogBindings(
  profiles: readonly ProviderProfileSnapshot[],
  catalogs: readonly ProviderCatalog[],
  sourceProfileById: ReadonlyMap<string, ProviderProfile>
): ProviderModelBinding[] {
  const profileById = new Map(profiles.map((profile) => [profile.id, profile]));
  const pricingEndpointsByProfile = new Map<
    string,
    {
      raw: ProviderPricingCache['modelEndpoints'] | null;
      fresh: ProviderPricingCache['modelEndpoints'] | null;
    }
  >();

  return catalogs.flatMap((catalog) => {
    const profile = profileById.get(catalog.profileId);
    if (!profile) {
      return [];
    }
    const hasCurrentAutomaticImageEvidence =
      profile.providerType !== 'auto' ||
      isProviderCatalogImageRoutingEvidenceCurrent(catalog, profile);
    const models = hasCurrentAutomaticImageEvidence
      ? catalog.discoveredModels
      : catalog.discoveredModels.filter((model) => model.type !== 'image');
    if (!pricingEndpointsByProfile.has(catalog.profileId)) {
      const sourceProfile = sourceProfileById.get(catalog.profileId);
      const raw =
        modelPricingService.getCache(catalog.profileId)?.modelEndpoints ?? null;
      pricingEndpointsByProfile.set(catalog.profileId, {
        raw,
        fresh:
          profile.providerType === 'auto' && sourceProfile
            ? modelPricingService.getFreshRoutingModelEndpoints(sourceProfile)
            : raw,
      });
    }
    const endpointEvidence = pricingEndpointsByProfile.get(catalog.profileId);
    const modelEndpoints = models.reduce<
      NonNullable<ProviderPricingCache['modelEndpoints']>
    >((result, model) => {
      const endpoints =
        (profile.providerType === 'auto' && model.type === 'image'
          ? endpointEvidence?.fresh
          : endpointEvidence?.raw)?.[model.id] ?? null;
      if (endpoints) {
        result[model.id] = endpoints;
      }
      return result;
    }, {});
    return inferBindingsForProviderCatalog(
      profile,
      models,
      Object.keys(modelEndpoints).length > 0 ? modelEndpoints : null
    );
  });
}

function buildSettingsInvocationRepositorySnapshot(
  options: SettingsInvocationPlannerOptions
): SettingsInvocationRepositorySnapshot {
  const { profiles, sourceProfileById, legacySettings } =
    buildSettingsProviderProfileSnapshot(options);
  const catalogBindings = buildCatalogBindings(
    profiles,
    providerCatalogsSettings.get(),
    sourceProfileById
  );
  const profileById = new Map(profiles.map((profile) => [profile.id, profile]));
  const legacyProfile = profileById.get(LEGACY_DEFAULT_PROVIDER_PROFILE_ID);
  const legacyBindings =
    legacySettings && legacyProfile
      ? buildLegacyBindings(legacyProfile, legacySettings)
      : [];
  const deduped = new Map<string, ProviderModelBinding>();

  [
    ...catalogBindings,
    ...legacyBindings,
    ...(options.manualBindings || []),
  ].forEach((binding) => {
    deduped.set(binding.id, binding);
  });
  const bindings = Array.from(deduped.values());

  return {
    profileById,
    bindings: Object.freeze(bindings),
    bindingsByModel: groupBindingsByModel(bindings),
  };
}

export function listSettingsProviderProfiles(
  options: SettingsInvocationPlannerOptions = {}
): ProviderProfileSnapshot[] {
  return [...buildSettingsProviderProfileSnapshot(options).profiles];
}

export function listSettingsModelBindings(
  options: SettingsInvocationPlannerOptions = {}
): ProviderModelBinding[] {
  const snapshot = buildSettingsInvocationRepositorySnapshot(options);
  return [...snapshot.bindings];
}

export function createSettingsInvocationPlannerRepositories(
  options: SettingsInvocationPlannerOptions = {}
): InvocationPlannerRepositories {
  const snapshot = buildSettingsInvocationRepositorySnapshot(options);

  return {
    getProviderProfile(profileId: string) {
      return snapshot.profileById.get(profileId) || null;
    },
    getModelBindings(modelRef: NormalizedModelRef, operation: ModelType) {
      return [
        ...(snapshot.bindingsByModel.get(
          `${modelRef.profileId}:${modelRef.modelId}:${operation}`
        ) || []),
      ];
    },
  };
}

export function planInvocationFromSettings(
  request: InvocationPlanRequest,
  options: SettingsInvocationPlannerOptions = {}
): InvocationPlan {
  const bindingId = request.bindingId ?? options.bindingId;
  const repositories = createSettingsInvocationPlannerRepositories({
    ...options,
    bindingId,
  });
  return new InvocationPlanner(repositories).plan({
    ...request,
    bindingId,
  });
}

export function resolveInvocationPlanFromRoute(
  operation: ModelType,
  requestedModel?: string | ModelRef | null,
  options: SettingsInvocationPlannerOptions = {}
): InvocationPlan | null {
  const route = resolveInvocationRoute(operation, requestedModel);
  const modelRef = createModelRef(route.profileId, route.modelId);

  if (!modelRef) {
    return null;
  }

  const bindingId = options.bindingId;

  try {
    const repositories = createSettingsInvocationPlannerRepositories({
      ...options,
      bindingId,
    });
    return new InvocationPlanner(repositories).plan({
      operation,
      modelRef,
      bindingId,
      preferredRequestSchema: options.preferredRequestSchema,
    });
  } catch (error) {
    if (
      route.providerType === 'auto' &&
      error instanceof InvocationPlanningError
    ) {
      throw error;
    }
    return null;
  }
}
