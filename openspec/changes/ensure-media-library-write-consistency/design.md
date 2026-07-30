## Context

The media-library projection merges localForage local assets, terminal task assets, and unified-cache-only assets, then groups local duplicates by content identity. A user-visible card can therefore represent multiple stored IDs/URLs. The current write paths perform sequential operations across stores but expose only `void`/throw or a single React update, so a partial durable result cannot be represented accurately.

There is no browser transaction spanning localForage, the unified IndexedDB store, Cache API, task storage, Plait board history, and playlist storage. The design must use explicit authoritative owners, compensation only where safe, and per-item results rather than pretending those stores are atomic.

## Goals / Non-Goals

- Goals:
  - Never report upload/subject/delete success while the required authoritative state contradicts the visible state.
  - Preserve user media and canvas elements when a deletion cannot commit.
  - Keep partial batch success truthful and retryable without rolling back successful independent items.
  - Repair or suppress confirmed broken projections on load without cross-origin fetches.
  - Avoid deleting a pre-existing/shared content-addressed cache entry as compensation for a failed new metadata write.
- Non-Goals:
  - Add a general distributed transaction framework, repository abstraction, or new event bus.
  - Change asset/task/cache schemas or migrate existing keys.
  - Add cloud backup, background synchronization, or automatic remote redownload.
  - Change selection/insertion completion, canvas batch layout, or full-screen preview behavior.

## Decisions

- Define authoritative metadata by source:
  - local upload: localForage asset metadata plus readable local media are jointly required;
  - AI asset: task storage is authoritative and unified cache is its media/metadata projection;
  - unified-cache-only asset: the unified cache record/media is authoritative.
- Add/upload records whether the target content-addressed cache entry existed before the attempt. If a later mandatory write fails, compensate only a cache entry created by this attempt and only after checking no current asset/task record references it. A pre-existing entry is never deleted by add compensation.
- Make unified `cacheMediaFromBlob` compensate a newly written Cache API response when its own metadata write fails, subject to the same pre-existing-entry guard.
- For local delete, snapshot the authoritative record, remove it, then delete required cache data. If cache deletion fails, restore the metadata snapshot before returning failure. React state and canvas remain unchanged until the commit result is known. A failed compensation is a distinct partial outcome, forces a fresh read, and surfaces a safe recovery message; it is not reported as clean success.
- Return a structured per-request deletion result (`succeeded`, `failed`, and partial/cleanup diagnostics) from Context. Rebuild affected dedupe groups from remaining authoritative records/cache metadata after settlement. The caller removes board elements and clears selection only for committed successes.
- Do not roll back successful independent members of a batch. Failed cards/records remain selected for retry; successful canvas removals are grouped into one existing history boundary where possible.
- For subject marking, write the source-authoritative task/local record first. A cache-only `updateCachedMedia=false` is failure. Secondary cache projection failure after authoritative success is reconciled by a forced read/update attempt and reported as partial until the visible projection matches; the React subject badge is never committed from a failed authoritative write.
- Represent Cache API availability separately from its key set (`available-empty`, `available-with-keys`, `unavailable/error`). Confirmed-missing `/asset-library/` media is excluded from the usable asset projection and surfaced through aggregate diagnostics; unavailable cache does not trigger metadata deletion or per-item remote fetch.
- Playlist cleanup runs only for committed deletions. Stale playlist IDs are excluded/reconciled against the committed asset projection; playlist-write failure is reported as cleanup partial, not as a restored media asset.

## Alternatives Considered

- Keep cache-first ordering and accept orphaned/invalid records for later quota cleanup.
  - Rejected because current reads can expose broken records and the operation reports a false failure/success boundary.
- Delete canvas elements first and undo with Plait history if storage fails.
  - Rejected because storage failure can outlive the in-memory board session and undo is not a durable cross-store transaction.
- Treat every batch as all-or-nothing.
  - Rejected because stores cannot provide atomic multi-record rollback and deleting independent assets already committed is destructive.
- Delete every content-addressed cache URL during compensation.
  - Rejected because the same URL can be pre-existing or referenced by another merged record/task.
- Filter local metadata whenever the cache-key set is empty.
  - Rejected because empty can currently also mean Cache API unavailable/read failure; availability must be explicit.
- Add a persistent transaction journal.
  - Rejected for the first correction because it changes schema/migration and no evidence yet requires crash recovery beyond deterministic compensation/reconciliation. If page termination during a write remains reproducible after this change, it needs a separate proposal.

## Risks / Trade-offs

- Compensation itself can fail or race with another tab.
  - Mitigation: explicit partial result, reference recheck, forced reconciliation, cross-tab test fixtures, and no false clean-success message.
- Snapshot/restore adds IndexedDB operations to failure paths.
  - Mitigation: measure at least five successful and failed operations; the normal path must not add a full-library scan.
- Rebuilding a dedupe group can change its representative card ID after partial success.
  - Mitigation: preserve content identity/selection by dedupe key and test representative replacement, details, favorites, and canvas references.
- Cache availability diagnostics can temporarily hide a local card during browser storage faults.
  - Mitigation: hide only when absence is confirmed; unknown availability retains metadata with an explicit aggregate warning and no destructive cleanup.
- Task deletion API may not be awaitable in every branch.
  - Mitigation: audit and test task-store completion separately; do not claim AI deletion is committed until its durable owner confirms the result.

## Verification

- Controlled service tests for every boundary: Cache API put success + unified metadata failure; unified cache success + local metadata failure; metadata removal success + cache delete failure + restore success/failure; pre-existing shared cache compensation guard.
- Context tests with merged duplicate records and deterministic mixed `fulfilled/rejected` deletion orders; assert remaining card/IDs/URLs, selection, per-item result, playlist projection, and forced reload.
- Board integration tests: single/batch storage failure removes zero corresponding elements; partial success removes only committed assets; one history boundary and no unrelated element changes.
- Subject tests for local, AI, cache-only, `updateCachedMedia=false`, task/local rejection, secondary projection failure, and refresh reconciliation.
- Read tests for Cache API available-empty, available-with-keys, unavailable, rejected `open/keys`, and no per-item cross-origin fetch.
- Browser flows for upload/delete/subject success, injected failure, retry, refresh, offline, and two tabs; no real user asset is deleted during failure tests.
- Measure at least five add/delete/mark/load samples before/after and report median/range, IndexedDB/Cache operation counts, and any recovery cost.
- Run focused tests, Drawnix lint/typecheck, full typecheck/test/cycles/build/size/startup, and available media-library Playwright flows.

## Rollback Plan

Restore prior service ordering/result types and caller projection logic, and remove compensation/reconciliation tests. Keep the tolerant read path capable of handling partial legacy records. No schema migration or cache purge is part of rollback.
