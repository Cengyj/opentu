## 1. Evidence and Approval

- [x] 1.1 Trace local upload through content hash, unified Cache API/metadata, localForage metadata, React projection, quota, and messages.
- [x] 1.2 Inject local metadata add failure after cache success and record uncompensated call counts.
- [x] 1.3 Inject local metadata remove failure after cache delete and record the surviving record/missing-media ordering.
- [x] 1.4 Distinguish the current available-empty Cache API branch and prove it still returns local metadata.
- [x] 1.5 Trace single/batch delete through dedupe expansion, partial results, React state, selection, canvas, and playlists.
- [x] 1.6 Trace local/AI/cache-only subject metadata writers and the ignored cache update result.
- [x] 1.7 Check cache-warning, subject reuse, selection, batch layout, and responsive changes for requirement conflicts.
- [ ] 1.8 Obtain user approval for compensation, structured partial results, storage-first canvas deletion, and read reconciliation.

## 2. Implementation (Approval Required)

- [ ] 2.1 Add red service tests for add/remove/cache-metadata failure order, pre-existing cache guards, and compensation failure.
- [ ] 2.2 Implement source-authoritative add/metadata writes and safe compensation without changing keys/schema.
- [ ] 2.3 Represent Cache API availability separately from an empty key set and reconcile confirmed-missing media without remote per-item fetch.
- [ ] 2.4 Add red Context tests for merged dedupe groups and mixed batch deletion outcomes.
- [ ] 2.5 Return structured deletion outcomes, rebuild affected groups from remaining records, and preserve failed selection.
- [ ] 2.6 Move single/batch canvas element removal after committed asset deletion and limit it to successful outcomes.
- [ ] 2.7 Make subject writes truthful for local, AI, and cache-only assets and reconcile secondary projections.
- [ ] 2.8 Reconcile playlist references only for committed deletions and expose cleanup-partial diagnostics.

## 3. Verification

- [ ] 3.1 Run focused asset storage/cache/Context/grid/modal/playlist/subject tests with exact counts and exit codes.
- [ ] 3.2 Verify upload/delete/subject normal, failure, partial, retry, refresh, offline, quota, duplicate, and multi-tab scenarios.
- [ ] 3.3 Verify canvas elements and history for single/batch success, failure, and partial success; no unrelated element changes.
- [ ] 3.4 Measure at least five add/delete/mark/load samples before/after with operation counts, median/range, and recovery cost.
- [ ] 3.5 Capture identical before/after success/failure/retry screenshots in desktop/tablet/mobile and light/dark themes.
- [ ] 3.6 Run Drawnix lint/typecheck and full typecheck/test/cycles/build/size/startup; compare failures with baseline.
- [ ] 3.7 Run available media-library smoke/feature/visual/responsive Playwright flows and classify the missing configured browser separately.
- [ ] 3.8 Run OpenSpec strict validation; while the CLI is unavailable, record the blocker and complete a manual operation/name/conflict audit.
