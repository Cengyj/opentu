# Change: Preserve Archived Prompts in History

## Why

The prompt history tool derives records from terminal tasks, but its service calls the task-summary reader without `includeArchived: true`. The reader defaults that option to `false` and skips every task marked `archived`. The task queue automatically marks the oldest terminal tasks as archived when the active in-memory set exceeds 100, while retaining those records in IndexedDB.

This creates a durable but unreachable history boundary: after enough tasks complete, older prompts disappear from "我的提示词" even though their task records still exist and complete backup/restore explicitly preserves archived generation history for prompt history. Including those records changes the user-visible history set and its read cost, so implementation requires approval.

## What Changes

- Include archived terminal task summaries when deriving prompt history.
- Preserve the current lightweight-summary boundary: uploaded media, analysis payloads, tool-call arrays, and generated blobs remain excluded.
- Preserve current aggregation, deleted-content overrides, filters, pinned ordering, previews, and page size semantics.
- Add regression coverage for archived completed, failed, and cancelled tasks and for the non-prompt active-task views that must continue excluding archived records.
- Measure prompt-history loading with archived data before and after implementation; do not raise a budget or claim an improvement without results.

## Impact

- Affected specs: `prompt-history`
- Related existing spec: `backup-restore` already requires full terminal and archived generation history needed by prompt history to survive restore
- Affected code: `packages/drawnix/src/services/prompt-history-service.ts`, prompt-history/task-reader tests, and F-14 evidence documentation
- Preserved data/API semantics: no IndexedDB schema, task serialization, archive threshold, cache key, provider request, task execution, backup format, migration, cancellation, or retry change
- User-visible trade-off: older archived prompts become visible again; large histories may require more lightweight cursor reads until a separately measured optimization is justified

## Evidence

- `packages/drawnix/src/constants/TASK_CONSTANTS.ts:64-69` sets `MAX_RETAINED_TASKS` to 100.
- `packages/drawnix/src/services/task-queue-service.ts:2498-2535` removes the oldest terminal tasks from active memory and persists `archived=true` instead of deleting them.
- `packages/drawnix/src/services/task-storage-reader.ts:596-609,625-668` defaults `includeArchived` to false and skips archived task records before producing lightweight summaries.
- `packages/drawnix/src/services/prompt-history-service.ts:517-551` reads every terminal summary batch but never opts into archived records.
- `packages/drawnix/src/services/backup-restore/backup-export-service.ts:317-337` exports all stored task records, including the `archived` flag, and restore persists those task records.
- `openspec/specs/backup-restore/spec.md:35-42` requires terminal and archived generation history needed by prompt history to survive backup and restore.

