# Change: Remove the profile-wide asynchronous image preference

## Why

The provider settings page exposes an experimental `preferAsyncImageEndpoint` switch that is described as not launched. The value is persisted on the whole provider profile and can force any image model, including models with dedicated GPT, Gemini, MJ, Flux, or Seedream bindings, onto the generic `/v1/videos` asynchronous image contract. A profile-wide override is not model capability evidence and competes with the model-scoped `InvocationPlan.binding` routing authority.

## What Changes

- Remove the experimental settings control, its persisted `ProviderProfile` field, normalization, snapshots, and planner preference branch.
- Select asynchronous image bindings for new work only when the final model is an explicitly supported asynchronous image model or model-scoped endpoint discovery declares `scenario=async-image`.
- Keep the existing asynchronous image adapter, transport, submit/query polling, cancellation, retry, recovery, caching, and task-result lifecycle for legitimate asynchronous bindings.
- Ignore the removed property in legacy settings and backups; normalized settings omit it without a database migration.
- Resume already-submitted asynchronous work only from its complete, credential-free task binding snapshot; a legacy binding ID alone SHALL NOT recreate the removed `/videos` contract.
- Fail incomplete legacy recovery state explicitly before transport instead of replanning, resubmitting, or probing another endpoint.

## Impact

- Affected specs: `provider-routing`
- Affected code:
  - `packages/drawnix/src/components/settings-dialog/settings-dialog.tsx`
  - `packages/drawnix/src/utils/settings-types.ts`
  - `packages/drawnix/src/utils/settings-manager.ts`
  - `packages/drawnix/src/services/provider-routing/*`
  - focused settings, routing, adapter, retry, and recovery tests
- Related active changes:
  - `add-auto-provider-image-protocol-routing` continues to preserve model-scoped asynchronous bindings but no longer references a profile preference.
  - `improve-provider-model-settings-accessibility` no longer owns accessibility work for the removed switch.
- Data impact: no migration; obsolete profile input is tolerated and omitted on the next normalized settings write. Existing tasks with a complete binding snapshot remain recoverable; incomplete legacy tasks fail safely without a provider request.
