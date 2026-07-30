## Context

`ToolbarConfigService` owns one whole `ToolbarConfig`, and every public mutation currently publishes a candidate and starts an untracked IndexedDB write. `ensure-toolbar-config-write-consistency` proposes an awaitable persist-before-publish result for a single operation. This change owns only the additional state machine required when a second semantic operation is accepted before the first settles.

## Goals / Non-Goals

- Goals: preserve accepted successful operation order, derive each queued candidate from the last durable state, continue safely after one failure, and make refresh restore the final successful intent.
- Non-Goals: cross-tab coordination, a global persistence framework, write coalescing, optimistic UI redesign, new toolbar actions, storage/schema migration, process-crash or unload flush guarantees, accessibility, or visual redesign.

## Decisions

- Add one domain-local mutation sequence owner inside `ToolbarConfigService`; do not introduce a repository-wide queue or event bus.
- Queue semantic operations (for example, “hide this ID” or “move visible index A to B”), not precomputed whole-record snapshots. When an operation reaches the head, derive its candidate from the last successfully committed configuration.
- Start the next write only after the prior operation has settled. This makes storage invocation/commit order equal accepted execution order without relying on IndexedDB connection timing.
- Reuse the per-operation awaitable result and localized feedback contract owned by `ensure-toolbar-config-write-consistency`. A failed head operation leaves the last durable/shared state authoritative, settles its own result, and does not poison the queue; the next operation derives from that durable state.
- Do not silently coalesce reorder, reset, visibility, or show/hide intents. Their equivalence under failure and intermediate state has not been proven.
- Keep initialization separate: interactive operations remain gated until the current async initialization contract is ready. This change does not add cross-tab or reload-while-pending guarantees.

## Invariants

- Storage key, `ToolbarConfig` version/shape, migration, button IDs, visibility/order rules, and default configuration remain byte-compatible.
- For accepted operations A then B, if both succeed, durable and shared state after settlement represent B applied after A.
- If A fails and B succeeds, B is applied to the last durable state before A; A's uncommitted snapshot cannot later overwrite B.
- If A succeeds and B fails, A remains the durable/shared state.
- One operation produces at most one durable write and one bounded outcome; logs and feedback do not include serialized configuration or unrelated data.

## Risks / Trade-offs

- Serial writes increase completion latency when actions overlap. Measure five single actions and five two-operation bursts; report raw, median, and range before claiming acceptable latency.
- Index-based reorder intent can become stale while queued. Tests must define it against the last committed visible/hidden list and reject invalid indices without corrupting order.
- Pending UI and menu closure can diverge from final feedback if caller promises are floated. All current caller paths must be inventoried and tested with operation identity.
- Applying this change without `ensure-toolbar-config-write-consistency` would leave failure publication semantics undefined; implementation therefore waits for both required approvals.

## Verification And Rollback

- Add red service/provider tests for two and three deferred operations, reverse-capable storage completion, earlier/middle/latest failure, reset plus visibility/reorder composition, and refresh restoration.
- Verify context-menu, More-panel, and two consecutive drag drops with operation-specific pending/failure feedback and no duplicate write.
- Measure sequential and overlapping latency at least five times with the same build/environment.
- Run focused tests, edited-file lint, Drawnix/full typecheck, full tests, cycles, build, size, startup, and available responsive/accessibility E2E against baseline.
- Rollback removes the domain-local sequence owner and tests. No migration or cache deletion is required.
