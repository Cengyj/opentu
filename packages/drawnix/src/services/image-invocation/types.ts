import type { ModelRef } from '../../utils/settings-types';
import type {
  GenerationAssetMetadata,
  KnowledgeContextRef,
} from '../../types/shared/core.types';

export type ImageGenerationMode =
  | 'text_to_image'
  | 'image_to_image'
  | 'image_edit';

export type ImageOperationIntent = 'generation' | 'edit';

export interface NormalizedImagePromptMetadata {
  readonly initialPrompt?: string;
  readonly sentPrompt?: string;
  readonly title?: string;
  readonly category?:
    | 'image'
    | 'video'
    | 'audio'
    | 'text'
    | 'agent'
    | 'ppt-common'
    | 'ppt-slide';
  readonly tags?: readonly string[];
  readonly knowledgeContextRefs?: readonly Readonly<KnowledgeContextRef>[];
  readonly skillId?: string;
  readonly skillName?: string;
}

/**
 * The only request shape consumed after the image invocation boundary.
 *
 * Legacy aliases are deliberately absent. `params` contains provider-specific
 * values only; aliases promoted to a canonical field are removed by the
 * normalizer.
 */
export interface NormalizedImageRequest {
  readonly prompt: string;
  readonly taskId?: string;
  readonly model?: string;
  readonly modelRef?: Readonly<ModelRef> | null;
  readonly bindingId?: string;
  readonly generationMode?: ImageGenerationMode;
  readonly referenceImages: readonly string[];
  readonly maskImage?: string;
  readonly size?: string;
  readonly aspectRatio?: string;
  readonly resolution?: string;
  readonly quality?: string;
  readonly inputFidelity?: string;
  readonly background?: string;
  readonly outputFormat?: string;
  readonly outputCompression?: number;
  readonly count?: number;
  readonly responseFormat?: 'url' | 'b64_json';
  readonly moderation?: 'low' | 'auto';
  readonly user?: string;
  /** Task/library metadata; never projected into an adapter request. */
  readonly assetMetadata?: Readonly<GenerationAssetMetadata>;
  /** Prompt-history metadata; never projected into an adapter request. */
  readonly promptMeta?: NormalizedImagePromptMetadata;
  readonly params: Readonly<Record<string, unknown>>;
  readonly signal?: AbortSignal;
}

export type ImageCapabilityParameter =
  | 'operation'
  | 'referenceImages'
  | 'maskImage'
  | 'size'
  | 'aspectRatio'
  | 'resolution'
  | 'quality'
  | 'inputFidelity'
  | 'background'
  | 'outputFormat'
  | 'outputCompression'
  | 'count'
  | `params.${string}`;

export type ImageCapabilityEvidence = 'binding-metadata' | 'request-schema';

export interface ImageEnumCapability {
  readonly supported: boolean;
  /** Omitted when the serializer supports the field but values are provider-defined. */
  readonly values?: readonly string[];
}

export interface ImageRangeCapability {
  readonly supported: boolean;
  readonly min?: number;
  readonly max?: number;
  readonly integer?: boolean;
}

/**
 * A provider-specific value that is intentionally consumed by the serializer
 * selected through `requestSchema`. Keys absent from this map are not safe to
 * forward and must fail capability validation before transport.
 */
export interface ImageProviderParameterCapability {
  readonly valueType: 'string' | 'number' | 'string-or-number';
  readonly values?: readonly string[];
  readonly min?: number;
  readonly max?: number;
  readonly integer?: boolean;
}

export interface ImageReferenceCapability {
  readonly supported: boolean;
  readonly minCount?: number;
  readonly maxCount?: number;
}

export interface ImageBindingCapabilities {
  readonly bindingId: string;
  readonly profileId: string;
  readonly modelId: string;
  readonly requestSchema: string;
  readonly source: 'binding-metadata' | 'request-schema' | 'mixed' | 'unknown';
  readonly evidence: Readonly<
    Partial<Record<ImageCapabilityParameter, ImageCapabilityEvidence>>
  >;
  readonly operations?: readonly ImageOperationIntent[];
  readonly referenceImages?: ImageReferenceCapability;
  readonly maskImage?: boolean;
  readonly size?: ImageEnumCapability;
  readonly aspectRatio?: ImageEnumCapability;
  readonly resolution?: ImageEnumCapability;
  readonly quality?: ImageEnumCapability;
  readonly inputFidelity?: ImageEnumCapability;
  readonly background?: ImageEnumCapability;
  readonly outputFormat?: ImageEnumCapability;
  readonly outputCompression?: ImageRangeCapability;
  readonly count?: ImageRangeCapability;
  readonly providerParams: Readonly<
    Record<string, ImageProviderParameterCapability>
  >;
}

/**
 * Canonical binding metadata accepted at `binding.metadata.image` or
 * `binding.metadata.image.capabilities`.
 *
 * A boolean means that the field is supported/unsupported. An array proves
 * support and restricts the accepted values. Range objects can constrain
 * numeric parameters without coupling capabilities to a model name.
 */
export interface ImageBindingCapabilityMetadata {
  readonly operations?: readonly ImageOperationIntent[];
  readonly referenceImages?:
    | boolean
    | {
        readonly minCount?: number;
        readonly maxCount?: number;
      };
  readonly maskImage?: boolean;
  readonly size?: boolean | readonly string[];
  readonly aspectRatio?: boolean | readonly string[];
  readonly resolution?: boolean | readonly string[];
  readonly quality?: boolean | readonly string[];
  readonly inputFidelity?: boolean | readonly string[];
  readonly background?: boolean | readonly string[];
  readonly outputFormat?: boolean | readonly string[];
  readonly outputCompression?:
    | boolean
    | {
        readonly min?: number;
        readonly max?: number;
      };
  readonly count?:
    | boolean
    | {
        readonly min?: number;
        readonly max?: number;
        readonly integer?: boolean;
      };
}

export type ImageCapabilityIssueReason =
  | 'unknown'
  | 'unsupported'
  | 'invalid-value'
  | 'below-minimum'
  | 'above-maximum';

export interface ImageCapabilityValidationIssue {
  readonly parameter: ImageCapabilityParameter;
  readonly reason: ImageCapabilityIssueReason;
  readonly message: string;
}

export interface ImageCapabilityBinding {
  readonly id: string;
  readonly profileId: string;
  readonly modelId: string;
  readonly requestSchema: string;
  readonly metadata?: Readonly<Record<string, unknown>>;
}
