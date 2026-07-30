# Change: Preserve MV Creator Record Consistency And Recovery

## Why

The MV creator accepts mutations to the single `mv-creator:records` value from every open tool window, Analyze/Script autosave, subject selection, storyboard/rewrite/music task synchronization, Generate task projection, history favorite/delete actions, and batch image/video completion. The tool manifest explicitly permits multiple windows, while every storage helper performs an independent whole-array load-modify-set.

A controlled Vitest diagnostic invoked the real MV storage module with concurrent non-conflicting favorite and title patches. The expected durable result was `{ starred: true, sourceLabel: "新标题" }`, but the actual result was `{ starred: false, sourceLabel: "新标题" }`. The one-test diagnostic exited 1 and was removed after recording the raw value.

There is also a refresh gap. `useWorkflowTaskSync` scans the current in-memory task map once when it mounts. Persisted task storage is restored later, while `restoreTasks()` emits one generic event for only the first task in the map. A restored terminal MV storyboard, rewrite, or music task that is not represented by that event is not reconciled.

Several accepted edits start writes with `void`, and Analyze/Script autosave plus history mutations have no safe visible rejection state. A rejected write can leave optimistic state visible while durability is unknown.

Mutation ordering, post-restoration reconciliation, and persistence feedback change storage and recovery semantics, so implementation requires approval.

## What Changes

- Serialize mutations accepted for `mv-creator:records` in one application runtime so an older load-modify-save operation cannot overwrite a later accepted edit, subject selection, task result, favorite, deletion, reset, or batch result.
- Reconcile every relevant terminal MV task after persisted task storage becomes ready, including tasks not represented by the task queue's generic restoration event.
- Keep local page listeners, shared live completion, and restored-task reconciliation idempotent by task ID without replacing the currently selected unrelated record.
- Surface a safe visible persistence failure while retaining the current in-memory edit; clear only that warning after a later successful save.
- Preserve record/task schemas, storage key, 50-record retention rule, generated media references, provider routing, batch semantics, export contract, model preferences, and history selection.

## Impact

- Affected specs: `video-mv-workflow-parity`
- Affected code: MV storage/task sync/pages, shared task-storage readiness or reconciliation boundary, focused tests
- Related changes:
  - `fix-comic-creator-record-consistency` and `fix-video-analyzer-record-consistency` cover the same defect class for different keys; the three changes must not create competing global readiness coordinators.
  - `fix-main-thread-workflow-recovery-sync` may provide the shared task-storage-ready signal but does not own MV records.
  - `update-video-batch-parallel-generation` has a separate unresolved scheduling-spec conflict; this change does not choose serial or parallel behavior.
- Preserved data/API semantics: no migration, key, record shape, task shape, provider request, cache key, export format, or history cap changes

## Evidence

- `packages/drawnix/src/tools/tools/mv-creator/index.tsx:44-57` declares `supportsMultipleWindows: true`.
- `packages/drawnix/src/components/mv-creator/storage.ts:17-41` delegates all record writes to shared whole-array helpers.
- `packages/drawnix/src/components/shared/workflow/record-storage.ts:48-106` performs independent load-modify-save operations without key-specific ordering.
- Controlled diagnostic: Vitest 3.2.4, one file/one test, exit 1; expected `{ starred: true, sourceLabel: "新标题" }`, received `{ starred: false, sourceLabel: "新标题" }`.
- `packages/drawnix/src/components/mv-creator/pages/AnalyzePage.tsx:138-166,236-282,298-378` shows autosave, audio selection, and storyboard writes with separate owners.
- `packages/drawnix/src/components/mv-creator/pages/ScriptPage.tsx:151-223,292-360` shows character/shot/autosave and local rewrite synchronization outside the shared container hook.
- `packages/drawnix/src/components/mv-creator/pages/GeneratePage.tsx:316-438,613-736,1177-1223,1387-1781` shows parameter persistence and concurrent media result writers.
- `packages/drawnix/src/components/mv-creator/pages/HistoryPage.tsx:128-147` shows favorite and delete mutations.
- `packages/drawnix/src/components/shared/workflow/useWorkflowTaskSync.ts:34-71` scans memory once and then handles only emitted tasks.
- `packages/drawnix/src/hooks/useTaskStorage.ts:55-80,242-254` defers restoration and keeps readiness at its direct caller.
- `packages/drawnix/src/services/task-queue-service.ts:2370-2437` restores all snapshots but emits a generic event for only the first in-memory task.

