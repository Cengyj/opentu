# Design: Deferred version-update notification delivery

## Context

Runtime version state is authoritative in bootstrap/SW. VersionUpdatePrompt is intentionally non-critical and delayed. An EventTarget notification alone has no replay semantics, so correct behavior cannot depend on which lifetime starts first.

## Goals and non-goals

Goals:

- Make early and late readiness produce the same eventual prompt.
- Keep a single authoritative current-page pending version.
- Preserve every existing commit, reload and task-safety rule.
- Avoid pulling the full update UI or task queue into the initial startup graph.

Non-goals:

- Change SW install/prewarm/activate, cache names, update polling frequency or waiting-worker protocol.
- Persist pending UI state across reload.
- auto-commit, auto-reload, bypass active tasks or add an update setting.
- redesign/localize the prompt; that is owned by improve-version-update-interface-accessibility.
- change startup deferral; that remains owned by refactor-startup-shell-loading.

## Decisions

### Use a typed page-local snapshot plus notification

The bootstrap boundary will publish a minimal immutable value containing only the pending version and a monotonic in-page revision before notifying listeners. The delayed consumer reads the current value on mount and subscribes for later changes. Authoritative no-pending state clears it; a different version replaces it.

The implementation may use the existing typed Window boundary or a tiny runtime module already reachable by both sides. It must not introduce a general event bus, Repository, durable store or package-wide state framework.

### Keep release validation in the current consumer

The snapshot carries only readiness identity. VersionUpdatePrompt retains the existing same-origin version.json validation and fallback to the event/runtime version. Changelog content is not copied into bootstrap.

### Preserve task and commit semantics

updateAvailable may be retained while activeTasks is non-empty, but the prompt remains hidden exactly as today. The user-confirmed-upgrade event remains the only UI confirmation. Bootstrap resolves a live non-controller waiting worker and only then marks confirmation and posts COMMIT_UPGRADE. Missing worker keeps the prompt current and triggers the existing state/update checks.

### Clear only from authoritative state

Natural activation, no pending version, or a pending version equal to committed clears the page-local readiness. UI unmount alone does not clear it. A stale version.json response must not overwrite a newer in-page revision.

## Invariants

- No pending version is stored in localStorage, sessionStorage, IndexedDB or Cache API.
- No task/provider/workflow/workspace data or schema changes.
- No full update component import in the initial static dependency graph.
- No duplicate prompt/confirmation/COMMIT_UPGRADE for one current version.
- Active tasks still suppress the visible prompt without discarding readiness.
- User confirmation remains explicit and reload still waits for activation/controller change.
- Version/changelog values remain release data and are not translated or modified here.

## Risks and mitigations

- Stale async version.json response after a newer update: compare the in-page revision/version before committing UI state.
- Duplicate native/duplex/version-state signals: deduplicate at the readiness owner and test exact notification/commit counts.
- Natural activation leaves stale UI: clear on authoritative no-pending/committed state.
- Startup graph regression: keep the boundary data-only and verify entry graph/bytes before and after.
- Multi-tab mismatch: each page owns its UI snapshot; SW version state remains authoritative per client, with no cross-tab localStorage broadcast.

## Verification

- Red/green component tests for event before mount, event after mount, same-version duplicate, A→B replacement, clear before/after fetch, unmount/remount and stale fetch completion.
- Integration tests for active task → terminal transition, missing waiting worker, one user action → one COMMIT_UPGRADE, natural activation, controllerchange, visibility state request and reload.
- Multi-tab synthetic test with separate page-local owners and shared mocked SW state.
- Focused Web/Drawnix tests, typecheck/lint, full tests, cycles, build:web, size and verify:startup against baseline.
- At least five unchanged-state startup and delayed-mount samples before/after; report raw values/median/range. Do not claim speed without measured improvement.

## Rollback

Remove the page-local snapshot/handshake and its tests, restore the event-only producer/consumer, and revert flow documentation. No cache, storage or user-data cleanup is required. Because this workspace has no Git metadata, rollback must be an explicit file patch.
