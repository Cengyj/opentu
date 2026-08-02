## Context

The provider router already scopes a binding by profile, model, and operation, and task records already contain a binding snapshot. The image pipeline nevertheless exposed several request types and repeated three decisions downstream: request normalization, edit intent, and invocation planning. An adapter could therefore observe different settings from the original caller, while specialized adapters or asynchronous services could override the planned endpoint, response parser, or poll loop with local behavior.

The current durable task contract correctly persists a task before provider submission and protects terminal writes from cancelled tasks. The image-specific asynchronous callbacks, however, are synchronous in type even when the caller performs an IndexedDB write, so the first poll can race durable remote-ID persistence.

Startup recovery observes persisted `processing` tasks while the live TaskQueue can also be submitting and polling work created in the current page session. Without an image-scoped runtime owner check, persisting `remoteId` can make the recovery hook start a second poller for the same paid request. Asynchronous providers also expose completed images through singular `url`/`video_url`, plural `urls`, or `data` arrays, so a single-URL parser loses valid artifacts.

The production call-graph audit found that `services/photo-wall/GridImageService` had no caller for `generate`, `process`, or insertion. AI Input only forwarded the board to that otherwise unused service. Live Photo Wall behavior is implemented by MCP tools and canvas operations, while `grid-splitter` and `layout-engine` remain real utilities.

## Goals / Non-Goals

- Goals:
  - One canonical internal request and one image operation intent.
  - Exactly one invocation plan for each execution attempt.
  - Binding-scoped capabilities, exact adapter matching in automatic mode, and fail-before-network errors.
  - Binding-owned submit/poll paths for every image adapter.
  - Ordered, validated image artifacts shared by queue and direct calls.
  - Abortable preprocessing, submit, polling, and caching boundaries.
  - Durable remote ID before first query and recovery that never resubmits.
  - One poll/timeout owner per asynchronous image task within the existing lifecycle.
  - Removal of an uncalled parallel image executor without changing live Photo Wall behavior.
- Non-goals:
  - Global task coordinator, leases, revisions, ownership, or database migration.
  - Changes to text, video, audio, global concurrency, prompt, pricing, classification, defaults, or layout.
  - Inferring capabilities or endpoints from an unscoped model name.
  - Changing queue versus direct business semantics or expanding `count` into a different task model.

## Decisions

### Canonical request boundary

`normalizeImageRequest` is the only function that reads legacy aliases, nested `params`, snake_case fields, uploaded-image objects, raw reference-image fields, asset metadata, and prompt-lineage metadata. It returns a readonly `NormalizedImageRequest`. Public entry-point types may keep narrow convenience fields, but adapters and executors consume only the normalized contract. Unknown extra fields are not propagated implicitly. Asset and prompt metadata remain task/presentation data and are deliberately omitted from the adapter request projection and provider serializers.

The executor-facing `ImageGenerationParams` is deliberately smaller than an entry-point request. It contains `taskId`, the canonical `request`, an optional credential-free `invocationRoute` snapshot, and an optional `resolvedInvocation` for the same in-memory call stack. It does not duplicate prompt, model, reference-image, size, quality, metadata, or compatibility fields. Retry and refresh are persisted-data boundaries and may normalize stored historical input once before entering this DTO.

`resolveImageOperationIntent` consumes only this normalized request and returns `generation` or `edit`. Any usable reference image, uploaded image, mask, `image_to_image`, or `image_edit` means edit. The intent selects the preferred request schema before planning; adapters do not reinterpret it.

### One resolved execution value

`resolveImageInvocation` performs the ordered transition from raw input, while `resolveNormalizedImageInvocation` starts from an already-canonical request:

`raw input -> normalized request -> operation intent -> final ModelRef -> InvocationPlan -> exact adapter -> capability validation -> immutable adapter context`.

Callers pass this value forward. Adapter selection accepts an existing binding and never invokes the planner. Adapter context is built from the existing plan and never rereads settings. Queue creation can normalize and resolve before execution, then pass the same resolved value to the executor. Retry and recovery hydrate the complete persisted binding snapshot into a `ProviderModelBinding`; only the same profile's current credentials, enabled state, and Base URL are read.

No image execution has a legacy no-plan network branch. If planning produces no executable binding, a requested binding is absent, or a snapshot is incomplete or inconsistent, resolution fails with a structured binding/recovery error before adapter or transport execution.

The resolved invocation owns an observability recorder that cannot influence routing. It records normalization, planning, adapter selection, capability validation, reference preparation, submit, poll, response parsing, artifact caching, and terminal persistence. Deterministic counters cover planner calls, adapter resolution, unique reference materializations, submit requests, poll requests, response parses, cache attempts, and terminal writes. Tests assert counts; production logs retain only numeric snapshots and never prompts, credentials, URLs, Base64, or provider payloads.

### Reference preparation and bounded work

`executeResolvedImageInvocation` is the single production adapter-execution boundary. It materializes the invocation's reference images and mask through one invocation-scoped memo, preserves caller order, limits concurrently active materializations, checks the same `AbortSignal` before and after each asynchronous boundary, then projects exactly one adapter request. Direct callers and the task-backed executor use this function instead of calling `adapter.generateImage` themselves.

Artifact persistence similarly performs stable first-seen de-duplication and uses a fixed concurrency bound. Duplicate sources in one provider result share one cache operation and are projected back without provider-specific parsing. No unbounded `Promise.all` remains in the image reference or artifact persistence paths.

### Binding and endpoint authority

`InvocationPlan.binding` remains the only authority for protocol, request schema, response schema, submit path, poll path template, and Base URL strategy. In `providerType=auto`, an adapter must explicitly list the selected request schema. Manual provider modes retain their existing binding-inference semantics, but image transport still requires and obeys the resulting plan.

GPT, Gemini/default, MJ, Flux, Seedream, and asynchronous-image serializers may encode their request-schema-specific payload, but they must use the selected binding paths. The executor has no fixed `/images/generations` fallback, and the asynchronous service has no planner, endpoint, parser, or polling fallback outside the binding contract. The uncalled Photo Wall client executor is deleted instead of being adapted or retained as another routing surface.

The Gemini image transport helper requires the adapter-provided invocation config and a complete binding at its type and runtime boundary. It cannot reread settings or fall back to `/images/generations`; a missing or mismatched binding fails before transport. Provider rejection logging retains only a bounded structured message and status, never the complete response body or image bytes.

### Binding-scoped capabilities

Image capability metadata is attached to or resolved for the selected binding. Explicit binding/discovery metadata wins; compatible static model configuration is a scoped fallback; absence is conservative and never inferred solely from a model name. Validation runs once before provider transport and returns structured errors for unsupported operation, mask, reference count, size/aspect ratio, resolution, quality, background, output format, compression, and count.

Provider-specific values inside canonical `params` use a request-schema-scoped allowlist rather than generic passthrough. Only keys consumed by a proved production serializer are registered: the MJ schema owns its `mj_*` controls and the Seedream schema owns `seedream_quality` with its supported values. GPT, Gemini, generic, asynchronous, and Flux schemas accept no arbitrary provider parameter. An unknown key, a key selected under the wrong request schema, or an invalid type/value produces `IMAGE_PARAMETER_UNSUPPORTED` during capability validation and performs zero adapter or transport calls.

Image parameter controls use `resolveImageParametersForSelection(modelId, modelRef, intent)` and prune submitted values through the shared capability contract. A missing/mismatched `ModelRef`, missing plan, ambiguous binding, or unknown schema produces an `unresolved` presentation state: unproved canonical controls are hidden rather than restored from a bare model ID. Explicit adapter-specific non-canonical controls may remain when they have their own evidence. Single, batch, AI Input/Agent, Comic, and chat-drawer image controls converge on this same boundary.

### Artifacts

Adapters return ordered `ImageArtifact[]`. Each artifact carries one normalized source URL or data URL and a supported MIME type, with optional dimensions/format metadata. Provider response details (`b64_json`, Gemini inline variants, URL arrays) are parsed only inside adapter/result-normalization code. The binding-selected asynchronous parser collects singular `url`/`video_url`, plural `urls`, and `data` entries, preserves provider array order, and removes duplicate sources without reordering entries already present in those arrays. Empty data, invalid base64, and unsupported MIME fail before caching. Queue and direct paths preserve order and project artifacts to their existing external `url`/`urls` task shape only at their boundary.

Persisted image task results keep `imageArtifacts` authoritative. The writer centrally derives compatibility `url`/`urls` fields from artifact order; full-task, Asset, Prompt History, result-URL lookup, download, and canvas-facing readers consume the same canonical precedence. Historical results without artifacts continue through the single legacy projection. GitHub compact task sync stores and restores `imageArtifacts` as an optional field so MIME, format, dimensions, order, and identity survive sync. Existing compact records without that field remain valid and are not rewritten or migrated.

Both the primary executor and the legacy pending-task generation boundary await durable caching of every projected artifact before they return a successful task result. Refresh recovery uses the same caching boundary after query-only polling, so no image task can enter `completed` with an uncached provider URL.

### Cancellation and asynchronous recovery

The execution signal is part of the canonical request and is passed to reference-image fetches, submit requests, sleeps, and queries. Cancellation before submit performs zero provider requests; cancellation during polling prevents subsequent queries and prevents cache/completed writes.

`onSubmitted` returns `void | Promise<void>` and is awaited before the first query. Existing task storage persists `remoteId` through that callback. `pollImageInvocationBinding` is the single binding/response-schema-driven query loop used by generic async image, MJ, and Flux immediately after submission and by `resumeImageInvocationPolling` after refresh. A completed response without a valid artifact fails as an invalid result. Recovery requires a persisted remote ID and complete binding snapshot, performs query only, and never invokes submit. The first query cannot begin until `onSubmitted` confirms durable remote-ID persistence; a rejected write aborts the attempt. For queue-owned image work, the persisted `Task.startedAt` is the execution-attempt identity: progress, remote-ID, completion, and failure writes compare that identity atomically, and a late old outcome is returned as `stale` without changing the current attempt. This is an image-scoped write guard inside the existing `ImageExecutionOutcome` flow, not a second lifecycle authority or the global coordinator proposed by `refactor-image-task-lifecycle`.

Task IDs created or explicitly retried by the current page are claimed in a runtime-only set before their first asynchronous storage write. Their TaskQueue execution remains the sole submit, poll, timeout, and AbortSignal owner even after `remoteId` is persisted and emitted. The recovery hook skips those task IDs. After a page refresh the runtime set is empty, so an otherwise valid prior-session `processing` task may enter query-only recovery. Recovery captures `taskId + remoteId + startedAt + profileId + modelId + bindingId`; cancellation, retry, or binding replacement invalidates the capture and prevents a late poll result from committing. No owner field is persisted and no lifecycle migration is introduced.

Normal execution and query-only recovery share the same terminal contract. Recovery success and failure call the guarded image terminal writers and receive an `ImageExecutionOutcome`; TaskQueue applies that returned winning row exactly once. A mismatched `startedAt` yields `stale`, so a cancelled or retried attempt cannot be overwritten by a late recovery result. Recovery does not introduce direct terminal mutation, IndexedDB completion polling, or a second outcome channel.

## Production entry and consumer audit

The current-code audit separates execution entries from downstream consumers so presentation modules do not become routing authorities:

- The single-image dialog and batch-image dialog create queue-backed work through `TaskQueueService`.
- AI Input/Agent media selection and plugin iframe calls enter the MCP image tool's queue path; MCP direct mode shares image normalization, planning, adapter execution, and artifact normalization without implicitly creating a task or inserting into the canvas.
- Workflow's existing main-thread image path, chat-drawer generation, and the model benchmark remain direct according to their existing business semantics while sharing the resolved invocation boundary.
- `media-generation/image-generation-service` owns the direct orchestration boundary; `TaskQueueService` owns task-backed creation/retry; `FallbackMediaExecutor` owns adapter execution; `GenerationAPIService` and the image branch of `useTaskExecutor` own query-only refresh recovery. None of these layers independently infer a protocol after an invocation is resolved.
- PPT/FramePanel, ComicCreator, canvas operations, inspiration-board tools, retry, and refresh recovery preserve the selected `ModelRef` and consume the shared queue/direct result boundaries; they do not select protocols or endpoints locally.
- Task, asset, history, download, cache, and canvas insertion layers consume normalized artifacts or their single boundary projection and do not parse provider-native response fields.
- `services/photo-wall/GridImageService` is not a production generation entry: `generate`, processing, and insertion have no caller in the audited graph, and its board wiring does not serve the live tools. The dead executor module and redundant wiring are removed. Live MCP Photo Wall tools, canvas operations, `grid-splitter`, and `layout-engine` remain unchanged in role.

Across these paths, TaskQueue and direct execution retain distinct persistence/UI semantics, and task-backed `count=N` retains the existing independent-task behavior. A provider response containing multiple artifacts is preserved as one ordered response and is not multiplied again by task-count expansion.

## Error model and user experience

Image invocation failures use stable codes for configuration, binding, adapter, unsupported parameter, network/provider rejection, timeout, cancellation, recovery, and invalid result. UI-facing messages remain concise and no logs include credentials, image bytes, base64 payloads, or complete provider responses. Parameter controls consume the same scoped capabilities used by request validation where an existing UI surface supports dynamic capabilities.

Image progress is factual rather than time-simulated. A persisted or provider-reported numeric value renders determinate progress. When no such value exists, shared task overlays and generation anchors render an indeterminate state with the known execution phase (`submitting`, `polling`, or `downloading`) instead of inventing a percentage. Completion alone represents 100 percent.

## Compatibility and rollback

There is no migration. Existing profiles, complete task binding snapshots, selection keys, default models, and backup formats remain unchanged. GitHub compact task sync adds only the optional `imageArtifacts` result field; old compact payloads remain readable without rewriting, while new payloads preserve per-artifact metadata. Current-session ownership is runtime-only. Legacy request aliases are read at one normalization boundary. A processing task without a complete executable snapshot is not silently upgraded and fails recovery before network access. Rollback ignores the optional compact field and restores prior image execution modules; the persisted invocation snapshot schema is unchanged. Restoring the deleted Photo Wall executor would not be required to restore live Photo Wall behavior because no production caller used it.

## Testing

Focused unit and contract tests cover the intent truth table, aliases, profile/binding isolation, endpoint metadata precedence, exact-schema adapter selection, canonical and request-schema-scoped provider-parameter capability validation, plan-once behavior, immutable plan behavior, all image adapter paths, cancellation, remote-ID ordering, current-session poll ownership, `ImageExecutionOutcome` recovery completion/failure, query-only recovery, factual/indeterminate progress, asynchronous `url`/`urls`/`data` parsing, multi-image ordering and de-duplication, GitHub compact artifact round trips with legacy absence, queue/direct equivalence, and existing image entry points. The performance contract uses an injected monotonic clock to assert exact 2 ms values for normalization, planning, adapter resolution, capability validation, reference preparation, and submit, and proves completed snapshots plus their duration/counter maps are immutable. Typecheck and import search prove the deleted Photo Wall executor has no remaining consumer while the live tools and utilities remain. Shared-router regressions cover text/video/audio. Static checks include typecheck, cycle detection, diff check, lint delta, and production web build. Local validation performs at most one GPT and one Gemini paid generation through the configured `default 分组` profile.
