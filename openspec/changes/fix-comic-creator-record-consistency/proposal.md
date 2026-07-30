# Change: Preserve Comic Creator Record Consistency And Recovery

## Why

The comic creator accepts mutations to the single `comic-creator:records` value from every open tool window, page editing, history actions, local task waits, and the shared terminal-task subscriber. The tool manifest explicitly permits multiple windows. Component-local persistence is ordered through one `persistQueueRef`, but mutations outside that component instance do not enter the same queue.

A controlled Vitest diagnostic invoked the real comic storage module with concurrent non-conflicting title and favorite patches. The persisted result was `{ starred: false, title: "新标题" }`, proving that the favorite mutation was lost. The diagnostic ran one test with one failure and was removed after recording the raw result.

There is also a refresh gap. `useWorkflowTaskSync` scans the current in-memory task map once when it mounts. Task storage is restored later after an idle boundary, while `restoreTasks()` emits one generic event for only the first task in the map. A restored completed comic task that is not that first event is not reconciled, leaving a record in a stale planning or image-generation state.

Several accepted edits start `persistPatch()` with `void`, and history mutations await storage without a visible rejection boundary. A rejected write can therefore leave optimistic UI visible while durability is unknown.

Mutation ordering, post-restoration reconciliation, and persistence feedback change storage and recovery semantics, so implementation requires approval.

## What Changes

- Serialize mutations accepted for `comic-creator:records` in one application runtime so an older load-modify-save operation cannot overwrite a later accepted add, edit, task result, favorite, or deletion.
- Reconcile every relevant terminal comic task after persisted task storage becomes ready, including tasks not represented by the task queue's generic restoration event.
- Keep live completion and restored-task reconciliation idempotent by task ID and preserve the currently selected unrelated record.
- Surface a safe visible persistence failure while retaining the current in-memory edit; clear only that warning after a later successful save.
- Preserve the record/task schemas, storage key, 50-record retention rule, model/provider routing, generation concurrency, export behavior, cache references, and history selection semantics.

## Impact

- Affected specs: `comic-generation-workflow`
- Affected code: comic creator storage/task sync/component state, shared task-storage readiness or reconciliation boundary, focused tests
- Dependency: `add-comic-strip-generator` defines the still-active base capability and should be archived or co-approved before this delta is merged.
- Related changes:
  - `fix-video-analyzer-record-consistency` covers the same defect class for a different storage key; the two implementations must not create competing global task-storage-ready coordinators.
  - `fix-main-thread-workflow-recovery-sync` owns AI-input WorkZone/Chat recovery and may provide the shared readiness signal; it does not own comic records.
- Preserved data/API semantics: no migration, key, record shape, task shape, provider request, cache key, or history cap changes

## Evidence

- `packages/drawnix/src/tools/tools/comic-creator/index.tsx:44-61` declares `supportsMultipleWindows: true`.
- `packages/drawnix/src/components/comic-creator/ComicCreator.tsx:1127-1161` orders only mutations routed through one mounted component's `persistQueueRef`.
- `packages/drawnix/src/components/comic-creator/ComicCreator.tsx:1362-1422,2124-2156` shows page edits and history mutations reaching storage through different owners.
- `packages/drawnix/src/components/comic-creator/storage.ts:42-72` delegates all record writes to the shared whole-array helpers.
- `packages/drawnix/src/components/shared/workflow/record-storage.ts:48-106` performs independent load-modify-save operations without a key-specific ordering boundary.
- Controlled diagnostic: Vitest 3.2.4, one file/one test, exit 1; expected `{ starred: true, title: "新标题" }`, received `{ starred: false, title: "新标题" }`.
- `packages/drawnix/src/components/shared/workflow/useWorkflowTaskSync.ts:34-71` scans memory once and then handles only emitted tasks.
- `packages/drawnix/src/hooks/useTaskStorage.ts:55-80,242-254` defers storage restoration and exposes readiness only to its direct caller.
- `packages/drawnix/src/services/task-queue-service.ts:2370-2437` restores all snapshots but emits a generic event for only the first in-memory task.
- `packages/drawnix/src/components/comic-creator/task-sync.ts:57-213` requires the matching pending outline/task ID before writing a terminal result.
- `packages/drawnix/src/components/comic-creator/ComicCreator.tsx:1362-1422` starts accepted edit writes with `void persistPatch(...)` and no user-visible rejection handler.

