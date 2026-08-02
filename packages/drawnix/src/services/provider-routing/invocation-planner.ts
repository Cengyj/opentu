import type {
  InvocationPlan,
  InvocationPlanRequest,
  InvocationPlannerRepositories,
  NormalizedModelRef,
  ProviderBindingConfidence,
  ProviderModelBinding,
  ProviderProfileSnapshot,
  ResolvedProviderContext,
} from './types';
import { normalizeProviderBindingHttpMethods } from './binding-http-method';

const CONFIDENCE_WEIGHT: Record<ProviderBindingConfidence, number> = {
  high: 3,
  medium: 2,
  low: 1,
};

function normalizeModelRef(
  profileId?: string | null,
  modelId?: string | null
): NormalizedModelRef | null {
  const normalizedProfileId = profileId?.trim();
  const normalizedModelId = modelId?.trim();

  if (!normalizedProfileId || !normalizedModelId) {
    return null;
  }

  return {
    profileId: normalizedProfileId,
    modelId: normalizedModelId,
  };
}

function compareBindings(
  left: ProviderModelBinding,
  right: ProviderModelBinding
): number {
  if (right.priority !== left.priority) {
    return right.priority - left.priority;
  }

  const confidenceDiff =
    CONFIDENCE_WEIGHT[right.confidence] - CONFIDENCE_WEIGHT[left.confidence];
  if (confidenceDiff !== 0) {
    return confidenceDiff;
  }

  if (left.source !== right.source) {
    if (left.source === 'manual') return 1;
    if (right.source === 'manual') return -1;
    if (left.source === 'template') return 1;
    if (right.source === 'template') return -1;
  }

  return left.id.localeCompare(right.id, 'en');
}

function normalizePreferredRequestSchemas(
  preferredRequestSchema?: string | readonly string[] | null
): string[] {
  const rawValues = Array.isArray(preferredRequestSchema)
    ? preferredRequestSchema
    : preferredRequestSchema
    ? [preferredRequestSchema]
    : [];

  return rawValues
    .map((schema) => schema.trim())
    .filter((schema) => schema.length > 0);
}

function buildProviderContext(
  profile: ProviderProfileSnapshot
): ResolvedProviderContext {
  return {
    profileId: profile.id,
    profileName: profile.name,
    providerType: profile.providerType,
    baseUrl: profile.baseUrl,
    apiKey: profile.apiKey,
    authType: profile.authType,
    extraHeaders: profile.extraHeaders,
  };
}

function hasSameSelectionRank(
  left: ProviderModelBinding,
  right: ProviderModelBinding
): boolean {
  return (
    left.priority === right.priority &&
    left.confidence === right.confidence &&
    left.source === right.source
  );
}

function assertAutoBindingIsUnambiguous(
  candidates: ProviderModelBinding[],
  selected: ProviderModelBinding,
  request: InvocationPlanRequest,
  modelRef: NormalizedModelRef
): void {
  const equallyRanked = candidates.filter((candidate) =>
    hasSameSelectionRank(candidate, selected)
  );
  const executionIdentities = new Set(
    equallyRanked.map((candidate) =>
      JSON.stringify([
        candidate.protocol,
        candidate.requestSchema,
        candidate.responseSchema,
        candidate.submitPath,
        candidate.submitMethod,
        candidate.pollPathTemplate || null,
        candidate.pollMethod || null,
        candidate.baseUrlStrategy || 'preserve',
      ])
    )
  );

  if (executionIdentities.size <= 1) {
    return;
  }

  throw new InvocationPlanningError(
    `Ambiguous protocol bindings for ${modelRef.profileId}/${
      modelRef.modelId
    }/${request.operation}: ${equallyRanked
      .map((candidate) => candidate.id)
      .join(', ')}`,
    {
      reason: 'AMBIGUOUS_BINDING',
      details: {
        profileId: modelRef.profileId,
        modelId: modelRef.modelId,
        operation: request.operation,
        bindingIds: equallyRanked.map((candidate) => candidate.id),
      },
    }
  );
}

export type InvocationPlanningErrorReason =
  | 'MISSING_MODEL_REF'
  | 'PROFILE_NOT_FOUND'
  | 'BINDING_NOT_FOUND'
  | 'REQUESTED_BINDING_NOT_FOUND'
  | 'AMBIGUOUS_BINDING';

export interface InvocationPlanningErrorOptions {
  readonly reason: InvocationPlanningErrorReason;
  /** Provider/model/binding identities only. Credentials must never be added. */
  readonly details?: Readonly<Record<string, unknown>>;
}

export class InvocationPlanningError extends Error {
  readonly reason: InvocationPlanningErrorReason;
  readonly details?: Readonly<Record<string, unknown>>;

  constructor(message: string, options: InvocationPlanningErrorOptions) {
    super(message);
    this.name = 'InvocationPlanningError';
    this.reason = options.reason;
    this.details = options.details;
  }
}

export class InvocationPlanner {
  constructor(private readonly repositories: InvocationPlannerRepositories) {}

  plan(request: InvocationPlanRequest): InvocationPlan {
    const targetModelRef =
      normalizeModelRef(
        request.modelRef?.profileId || null,
        request.modelRef?.modelId || null
      ) ||
      normalizeModelRef(
        request.fallbackModelRef?.profileId || null,
        request.fallbackModelRef?.modelId || null
      );

    if (!targetModelRef) {
      throw new InvocationPlanningError(
        `Missing provider-backed model selection for ${request.operation}`,
        {
          reason: 'MISSING_MODEL_REF',
          details: { operation: request.operation },
        }
      );
    }

    const profile = this.repositories.getProviderProfile(
      targetModelRef.profileId
    );
    if (!profile) {
      throw new InvocationPlanningError(
        `Provider profile not found: ${targetModelRef.profileId}`,
        {
          reason: 'PROFILE_NOT_FOUND',
          details: {
            profileId: targetModelRef.profileId,
            modelId: targetModelRef.modelId,
            operation: request.operation,
          },
        }
      );
    }

    const bindings = this.repositories
      .getModelBindings(targetModelRef, request.operation)
      .filter(
        (binding) =>
          binding.profileId === targetModelRef.profileId &&
          binding.modelId === targetModelRef.modelId &&
          binding.operation === request.operation
      )
      .map(normalizeProviderBindingHttpMethods)
      .sort(compareBindings);

    if (bindings.length === 0) {
      throw new InvocationPlanningError(
        `No protocol binding for ${targetModelRef.profileId}/${targetModelRef.modelId}/${request.operation}`,
        {
          reason: 'BINDING_NOT_FOUND',
          details: {
            profileId: targetModelRef.profileId,
            modelId: targetModelRef.modelId,
            operation: request.operation,
          },
        }
      );
    }

    const preferredSchemas = normalizePreferredRequestSchemas(
      request.preferredRequestSchema
    );
    const preferredBindings =
      preferredSchemas.length > 0
        ? bindings.filter((candidate) =>
            preferredSchemas.includes(candidate.requestSchema)
          )
        : [];
    const binding = request.bindingId
      ? bindings.find((candidate) => candidate.id === request.bindingId)
      : preferredBindings.length > 0
      ? preferredBindings[0]
      : bindings[0];

    if (!binding) {
      throw new InvocationPlanningError(
        `Requested binding not found: ${request.bindingId}`,
        {
          reason: 'REQUESTED_BINDING_NOT_FOUND',
          details: {
            profileId: targetModelRef.profileId,
            modelId: targetModelRef.modelId,
            operation: request.operation,
            bindingId: request.bindingId,
            bindingIds: bindings.map((candidate) => candidate.id),
          },
        }
      );
    }

    if (profile.providerType === 'auto' && !request.bindingId) {
      const ambiguityCandidates =
        preferredBindings.length > 0 ? preferredBindings : bindings;
      assertAutoBindingIsUnambiguous(
        ambiguityCandidates,
        binding,
        request,
        targetModelRef
      );
    }

    return {
      provider: buildProviderContext(profile),
      modelRef: targetModelRef,
      binding,
    };
  }
}

export function planInvocation(
  repositories: InvocationPlannerRepositories,
  request: InvocationPlanRequest
): InvocationPlan {
  return new InvocationPlanner(repositories).plan(request);
}
