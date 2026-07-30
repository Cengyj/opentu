## Context
- The toolbox already hosts component-based tools (batch image, video analyzer). Provider routing/runtime discovery supply resolved `modelRef`/`provider` context. Task history imposes retention limits; mixing benchmark data there pollutes user tasks.
- Requirements: per-modality benchmark sessions, lightweight result store, settings shortcut, ranking modes, default low-cost prompts, manual rating/categorization.

## Goals
- Build a dedicated benchmark workbench tool that opens via toolbox or settings shortcut, orchestrates multiple supplier/model invocations per modality, and records the per-entry metrics needed for ranking.
- Keep benchmark data isolated from the core task queue while reusing adapter execution and caching preview URLs only long enough for comparison (no auto-insertion).
- Present default prompts optimized for fast, low-cost tests yet expose override points; allow sorting by speed/cost/composite and manual rating/heart to surface user favorites.

## Non-Goals
- Do not reuse the main task queue for benchmark execution.
- Do not automatically insert benchmark outputs into the canvas or media history.
- Do not implement full AI scoring in V1—manual ratings drive “效果最好”.

## Decisions
1. The workbench stores `BenchmarkSession` → `BenchmarkEntry` records in a dedicated service backed by `KVStorage`, separate from task history. The current implementation uses one whole-store key rather than one key per `sessionId`; initialization and write ordering are governed by `ensure-model-benchmark-storage-consistency`.
2. Execution will call `resolveAdapterForInvocation` with the chosen `modelRef`/`modelId`/`routeType` and run `generateImage/Video/Audio` or `sendChatMessage` (for text) via the existing adapters, capturing start/finish timestamps and HTTP duration.
3. Settings dialog renders quick buttons per provider/model entry. The current global atom handoff is not instance-scoped and is not one-shot; `scope-model-benchmark-launch-handoff` owns the correction without changing benchmark selection semantics.
4. Sorting modes are pure client ranking over `BenchmarkEntry` metadata, but the reachable UI must explicitly select and persist the session ranking mode. Cost-dependent modes must remain truthful when cost is unavailable rather than treating `null` as measured zero.
5. Manual rating (`score` 0-5) and `favorite`/`reject` flags are stored per entry; these influence composite ranking but do not change metrics.
6. Cost capture must use an existing provider/model price source with explicit units and request quantity. When no compatible price is known, `estimatedCost` remains `null` and the UI/export labels it unknown; no fabricated estimate or zero fallback is permitted.
7. Stop behavior and terminal ownership are specified by `control-model-benchmark-run-lifecycle`; this change retains the original user requirement but does not duplicate its cancellation/recovery state machine.

## Preserved Invariants

- Benchmark results remain separate from the task queue and are never automatically inserted into the canvas or media library.
- Provider routing, model references, prompts, concurrency selection, manual feedback, and existing persisted sessions remain compatible.
- Missing price metadata is represented as unknown, not success at zero cost.
- Cost/ranking/stop implementation must not make an additional provider request merely to compute or display metadata.
