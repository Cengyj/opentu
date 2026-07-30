# Tasks: Make knowledge-base writes truthful

## 1. Evidence and approval

- [x] 1.1 Trace interactive CRUD/tags, directory cascades, Markdown/ZIP import, backup adapters, GitHub apply, and export readers.
- [x] 1.2 Failure-inject create, update, delete, and replacement tags and record exact residue states.
- [x] 1.3 Confirm store names, record schemas, note IDs, backup versions, `asset://` content, and merge precedence can remain unchanged.
- [x] 1.4 Separate editor draft timing from durable store commit and separate responsive UI work.
- [x] 1.5 Check `backup-restore`, Markdown media, canvas binding, generation-context, and active write-consistency changes for conflicts.
- [ ] 1.6 Obtain user approval for compensation, per-note serialization, structured partial batch/import/sync outcomes, and truthful UI feedback.

## 2. Interactive mutations

- [ ] 2.1 Add failing tests for every create/update/delete/tag write and compensation boundary.
- [ ] 2.2 Implement compensated create/update/delete and per-note serialization.
- [ ] 2.3 Implement diffed, deduplicated, compensated note-tag replacement.
- [ ] 2.4 Add directory duplicate/delete per-note outcomes and idempotent retry behavior.
- [ ] 2.5 Preserve empty content, legacy inline content, metadata, timestamps, IDs, and linked Card behavior.

## 3. Import, backup, and sync

- [ ] 3.1 Add failing shared-core tests for note meta/content and association/image failures.
- [ ] 3.2 Count notes only after required records commit and return structured committed/skipped/failed results.
- [ ] 3.3 Map Markdown/ZIP and backup merge/replace partial results to existing UI/status surfaces.
- [ ] 3.4 Add GitHub apply committed-prefix/failed-item results and idempotent retry tests.
- [ ] 3.5 Verify main-app and `sw-debug` knowledge-base parity with identical fixtures.

## 4. Verification

- [ ] 4.1 Run focused service/import/backup/sync/UI tests with exact counts, duration, and exit code.
- [ ] 4.2 Refresh/reopen and compare list, content, tags, search, selector, export, and Card state after every injected boundary.
- [ ] 4.3 Measure at least five interactive and 1/10/50-item batch samples before/after with operation counts and median/range.
- [ ] 4.4 Run Drawnix/full typecheck, full tests, cycles, build, size, startup, and available backup/sync/smoke flows.
- [ ] 4.5 Rewalk normal, failure, partial, retry, merge/replace, GitHub, and legacy paths and update the F-23 ledger/spec documentation.
