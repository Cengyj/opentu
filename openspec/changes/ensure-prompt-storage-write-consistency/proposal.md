# Change: Ensure Prompt Storage Write Consistency

## Why

Prompt storage exposes synchronous in-memory mutations while initialization and every IndexedDB write run asynchronously without an in-flight initialization guard, mutation replay, write ordering, or flush boundary.

Two controlled diagnostics confirm distinct user-data failures from this root cause:

1. When an existing history read is held open and `addPromptHistory()` runs, the mutation writes a provisional one-item cache. When initialization resolves, memory is replaced by the captured old history. The sample ends with memory containing only the old prompt and persistence containing only the new prompt.
2. When an override write is held open and backup collection starts immediately, in-memory resolution returns the newly edited prompt but the generated prompt backup reads an empty override list from IndexedDB.

The app schedules prompt initialization after first-frame idle, while AI input, Chat Drawer, prompt optimization, and the prompt-history tool can synchronously mutate the service. Backup/export reads some prompt domains directly from IndexedDB. Fixing this changes storage timing and backup/import consistency, so implementation requires approval.

## What Changes

- Make prompt-cache initialization single-flight and reconcile any accepted mutations that occur before the initial IndexedDB reads finish.
- Serialize prompt-domain writes from immutable snapshots so older writes cannot complete after and overwrite newer accepted state.
- Add an explicit pending-write flush boundary for backup export and backup import/replace operations.
- Fail or report backup/import prompt-domain persistence errors instead of silently producing a stale prompt payload.
- Preserve synchronous public prompt mutation APIs, existing prompt IDs/content rules, storage keys, schemas, limits, filters, UI feedback, and analytics.

## Impact

- Affected specs: `prompt-history`, `backup-restore`
- Affected code: `packages/drawnix/src/services/prompt-storage-service.ts`, backup export/import prompt boundaries, startup/history/storage/backup tests
- Preserved data/API semantics: no IndexedDB schema, key, prompt/task record format, backup version, provider, cache, task execution, archive, retry, deletion, override, or pinning rule change
- User-visible trade-off: a backup or import may wait for already accepted prompt writes and report a storage failure instead of completing with stale prompt metadata

## Evidence

- `apps/web/src/app/bootstrap.tsx:292-313` schedules migration and prompt-cache initialization after first-frame idle rather than gating workbench rendering.
- `packages/drawnix/src/services/prompt-storage-service.ts:267-313` guards only with `cacheInitialized`; concurrent initialization has no shared promise, and completion replaces every cache.
- `packages/drawnix/src/services/prompt-storage-service.ts:350-359` lets synchronous mutations create provisional empty caches before initialization completes without setting or replaying a mutation version.
- `packages/drawnix/src/services/prompt-storage-service.ts:362-436` starts independent fire-and-forget writes and exposes no completion/flush contract.
- `packages/drawnix/src/components/ai-input-bar/AIInputBar.tsx:3678-3690,3720-3733`, `components/chat-drawer/EnhancedChatInput.tsx:347-361`, and `components/shared/PromptOptimizeDialog.tsx:263-289` synchronously add history from reachable user actions.
- `packages/drawnix/src/services/backup-restore/backup-export-service.ts:289-314` awaits initialization but then reads preset, deleted, and override data from IndexedDB, not the already-mutated cache.
- Diagnostic sample A: Vitest 3.2.4, Node 24.14.0, mocked delayed initial history read; 1/1 passed in 59 ms and recorded the old-memory/new-persistence split.
- Diagnostic sample B: Vitest 3.2.4, Node 24.14.0, mocked delayed override write; 1/1 passed in 1,061 ms and recorded an empty immediate backup override list. Its `localStorage`/localForage stderr was an unrelated Node test-environment warning.

