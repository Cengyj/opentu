# Change: Make knowledge-base multi-store mutations truthful and recoverable

## Why

Knowledge-base notes are split across localForage stores for metadata, content, tags, associations, directories, and legacy note images. Interactive CRUD, directory cascades, Markdown import, backup restore, and GitHub sync write more than one of those stores without a transaction, compensation, or structured partial result.

A deterministic failure-injection diagnostic at the current source (Node 24.14.0, Vitest 3.2.4, jsdom, in-memory localForage stores) passed 4/4 current-behavior assertions in 8 ms:

1. content-write failure after `createNote` left visible metadata with no content record;
2. metadata-write failure after `updateNote` left new content with the old title and `updatedAt`;
3. metadata-delete failure after `deleteNote` left the note metadata after its content and tag associations were removed;
4. the first replacement-tag write failure left none of the original associations.

The diagnostic file was removed after the run. The same ordered-write pattern is statically present in directory cascade, duplication, import/restore, and GitHub apply paths. Changing commit order, compensation, batch result shapes, and recovery semantics affects durable user data and requires approval.

## What Changes

- Define note metadata as the visible owner and make create/update/delete resolve successfully only when required metadata/content/association projections match the reported result.
- Snapshot the minimum affected records and compensate safely when a later required write fails; report an explicit recovery failure if compensation also fails.
- Replace remove-all-then-add tag updates with a diffed, recoverable mutation that preserves the old set on rejection.
- Give directory duplication/deletion, Markdown/ZIP/backup import, and GitHub apply truthful committed/failed item outcomes so counts and UI messages never hide partial persistence.
- Preserve note IDs, stores, record schemas, backup v1/v2/v4 compatibility, `asset://` bodies, directory/tag rules, and merge precedence.
- Add deterministic failure injection at every write boundary, idempotent retry tests, and refresh/reopen reconciliation coverage before implementation.

## Impact

- Affected specs: `knowledge-base-storage-consistency`; `backup-restore` parity scenarios
- Affected code: `knowledge-base-service.ts`, `kb-import-export-service.ts`, shared backup-core adapter/result boundary, GitHub knowledge-base sync, knowledge-base UI feedback, and focused failure/recovery tests
- No IndexedDB version/store/schema, note/tag/image shape, backup version, asset payload, task/provider route, or destructive cleanup migration changes
- User-visible trade-off: failed compound actions can take extra snapshot/compensation reads and can report partial/recovery details instead of a generic success/failure count
- Rollback restores the ordered writes and old result shapes/tests; no migration or cache purge is required, but any inconsistency created before rollback remains existing data to diagnose rather than delete

## Current Evidence

- `knowledge-base-service.ts:290-321` writes metadata before content on create.
- `knowledge-base-service.ts:324-350` writes content before metadata on update.
- `knowledge-base-service.ts:352-362` deletes associations and content before metadata.
- `knowledge-base-service.ts:524-537` removes all associations before adding replacements.
- `knowledge-base-service.ts:239-253,364-390` performs directory/note cascades one item at a time without batch outcome or rollback.
- `kb-import-export-service.ts:189-213` delegates direct meta/content/tag/image writes to the shared import core; `apps/web/public/sw-debug/shared/backup-core.js:367-452` writes note metadata before optional content and increments counts before later associations/images finish.
- `github-sync/knowledge-base-sync-service.ts:170-224` sequentially applies all stores and returns `void`, so a rejection exposes no committed-prefix result.
- The controlled four-boundary sample proves the interactive residue states; real-browser storage failure frequency and cross-tab conflicts remain unknown.
