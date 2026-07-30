## Context

`BatchImageGeneration` currently has two initial states: an immediately interactive five-row React state and a later durable snapshot from kvStorage. `cacheLoaded` gates only the save effect. Because hydration performs a whole-table replacement, any accepted mutation scheduled before the read resolves loses to the later snapshot. The stored value is also part of environment backup/migration, so the fix must not change its schema or clear data.

## Goals / Non-Goals

- Goals:
  - Make initial hydration a single authoritative boundary.
  - Ensure the UI does not claim to accept a row mutation before the durable snapshot choice is known.
  - Preserve cached drafts, existing defaults, and post-hydration editing/saving.
  - Keep loading feedback accessible and scoped to the tool content.
- Non-Goals:
  - Add autosave status, conflict resolution across multiple batch-image windows, or a new recovery store.
  - Change the cache key/shape, task schema, image representation, backup format, or row/task history semantics.
  - Optimize IndexedDB time or claim faster startup without before/after samples.

## Decisions

- Decision: gate the editable batch surface on the existing initial read instead of replaying arbitrary pre-hydration mutations.
  - The current default table is not authoritative until the read proves no saved draft exists. Gating has one state owner and does not require a mutation log for every edit/import/upload action.
- Decision: choose cached rows or `getDefaultTasks()` exactly once, then mark hydration complete and enable the current save effect.
  - The existing validation of non-empty task arrays and existing read-failure fallback remain the source selection rules.
- Decision: keep the component mounted and present a compact, named loading state in the content region.
  - This avoids a blank window and supports later component tests without changing outer WinBox behavior.
- Decision: do not add a debounce or change whole-table writes in this change.
  - Write frequency and Data URL cost remain hypotheses until separately measured.

## Alternatives Considered

- Skip applying the cache if any early mutation occurred.
  - Rejected because the visible defaults could overwrite an existing saved draft, silently trading one data-loss direction for another.
- Merge cached and visible rows by array index or row ID.
  - Rejected because imports, deletion, reordering, task-ID history, and reference images have no approved conflict semantics.
- Add an ordered pre-hydration mutation log.
  - Rejected as unnecessary complexity when the read is a one-time local boundary and the tool can accurately expose loading.
- Make the IndexedDB read synchronous or move it into global startup.
  - Rejected because browser storage is asynchronous and global startup coupling crosses F-01.

## Risks / Trade-offs

- A slow or unavailable IndexedDB read delays interaction instead of showing editable defaults immediately.
  - Mitigation: loading appears immediately, read failure keeps the existing default fallback, and five cold/warm samples record time-to-editable before/after.
- Conditional rendering may remount model or asset child controls.
  - Mitigation: keep data hooks mounted where required and test one load transition with stable model/draft projection.
- A rejected read after unmount must not update state.
  - Mitigation: preserve the existing mounted guard and cover cleanup.

## Verification

- Deferred-read component test: no interactive row mutation or submission before settle; resolving a cached draft renders that draft exactly once.
- Empty/malformed/rejected read tests: existing five defaults appear and become editable without an unhandled rejection.
- Cached task IDs, image references, row count/counter, model selection, import/export, and post-hydration save remain unchanged.
- Browser checks at `1280×720`, `768×1024`, and `390×844`, Chinese/English, including a forced delayed read and keyboard focus.
- At least five cold and five warm runs record mount-to-editable median/min/max before and after; no performance claim unless the data supports it.
- Run focused tests, Drawnix typecheck/lint, full typecheck/test/cycles/build/size/startup, and available smoke/feature/visual/responsive flows.

## Rollback Plan

Remove the loading boundary and its tests and restore immediate default-row rendering. The stored key and value remain readable, so rollback needs no migration, cache deletion, or user-data recovery step.
