## Context

Provider profiles currently combine stable connection intent (`baseUrl`, credentials, `authType`, and headers) with a profile-wide `providerType`. Protocol routing is already represented separately by `ProviderModelBinding` and finalized by `InvocationPlan`, but binding inference only builds generic image bindings for the three manual provider types. A failed plan is currently allowed to fall through to legacy model-only adapter resolution, which would make `auto` unsafe for unknown or ambiguous models.

The existing `imageApiCompatibility` setting is a separate image request-body compatibility choice. Its values and `auto` resolution rules must remain unchanged.

## Goals / Non-Goals

- Goals:
  - Persist `ProviderType:auto` and use it as the default selection for new provider profile drafts created in settings.
  - Preserve existing profile loading/normalization and every explicit manual or automatic provider type.
  - Route a final `profileId + modelId + operation` to one explicit image binding.
  - Distinguish GPT Image generation from edit and Gemini image generation.
  - Preserve specialized MJ, Flux, Seedream, and asynchronous image bindings.
  - Preserve explicit `authType` and `extraHeaders`, including query authentication.
  - Make direct and task-backed calls resolve the same binding identity.
- Non-Goals:
  - Change `imageApiCompatibility=auto` semantics.
  - Auto-migrate any existing provider profile or change built-in/legacy fallback behavior.
  - Probe protocols by sending provider requests or add cross-provider failover.
  - Persist a second effective-protocol value.
  - Change prompts, pricing, model discovery/classification, or non-image payloads.

## Decisions

- Decision: `ProviderType:auto` is configuration intent, not an executable protocol.

  - It is persisted on `ProviderProfile` and remains unchanged while models are selected and invoked.
  - `InvocationPlan.binding` remains the only executable protocol authority.

- Decision: automatic binding construction is centralized.

  - The binding key remains scoped by `profileId + modelId + operation`.
  - Specialized model templates retain their existing precedence.
  - GPT Image and Gemini image family metadata may select their known protocol templates.
  - Provider-discovered endpoint metadata may contribute model-scoped candidates.
  - Base URL, vendor name, or a UI branch alone cannot select the endpoint.
  - For text, video, and audio, an auto profile retains the existing OpenAI-compatible gateway candidates (including existing specialized model rules); model-scoped multi-protocol selection in this change applies to image bindings.

- Decision: operation intent selects GPT generation versus edit.

  - Text-only image generation prefers `openai.image.gpt-generation-json` and `/images/generations` when official GPT Image compatibility is available.
  - Edit input prefers `openai.image.gpt-edit-form` and `/images/edits`.
  - The existing preferred-request-schema contract remains the operation signal.

- Decision: unresolved auto routing is strict.

  - An auto profile with no candidate produces an `InvocationPlanningError`.
  - Equally ranked incompatible candidates produce an ambiguity error unless `bindingId`, preferred schema, or an existing explicit priority resolves them.
  - A produced plan cannot fall back to model-only adapter matching if its binding has no adapter.
  - Manual provider modes retain their legacy fallback behavior when no provider-backed plan exists.

- Decision: authentication remains profile-scoped while query key naming is binding-aware.
  - `authType` and `extraHeaders` are copied into the provider context unchanged.
  - For query authentication, a Google binding uses `key`; other explicit bindings use `api_key`.
  - The transport receives that distinction from the selected binding contract and never treats `providerType:auto` as a protocol.

## Binding Sources And Ambiguity

Candidate sources remain `manual`, `template`, and `discovered`. Existing priority, confidence, source ordering, `bindingId`, and preferred request schema continue to control planning. Model-scoped asynchronous-image templates and discovered endpoints remain eligible without a profile-wide preference. For auto profiles only, candidates tied at the highest effective rank but differing in protocol, request schema, response schema, submit path, poll path template, or Base URL strategy are rejected as ambiguous. Lower-ranked discovery alternatives do not override a higher-ranked model-specific template.

Unknown auto image models receive no unconditional OpenAI or Gemini template. They are callable only when a specialized template, explicit manual binding, or unambiguous discovered endpoint binding exists.

## Compatibility

- Explicit `openai-compatible`, `gemini-compatible`, and `custom` values remain unchanged.
- New provider drafts created from the settings page default to `auto` with Bearer authentication.
- Fresh built-in profiles, legacy records, and stored profiles continue through their existing loading and Base URL normalization behavior.
- A user selection of `openai-compatible`, `gemini-compatible`, or `custom` is saved and reloaded unchanged and is never replaced by the new-draft default.
- `imageApiCompatibility` remains an independent request-body decision.
- Text, video, and audio behavior is unchanged for manual profiles.
- Model selection, retries, and recovery retain the persisted profile/model/binding snapshot and never rewrite the profile.

## Testing

- Unit tests cover settings normalization/persistence, inference, ambiguity, generation/edit selection, same-model cross-profile isolation, specialized bindings, adapter resolution, and binding-aware query authentication.
- Contract tests cover final `ModelRef -> auto -> InvocationPlan.binding -> adapter -> ProviderTransport -> submitPath` for direct and task-backed GPT generation/edit and Gemini generation paths.
- Existing modality, discovery, selection-key, retry/recovery, MCP, PPT, Comic, and adapter suites provide regression coverage.
- Local validation uses the existing uniquely named `default` profile and performs at most one successful GPT Image request and one successful Gemini Image request.

## Rollback

Rollback removes the UI option, runtime inference, and new-profile draft default. Stored `auto` is an additive string value; an older build will normalize an unrecognized value using its existing Base URL inference. No database or backup format migration is required.

## Risks / Trade-offs

- Family metadata can become stale. Model-scoped discovery metadata and explicit bindings remain available, while unknown or tied candidates fail closed.
- Strict auto errors may expose previously hidden routing gaps. Errors include the scoped profile/model/operation rather than silently charging a request on a guessed endpoint.
