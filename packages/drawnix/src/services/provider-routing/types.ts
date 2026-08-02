import type { ModelType } from '../../constants/model-config';
import type {
  ImageApiCompatibility,
  ModelRef,
  ProviderProfile,
} from '../../utils/settings-types';

export type ProviderOperation = ModelType;

export type ProviderProtocol =
  | 'openai.chat.completions'
  | 'openai.images.generations'
  | 'openai.images.edits'
  | 'openai.async.media'
  | 'openai.async.video'
  | 'for.suno.music'
  | 'google.generateContent'
  | 'mj.imagine'
  | 'flux.task'
  | 'kling.video'
  | 'seedance.task'
  | 'happyhorse.video'
  | (string & {});

export type ProviderBindingConfidence = 'high' | 'medium' | 'low';

export type ProviderBindingSource = 'discovered' | 'template' | 'manual';

export type ProviderAuthStrategy = 'bearer' | 'header' | 'query' | 'custom';
export type ProviderAuthQueryKey = 'key' | 'api_key';
export type ProviderBaseUrlStrategy = 'preserve' | 'trim-v1';
export type ProviderHttpMethod =
  | 'GET'
  | 'POST'
  | 'PUT'
  | 'PATCH'
  | 'DELETE'
  | 'HEAD'
  | 'OPTIONS';
export type ProviderVideoDurationMode = 'request-param' | 'model-alias';
export type ProviderVideoResultMode = 'inline-url' | 'download-content';
export type ProviderTextImageInputMode =
  | 'openai-image_url'
  | 'google-inline-data';

export interface ProviderVideoBindingMetadata {
  allowedDurations?: string[];
  defaultDuration?: string;
  durationMode?: ProviderVideoDurationMode;
  durationField?: string;
  durationToModelMap?: Record<string, string>;
  strictDurationValidation?: boolean;
  resultMode?: ProviderVideoResultMode;
  downloadPathTemplate?: string;
  versionField?: string;
  versionOptions?: string[];
  defaultVersion?: string;
  versionOptionsByAction?: Record<string, string[]>;
}

export interface ProviderTextBindingMetadata {
  supportsImageInput?: boolean;
  imageInputMode?: ProviderTextImageInputMode;
  maxImageCount?: number;
  capabilitySource?: ProviderBindingSource | 'heuristic';
  capabilityConfidence?: ProviderBindingConfidence;
}

export interface ProviderImageBindingMetadata {
  imageApiCompatibility?: ImageApiCompatibility;
  resolvedImageApiCompatibility?: Exclude<ImageApiCompatibility, 'auto'>;
  action?: 'generation' | 'edit';
  /** Explicit model/binding-scoped request capabilities. */
  capabilities?: ProviderImageCapabilities;
  /** Serializer defaults proven by this binding, never inferred in adapters. */
  serialization?: {
    omitDefaultResponseFormat?: boolean;
    defaultResolution?: '1k' | '2k' | '4k';
  };
  /** Legacy direct fields retained as a centralized metadata migration edge. */
  maxImageCount?: number;
  supportsMask?: boolean;
}

export interface ProviderImageCapabilities {
  operations?: Array<'generation' | 'edit'>;
  referenceImages?: boolean | { minCount?: number; maxCount?: number };
  maskImage?: boolean;
  size?: boolean | string[];
  aspectRatio?: boolean | string[];
  resolution?: boolean | string[];
  quality?: boolean | string[];
  inputFidelity?: boolean | string[];
  background?: boolean | string[];
  outputFormat?: boolean | string[];
  outputCompression?: boolean | { min?: number; max?: number };
  count?: boolean | { min?: number; max?: number; integer?: boolean };
}

export interface ProviderBindingMetadata {
  text?: ProviderTextBindingMetadata;
  image?: ProviderImageBindingMetadata;
  video?: ProviderVideoBindingMetadata;
  audio?: ProviderAudioBindingMetadata;
  [key: string]: unknown;
}

export interface ProviderAudioBindingMetadata {
  action?: string;
  defaultAction?: string;
  submitPathByAction?: Record<string, string>;
  versionField?: string;
  versionOptions?: string[];
  defaultVersion?: string;
  supportsContinuation?: boolean;
  supportsUploadContinuation?: boolean;
  supportsTags?: boolean;
  supportsTitle?: boolean;
  supportsLyricsPrompt?: boolean;
}

export interface ProviderProfileSnapshot
  extends Pick<
    ProviderProfile,
    | 'id'
    | 'name'
    | 'providerType'
    | 'baseUrl'
    | 'apiKey'
    | 'imageApiCompatibility'
    | 'extraHeaders'
  > {
  authType: ProviderAuthStrategy;
}

export interface ResolvedProviderContext {
  profileId: string;
  profileName: string;
  providerType: ProviderProfile['providerType'] | string;
  baseUrl: string;
  apiKey: string;
  authType: ProviderAuthStrategy;
  extraHeaders?: Record<string, string>;
}

export interface ProviderModelBinding {
  id: string;
  profileId: string;
  modelId: string;
  operation: ProviderOperation;
  protocol: ProviderProtocol;
  requestSchema: string;
  responseSchema: string;
  submitPath: string;
  submitMethod: ProviderHttpMethod;
  baseUrlStrategy?: ProviderBaseUrlStrategy;
  pollPathTemplate?: string;
  pollMethod?: ProviderHttpMethod;
  priority: number;
  confidence: ProviderBindingConfidence;
  source: ProviderBindingSource;
  metadata?: ProviderBindingMetadata;
}

export interface DiscoveredProviderModel {
  profileId: string;
  modelId: string;
  selectionKey: string;
  raw: unknown;
  capabilityHints: {
    supportsText: boolean;
    supportsImage: boolean;
    supportsVideo: boolean;
    supportsAudio: boolean;
  };
  bindings: ProviderModelBinding[];
}

export interface NormalizedModelRef {
  profileId: string;
  modelId: string;
}

export interface InvocationPlan {
  provider: ResolvedProviderContext;
  modelRef: NormalizedModelRef;
  binding: ProviderModelBinding;
}

export interface InvocationPlanRequest {
  operation: ProviderOperation;
  modelRef?: ModelRef | null;
  fallbackModelRef?: ModelRef | null;
  bindingId?: string | null;
  preferredRequestSchema?: string | readonly string[] | null;
}

export interface InvocationPlannerRepositories {
  getProviderProfile(profileId: string): ProviderProfileSnapshot | null;
  getModelBindings(
    modelRef: NormalizedModelRef,
    operation: ProviderOperation
  ): ProviderModelBinding[];
}

export interface ProviderTransportRequest {
  path: string;
  baseUrlStrategy?: ProviderBaseUrlStrategy;
  authQueryKey?: ProviderAuthQueryKey;
  method?: string;
  headers?: Record<string, string>;
  query?: Record<string, string | number | boolean | null | undefined>;
  body?: BodyInit | null;
  signal?: AbortSignal;
  timeoutMs?: number;
  credentials?: RequestCredentials;
  fetcher?: typeof fetch;
}

export interface PreparedProviderTransportRequest {
  url: string;
  init: RequestInit;
  headers: Record<string, string>;
}
