# Change: Preserve Music Analyzer Record Consistency And Recovery

## Why

The Music Analyzer accepts record mutations from every open tool window, 400 ms autosave, analysis/lyrics/music task synchronization, favorites, deletion, and generated-clip projection. The manifest permits multiple windows, while every mutation delegates to a whole-array load-modify-set for the single `music-analyzer:records` key.

A controlled Vitest diagnostic released two real `updateRecord()` calls after both had read the same record. The accepted non-conflicting patches were `{ title: "New" }` and `{ starred: true }`. The expected durable result was `{ title: "New", starred: true }`; the actual result was `{ title: "Old", starred: true }`. The diagnostic run had 1 file, 2 passing tests and 1 failing diagnostic, exit 1; the temporary assertion was removed after recording the raw value.

There is also a refresh gap. `useWorkflowTaskSync` scans the current in-memory queue once. Persisted tasks restore later, and `restoreTasks()` emits one generic event for only the first task. A completed Music Analyzer task that is not that representative task can remain absent from its record after refresh. Several autosave/task/history writes also have no shared user-visible persistence failure state.

Mutation ordering, post-restoration reconciliation, and persistence feedback change storage/recovery semantics, so implementation requires approval.

## What Changes

- Serialize mutations accepted for `music-analyzer:records` in one application runtime so an older whole-array write cannot overwrite a later accepted edit, task result, favorite, delete, or generated clip.
- Reconcile every relevant terminal Music Analyzer task after persisted task storage becomes ready, including tasks not represented by the generic restoration event.
- Reuse the single shared task-storage readiness owner required by the existing workflow recovery changes; Music Analyzer SHALL NOT create a second poller or coordinator.
- Keep live and restored task reconciliation idempotent by task ID and preserve the current unrelated record selection.
- Surface a safe visible persistence failure while retaining the current in-memory edit; clear it only after a later accepted save succeeds.
- Preserve record/task schemas, storage key, 50-record retention rule, source snapshot references, provider routing, generation semantics, and history selection.

## Impact

- Affected specs: `audio-generation`
- Affected code: Music Analyzer storage/pages/task sync, shared record mutation helper, shared task-storage readiness consumer, focused tests
- Related changes: `fix-main-thread-workflow-recovery-sync`, `fix-video-analyzer-record-consistency`, `fix-mv-creator-record-consistency`, and `fix-comic-creator-record-consistency` must share one readiness owner and must not install competing global scans
- Preserved data/API semantics: no migration, key, record shape, task shape, provider request, cache key, or retention limit change
- Rollback: remove the Music Analyzer mutation ordering/readiness consumer/save feedback and tests; existing records remain readable, but fields already lost before the fix cannot be reconstructed automatically

## Evidence

- `built-in-manifests.tsx:81-90` and `tools/tools/music-analyzer/index.tsx:43-57` make the tool reachable and multi-window capable.
- `music-analyzer/storage.ts:14-80` delegates every record operation to the shared key helpers.
- `shared/workflow/record-storage.ts:48-106` performs independent load-modify-save operations without per-key ordering.
- Controlled diagnostic raw result: expected `{ title: "New", starred: true }`, received `{ title: "Old", starred: true }`.
- `shared/workflow/useWorkflowTaskSync.ts:34-71` scans memory once and then consumes only emitted tasks.
- `task-queue-service.ts:2425-2434` emits one representative task after restoring the complete map.

