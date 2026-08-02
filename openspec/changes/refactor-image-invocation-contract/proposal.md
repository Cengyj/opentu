# Change: Refactor the image invocation contract

## Why

Image generation has accepted several overlapping request shapes, derived generation-versus-edit intent in multiple entry points, and resolved provider plans or adapters more than once during one execution. Specialized adapters and asynchronous services have also retained endpoint, parser, or polling fallbacks outside the selected binding. These parallel decisions can drift after catalog or settings changes, select a different adapter during recovery, begin polling before an asynchronous remote ID is durably stored, or expose parameters that the selected provider-scoped binding cannot execute.

The call-graph audit also found a legacy `GridImageService` under `services/photo-wall` that directly called the image client even though its generation, processing, and insertion methods had no production caller. Its only live integration was redundant board wiring. Keeping that dead executor would leave a second apparent image-routing authority and make future maintenance likely to reconnect it accidentally.

## What Changes

- Introduce one normalized internal image request and one pure operation-intent resolver; historical aliases are accepted only at the normalization boundary.
- Make the image executor DTO carry only task metadata, the canonical request, one credential-free invocation snapshot, and an optional already-resolved invocation.
- Resolve a provider-scoped image invocation once into an immutable request, intent, `InvocationPlan`, exact adapter, and adapter context; an invocation without an executable binding fails before transport.
- Make the complete binding snapshot executable during retry and asynchronous recovery while refreshing credentials only from the same provider profile; never reconstruct a contract from a binding ID alone.
- Resolve image capabilities by `profileId + modelId + operation + binding`, validate unsupported inputs before transport, and drive parameter UI through the same scoped selection helper with conservative unresolved behavior.
- Treat provider-specific image parameters as a request-schema-scoped allowlist: only keys with an implemented serializer contract may reach an adapter, and unknown or wrong-schema keys fail before transport.
- Require automatic-provider image adapters to match the selected request schema exactly.
- Make image adapters use binding submit and poll paths and propagate `AbortSignal` through preprocessing, transport, and polling.
- Await durable remote-ID persistence before the first asynchronous query, and use one binding-driven poller for both post-submit polling and refresh recovery.
- Keep current-page TaskQueue submissions as the sole owner of their submit/poll/timeout loop; only tasks restored from an earlier page session may enter query-only recovery.
- Normalize adapter output to ordered image artifacts before caching or returning results, including ordered de-duplication of asynchronous `url`, `video_url`, `urls`, and `data` result fields.
- Persist canonical `imageArtifacts` as the task-result authority and carry that optional field through GitHub compact task sync; compact records without it remain readable through the single legacy `url`/`urls` boundary and require no migration.
- Carry asset and prompt-lineage metadata through the canonical request boundary while excluding both fields from provider serializers.
- Materialize each unique reference or mask source once per invocation with bounded concurrency, and make every production direct and task-backed entry use that same execution boundary.
- Reuse the binding-driven poller for MJ and Flux as well as generic asynchronous image bindings; a rejected durable remote-ID write stops before the first query.
- Persist unique artifacts with bounded concurrency and expose deterministic invocation counters and stage timings without logging media bytes or affecting routing decisions.
- Commit normal and refresh-recovery terminal writes through the same `ImageExecutionOutcome` boundary, and render progress as indeterminate whenever no factual task or provider percentage exists.
- Converge the audited queue-backed, direct, MCP, AI Input/Agent, workflow, benchmark, plugin, PPT/FramePanel, Comic, batch, canvas, inspiration-board, retry, and recovery paths on the shared contract without changing their task or layout semantics.
- Remove the uncalled Photo Wall image executor and its redundant AI Input board wiring while retaining the live MCP Photo Wall tools, canvas operations, grid splitter, and layout engine.

## Impact

- Affected specs: `image-generation`, `provider-routing`
- Affected code: image invocation, model adapters, image-only executor/queue paths, MCP image tool, benchmark image path, focused consumers/tests, and removal of the uncalled `services/photo-wall` executor entry
- Data impact: no migration; GitHub compact task records gain an optional `imageArtifacts` field, records without it retain the existing legacy read path, complete existing task binding snapshots are reused, incomplete recovery state fails safely, and historical request aliases are normalized at the boundary
- Compatibility: text, video, audio, global queue concurrency, prompts, pricing, model classification, layout, and non-image task lifecycle remain unchanged

## Boundaries

This change does not implement the unapproved global task-lifecycle coordinator, attempt/revision schema, leases, persisted ownership migration, or broad backup/sync lifecycle changes described by `refactor-image-task-lifecycle`. The only sync-format adjustment is the additive optional `imageArtifacts` field in GitHub compact task records; it has no migration and does not change ownership semantics. Current-page poll ownership is runtime-only and image-scoped. The change only strengthens the already-existing image execution boundary and existing `ImageExecutionOutcome` flow.
