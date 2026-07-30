# Design: Knowledge-base multi-store write consistency

## Storage boundary and invariants

The database uses separate localForage instances for directories, note metadata, note content, tags, note-tag associations, and legacy note images. localForage does not expose one transaction spanning the existing instances through the current API. The design therefore uses operation-local snapshots, explicit commit points, compensation where the old value is known, and truthful partial results for multi-item operations instead of pretending the stores are atomic.

Note metadata is the visible owner because lists, search indexing, selectors, and exports enumerate it. A note reported as created must have its content record (including the empty string); an update reported as successful must have the same logical title/content generation; a delete reported as successful must remove metadata, content, and associations. Existing IDs, timestamps, metadata, record shapes, and backup formats remain unchanged.

## Decisions

- `createNote`: write content and metadata as one compensated operation. If the second required write fails, remove only the record created by this attempt; if compensation fails, reject with an explicit recovery detail.
- `updateNote`: snapshot the existing metadata and affected content, write the requested values, and restore the snapshot on a later failure. Serialize same-note mutations so compensation cannot overwrite a newer accepted update.
- `deleteNote`: snapshot metadata, content, and associations; perform deletions with a defined final visible commit and restore the snapshot if a required step rejects. Legacy note images are not deleted unless existing reference analysis proves they are unshared.
- `setNoteTags`: compute additions/removals, create additions first, then remove obsolete associations; on rejection remove attempt-created associations and restore attempt-removed ones. Deduplicate requested tag IDs.
- Directory cascade and duplicate operations return per-note committed/failed details. They do not claim all-or-nothing without a real transaction; the UI states partial completion and retains retry targets.
- Shared import and GitHub apply return committed/skipped/failed counts and item identifiers. A note is counted only after required meta/content commit. Later association/image failures are reported separately and retries remain idempotent.
- Keep compensation helpers specific to knowledge-base records. Do not introduce a repository, distributed transaction, event bus, or persistent journal.

## Alternatives rejected

- Reorder writes without compensation: merely changes ghost metadata into orphan content or another partial state.
- Delete every legacy image owned by a note: hash-deduplicated records can be referenced by other notes and need reference proof.
- Clear and re-import the entire knowledge-base on failure: destructive, incompatible with merge mode, and risks unrelated user data.
- Add an IndexedDB schema migration/journal: the current failure evidence can be addressed without a new durable store; revisit only if compensation-failure measurement proves it necessary.
- Treat each batch as atomic: localForage instances provide no such guarantee, and large rollback copies would hide partial success rather than report it.

## Concurrency, recovery, and observability

- Serialize writes per note/directory key; retries use the same requested IDs/content and cannot duplicate tag associations.
- Include operation, phase, committed item IDs, failed item IDs, and compensation outcome in structured results/errors. Logs must not include full note bodies, embedded base64, credentials, or source contents.
- On startup/read, do not delete inconsistent records automatically. Diagnose ghost metadata/orphan content/associations and expose a repair candidate only after a separate approved recovery design if needed.
- Backup/restore and GitHub sync must propagate structured partial outcomes to their existing status/error surfaces.

## Verification and performance

- Failure-inject every set/remove boundary for create, update, delete, tags, directory cascade, duplicate, Markdown/ZIP import, backup merge/replace adapters, and GitHub apply.
- Verify compensation success/failure, idempotent retry, concurrent same-note writes, empty content, long Markdown, legacy inline content, tag dedupe, and shared image references.
- Refresh/reopen after every injected failure and compare metadata, content, associations, counts, search, selector, export, and linked Card projection.
- Measure at least five create/update/delete/tag and 1/10/50-item import samples before/after, recording IndexedDB operation counts, latency median/range, rollback cost, and any UX trade-off. No speed claim is allowed without those values.
- Run focused tests, Drawnix/full typecheck, full tests, cycles, build, size, startup, and available backup/sync/browser flows.

## Rollback

Remove compensated mutations, structured results, UI mapping, and focused tests; restore the old result types. No schema or stored record format changes require migration. Never purge residue automatically during rollback.
