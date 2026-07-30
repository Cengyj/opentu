# Change: Prevent Late Batch-Image Cache Hydration From Replacing Accepted Edits

## Why

The batch-image tool renders editable default rows before its asynchronous IndexedDB read settles. If a user edits, imports, adds, or removes row data during that interval, the later non-empty cache result unconditionally replaces the complete table. The save effect waits for hydration, but that only avoids writing defaults early; it does not preserve a mutation already accepted by the UI.

This is statically proven by the current state order and can be reproduced with a deferred `kvStorageService.get()`: mount → accept a row mutation → resolve the old cached snapshot → observe the mutation disappear. Correcting it changes loading and draft-recovery semantics, so implementation requires approval.

## What Changes

- Establish one explicit initial-draft hydration boundary before batch rows can accept mutations, imports, deletion, generation submission, or reference-image changes.
- After the read settles, render the cached draft when valid or the existing five-row default when no usable draft is available.
- Preserve the existing cache key, record shape, row IDs, task IDs, image references, migration/backup inclusion, and post-hydration write behavior.
- Keep cache-read failure fallback, model/provider routing, task execution, canvas insertion, asset storage, Excel behavior, and tool-window behavior unchanged.
- Add a controlled deferred-read component test that proves no accepted mutation can be replaced by the late snapshot.

## Impact

- Affected specs: `batch-image-generation`
- Affected code: `packages/drawnix/src/components/ttd-dialog/batch-image-generation.tsx` and focused component tests
- Related storage: existing `batch-image-generation-cache` value in kvStorage/IndexedDB and existing environment backup/migration registration; no schema or migration change
- Related changes: `ensure-prompt-storage-write-consistency` has a similar initialization-order root in a different prompt-storage subsystem; its queue/log design must not be copied into this component without evidence
- Preserved contracts: no provider request, task record, cache key, asset record, Excel format, model preference, or canvas element changes
- Rollback: remove the hydration gate/state test and restore immediate default-row interaction; no data cleanup or migration is required

## Evidence

- `packages/drawnix/src/components/ttd-dialog/batch-image-generation.tsx:366-403` renders default tasks and starts an asynchronous whole-table read whose non-empty result calls `setTasks(cached.tasks)`.
- `packages/drawnix/src/components/ttd-dialog/batch-image-generation.tsx:675-688` suppresses writes until `cacheLoaded`, but has no dirty version, merge, or interaction gate.
- `packages/drawnix/src/components/ttd-dialog/batch-image-generation.tsx:800-819,1253-1564,2625-2960` exposes row mutation paths while the read is pending.
- The tool is reachable through `tools/built-in-manifests.tsx:71-81` → `tools/registry.tsx:12-16` → `tools/tools/batch-image/index.tsx:8-64`.
- Full proof and browser boundary: `docs/evidence/f19-batch-image/diagnostics.md` and `metrics.json`.
