## Context

The current path is `SettingsDialog switch -> ProviderProfile.preferAsyncImageEndpoint -> settings normalization -> ProviderProfileSnapshot -> binding inference -> InvocationPlanner -> InvocationPlan.binding -> adapter/transport -> asynchronous submit/poll -> task persistence and recovery`.

The first five stages make a profile-level boolean compete with model-scoped protocol evidence. Everything after `InvocationPlan.binding` is shared asynchronous execution infrastructure and is also used by real asynchronous models and discovered provider endpoints, so deleting that infrastructure would break unrelated functionality.

## Goals / Non-Goals

- Goals:
  - Remove the experimental UI and persisted profile preference completely.
  - Prevent ordinary image models from receiving a fabricated `/videos` binding merely because of profile state.
  - Preserve asynchronous image routing when supported by the final model or discovered endpoint metadata.
  - Resume already-submitted work only from its complete task binding snapshot, without reconstructing protocol details from an identifier.
  - Preserve direct/task routing identity, retry, recovery, polling, cancellation, cache, and result delivery.
- Non-Goals:
  - Remove `openai.async.media`, asynchronous image model IDs, the async adapter/service, or task recovery.
  - Change video `/videos` routing, GPT/Gemini/MJ/Flux/Seedream protocols, authentication, image payload semantics, or `ProviderType:auto`.
  - Rewrite backups or eagerly mutate stored settings.

## Decisions

- Decision: delete the setting at the configuration boundary.

  - `ProviderProfile` and `ProviderProfileSnapshot` no longer contain `preferAsyncImageEndpoint`.
  - Settings normalization reconstructs known profile fields, so old JSON and backup properties are ignored and disappear on the next normal write.
  - No replacement boolean or effective-protocol field is introduced.

- Decision: make asynchronous image eligibility model scoped.

  - A known asynchronous image model receives the existing template binding.
  - A model whose provider endpoint metadata explicitly declares `scenario=async-image` receives the discovered binding.
  - An ordinary image model with no such evidence keeps its normal dedicated or compatible image binding.
  - The planner may prioritize an actual asynchronous binding candidate, but no longer reads profile preference state.

- Decision: retain `InvocationPlan.binding` as the runtime authority.

  - Adapters and transport continue to consume `protocol`, `requestSchema`, `submitPath`, and `pollPathTemplate` from the selected binding.
  - No UI, TaskQueue, retry, or recovery branch independently chooses `/videos`.

- Decision: make the complete task binding snapshot the only recovery compatibility boundary.

  - A recoverable task route carries profile, model, and operation plus an executable binding snapshot containing binding ID, protocol, request/response schemas, submit path, optional poll path template, Base URL strategy, and binding metadata, but no credentials. Planner-only ranking fields are not required because the snapshot is already selected and never competes with catalog candidates.
  - Recovery hydrates that snapshot directly and refreshes credentials only from the same current profile. It does not ask the settings repository or catalog to infer a replacement binding.
  - A binding ID by itself is not an executable contract and SHALL NOT cause the removed fixed `/videos` binding to be injected into normal candidates or rebuilt for retry/recovery.
  - A task missing a complete executable snapshot fails before submit or query. This is safer than guessing a contract or resubmitting work that may already have been billed.

- Decision: preserve historical release records.
  - Changelog entries remain historical facts.
  - Active proposals and current diagnostics that would otherwise instruct future work to restore the removed switch are updated.

## Risks / Trade-offs

- Risk: a normal model previously forced to `/videos` will return to its actual dedicated/default binding.
  - Mitigation: this is the intended removal; tests prove models with real asynchronous evidence still use the async contract.
- Risk: an old in-flight task that stored only a binding ID cannot be resumed automatically.
  - Mitigation: complete snapshots remain executable; incomplete recovery state fails explicitly with zero network requests rather than guessing an endpoint or causing a duplicate paid submission.
- Risk: deleting broad preference logic could accidentally affect video `/videos` handling.
  - Mitigation: focused image/video endpoint inference and modality regression tests are retained.

## Migration And Rollback

There is no database migration. Legacy settings and backups are tolerant inputs: the removed property is ignored, and normalized output omits it. Existing complete task binding snapshots remain readable without mutation; incomplete task state is not upgraded by fabricating a binding. Rollback would reintroduce the type, UI, normalization, and planner override together; no stored-data restoration is required.
