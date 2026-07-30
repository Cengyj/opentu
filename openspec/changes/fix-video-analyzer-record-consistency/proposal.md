# Change: Preserve Video Analyzer Record Consistency

## Why

The video analyzer accepts record mutations from multiple reachable owners: every open tool window, the page-local task subscriber, the shared workflow task subscriber, script autosave, generation-task synchronization, and history actions. The tool manifest explicitly allows multiple windows.

All mutations eventually use a load-modify-save sequence for the single `video-analyzer:records` value. That sequence has no same-runtime ordering boundary. Two controlled Vitest diagnostics held the current value in a mock store and invoked the real shared record helpers concurrently:

1. Concurrent patches `{ label: 'New' }` and `{ starred: true }` ended with `{ label: 'Old', starred: true }`.
2. Concurrent additions of records `a` and `b` ended with only `['b']`.

There is a related refresh gap. `useWorkflowTaskSync` scans only the task queue's current in-memory map when it mounts. Task restoration is deferred; `restoreTasks()` later emits only one generic event for the first restored task. A video-analyzer task that is not that task is not reconciled by the hook unless another event for that exact task occurs. This can make a completed task remain in task storage without the analysis record required by the current `video-analyzer` specification.

Script autosave and several generation result writes also await or start record persistence without a rejection handler that can inform the user. A rejected write can therefore leave the edited UI state visible while durability is unknown.

Fixing mutation ordering, post-restoration reconciliation, and persistence feedback changes storage and recovery semantics, so implementation requires approval.

## What Changes

- Serialize video-analyzer record mutations accepted in one application runtime so an older load-modify-save operation cannot overwrite a later accepted mutation.
- Reconcile all relevant completed video-analyzer tasks after persisted task restoration, not only the one task used for the generic task-queue refresh event.
- Keep task reconciliation idempotent by task ID and preserve the current-record selection; recovery does not automatically replace an unrelated record the user is editing.
- Surface a safe, visible persistence failure for user edits and automatic result writeback, and clear the warning after a later successful save.
- Preserve record/task schemas, storage keys, the 50-record retention rule, model routing, task execution, batch-generation semantics, and existing input-source snapshots.

## Impact

- Affected specs: `video-analyzer`
- Affected code: video-analyzer storage/task sync/pages, shared workflow task-storage readiness or reconciliation boundary, focused tests
- Related changes:
  - `fix-main-thread-workflow-recovery-sync` changes recovery ownership for AI-input WorkZones and may touch the same task-storage readiness boundary; the implementations must not create two competing global recovery coordinators.
  - `ensure-prompt-storage-write-consistency` addresses a similar ordering class in a different storage domain and does not cover `video-analyzer:records`.
- Preserved data/API semantics: no IndexedDB schema, serialized record shape, task shape, cache key, provider request, concurrency limit, or history cap changes
- User-visible trade-off: concurrent record writes complete in accepted order rather than racing; a failed save is reported instead of being silently treated as durable

## Evidence

- `packages/drawnix/src/tools/tools/video-analyzer/index.tsx:44-57` declares `supportsMultipleWindows: true`.
- `packages/drawnix/src/components/video-analyzer/VideoAnalyzer.tsx:69-84` and `pages/AnalyzePage.tsx:710-779` install shared and page-local task completion consumers.
- `packages/drawnix/src/components/video-analyzer/task-sync.ts:155-200` performs `loadRecords()` followed by `addRecord()` for each completed analysis task.
- `packages/drawnix/src/components/shared/workflow/record-storage.ts:48-103` implements add/update/delete as independent load-modify-save operations.
- `packages/drawnix/src/components/video-analyzer/pages/ScriptPage.tsx:219-270` starts debounce, shot, and character writes without a common ordering or persistence-error boundary.
- `packages/drawnix/src/components/video-analyzer/pages/GeneratePage.tsx:638-644,759-764,1187-1190` starts automatic record writes with `.then(...)` and no rejection path.
- `packages/drawnix/src/components/shared/workflow/useWorkflowTaskSync.ts:34-71` scans the current memory map once, then handles only each emitted task.
- `packages/drawnix/src/hooks/useTaskStorage.ts:55-80` restores tasks asynchronously after an idle boundary.
- `packages/drawnix/src/services/task-queue-service.ts:2370-2434` restores all task snapshots but emits only the first task as a generic refresh event.
- `openspec/specs/video-analyzer/spec.md:6-30` requires completed analysis and rewrite tasks to write their structured result into the corresponding analysis record.
- Controlled diagnostics: Vitest 3.2.4, Node runtime supplied by the workspace; each run executed 7 tests in one file with 6 passing and the diagnostic assertion failing. Raw received values were `{ label: 'Old', starred: true }` and `['b']`.

