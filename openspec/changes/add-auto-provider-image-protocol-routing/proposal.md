# Change: Add model-scoped automatic image protocol routing

## Why

A provider profile can expose GPT Image and Gemini Image models through the same Base URL and credentials, but `ProviderProfile.providerType` currently fixes one protocol family for the entire profile. Users therefore have to edit the profile whenever they switch image models, even though runtime routing already has a model-scoped `InvocationPlan.binding` contract.

## What Changes

- Add `auto` as a persisted `ProviderType` configuration intent and expose it as “自动（按模型）” in provider settings.
- Use `auto` as the default selected value only when the user creates a provider profile in settings, while preserving existing profile normalization and every saved provider type.
- Infer image binding candidates for an auto profile from the final provider-scoped model, its operation, model metadata, specialized templates, and discovered endpoint metadata.
- Select GPT Image generation and edit bindings independently, and select Gemini image generation through `google.generateContent`.
- Keep `InvocationPlan.binding` as the sole runtime protocol, request-schema, endpoint, and adapter authority.
- Fail explicitly when an auto profile has no unambiguous binding instead of falling back to model-only adapter guessing or protocol probing.
- Preserve profile-scoped authentication and headers without mutating `providerType` after an invocation.

## Impact

- Affected specs: `provider-routing`
- Affected code:
  - `packages/drawnix/src/utils/settings-types.ts`
  - `packages/drawnix/src/utils/settings-manager.ts`
  - `packages/drawnix/src/components/settings-dialog/*`
  - `packages/drawnix/src/services/provider-routing/*`
  - `packages/drawnix/src/services/model-adapters/*`
  - image invocation route snapshots and contract tests
- Data impact: no migration or automatic profile conversion; the changed default applies only to newly created settings-page profile drafts
