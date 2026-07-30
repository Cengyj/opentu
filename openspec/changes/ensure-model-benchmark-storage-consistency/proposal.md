# Change: Ensure Model Benchmark Storage Consistency

## Why

`ModelBenchmarkService` starts a KV read in its constructor, accepts synchronous mutations before that read completes, and later replaces the complete in-memory state with the loaded snapshot. Its persistence path also launches unawaited whole-state writes without an ordering or failure boundary.

Controlled Vitest diagnostics proved both races: a session created before a delayed load disappeared when the older snapshot resolved, and two accepted session writes resolved in reverse order so durable state regressed from two sessions to one. These are storage/recovery semantics and require approval before implementation.

## What Changes

- Establish one shared initialization result and make persisted benchmark mutations resolve only after successful initialization.
- Serialize accepted whole-state writes so their completion order cannot regress durable benchmark state.
- Preserve current in-memory state and surface a safe unsaved-state signal when persistence rejects; a later successful write may clear only the matching stale failure.
- Keep the current key, state/session/entry shapes, 12-session retention rule, active-session semantics, and independent-store boundary.

## Impact

- Affected specs: `toolbox`
- Affected code: `model-benchmark-service.ts`, workbench persistence feedback, focused service/UI tests
- Storage remains at `aitu:model-benchmark:sessions`; no migration, deletion, task-history merge, cross-tab transaction, or provider request change
- Rollback removes readiness/write sequencing/feedback and tests; existing sessions remain readable, but data already overwritten before the fix cannot be reconstructed

## Evidence

- `model-benchmark-service.ts:487-530` starts `void this.load()` and replaces the complete subject state after await.
- `model-benchmark-service.ts:532-547` launches `kvStorageService.set` without await, catch, or a per-key ordering boundary.
- Isolated diagnostic, Node 24.14.0 / Vitest 3.2.4: 1 file, 8 tests passed, exit 0. The first test observed delayed-load overwrite; the second completed two writes newest-first then oldest-last and observed one durable session versus two in memory. The temporary test was deleted.

## Approval

Implementation is blocked until the user approves readiness, ordered durability, and visible safe failure semantics.
