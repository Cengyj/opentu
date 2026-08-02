## 1. Evidence and contract

- [x] 1.1 Record every production image entry, request alias, operation decision, planner/adapter lookup, asynchronous path, and result consumer from current code and tests, including the non-production Photo Wall generator
- [x] 1.2 Add the canonical normalized image request, operation intent, resolved invocation, artifact, capability, and structured-error types
- [x] 1.3 Add normalization and generation/edit truth-table tests, including persisted snake_case and nested aliases

## 2. Planning and capabilities

- [x] 2.1 Resolve each image execution once from final ModelRef through InvocationPlan and exact adapter
- [x] 2.2 Hydrate task binding snapshots without replanning and refresh credentials only from the same enabled profile
- [x] 2.3 Require exact request-schema adapter support for auto profiles and fail ambiguous/unhandled bindings before transport
- [x] 2.4 Resolve and validate binding-scoped capabilities, including dynamic binding metadata, a request-schema-scoped provider-parameter allowlist, and conservative unknown behavior
- [x] 2.5 Preserve manual-provider and text/video/audio routing behavior with regression tests
- [x] 2.6 Converge every production image parameter UI on the shared ModelRef/operation/binding-scoped selection and pruning boundary

## 3. Execution and results

- [x] 3.1 Make GPT, Gemini/default, MJ, Flux, Seedream, and asynchronous image execution use binding submit/poll paths
- [x] 3.2 Propagate AbortSignal through image preprocessing, transport, waits, queries, caching, and terminal writes
- [x] 3.3 Await durable remote-ID persistence before the first query and ensure recovery queries without resubmission
- [x] 3.4 Normalize provider responses into ordered validated ImageArtifact arrays, persist them as the task-result authority, project legacy URL fields once, and round-trip the optional field through GitHub compact sync without migration
- [x] 3.5 Migrate queue, direct, MCP, workflow, benchmark, plugin, PPT, Comic, batch, and canvas image entry points without changing business semantics
- [x] 3.6 Remove no-binding image transport fallbacks and use one binding-driven poller for both post-submit execution and refresh recovery
- [x] 3.7 Remove the uncalled Photo Wall image executor and redundant board wiring after proving its generation/process/insertion chain has no production caller; retain live MCP/canvas tools, splitter, and layout utilities
- [x] 3.8 Keep current-session TaskQueue image work as the sole poll/timeout owner, allow only prior-session tasks with complete recovery identity to enter query-only recovery, and apply recovery success/failure through `ImageExecutionOutcome`
- [x] 3.9 Parse asynchronous `url`, `video_url`, `urls`, and `data` results into ordered de-duplicated artifacts
- [x] 3.10 Render factual numeric image progress as determinate and use indeterminate progress with the known execution phase when no real percentage exists

## 4. Verification

- [x] 4.1 Run focused image and cross-feature regression tests serially
- [x] 4.2 Run drawnix typecheck, cycle check, diff check, lint delta, and web production build
- [ ] 4.3 Strictly validate this OpenSpec change (blocked: `openspec validate ... --strict` exits 127 and `pnpm exec openspec ... --strict` exits 254 because the CLI is unavailable)
- [x] 4.4 Validate exactly one GPT Image and one Gemini Image paid request locally through the configured `default 分组`, including route, HTTP, artifacts, cache, and terminal state; do not repeat either paid request
- [x] 4.5 Audit the final diff/status and confirm protected user changes were not modified

## 5. Invocation efficiency and remaining convergence

- [x] 5.1 Move asset and prompt-lineage metadata into the canonical request and prove serializers cannot receive it
- [x] 5.2 Add one bounded, abortable, invocation-scoped reference/mask materializer and migrate every production adapter call to the shared execution boundary
- [x] 5.3 Add stable de-duplication and bounded concurrency to image artifact persistence, including direct MCP and task-backed paths
- [x] 5.4 Make MJ and Flux use the shared binding poller and fail before query when remote-ID persistence is rejected
- [x] 5.5 Record deterministic per-invocation counters and stage durations and add performance-contract tests, including injected-clock exact duration and immutable snapshot assertions
- [x] 5.6 Re-run focused image, entry-point, cross-modality, type, cycle, lint-delta, diff, and production-build verification
