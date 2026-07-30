## Context

`CleanInvalidLinks` scans root canvas image/video elements and delegates each URL to `checkUrlValidity`. The helper collapses all outcomes to boolean. It handles `blob:` and `data:` locally, issues CORS HEAD for all other URLs, returns `response.ok` immediately, and only tries a no-CORS GET when HEAD rejects. A second rejection becomes `false`. The caller cannot distinguish an absent resource from offline, DNS, CORS, browser-policy, timeout, unsupported method, authorization, or temporary server failure.

False results are removed through Plait operations. Those operations are undoable and flow through React Board after-change, App autosave, IndexedDB, tab synchronization and close snapshots. The correction must therefore be fail-safe without replacing the existing board/persistence owners.

## Goals / Non-Goals

- Goals:
  - Delete only media that the bounded probe definitively classifies as invalid.
  - Preserve media whose validity is unknown and tell the user that those items were not deleted.
  - Preserve valid fast paths, opaque cross-origin compatibility, duplicate-activation guard, history, undo, autosave and retry-by-rerun behavior.
  - Keep result reasons non-sensitive and aggregate; do not surface or log full media URLs.
- Non-Goals:
  - Add continuous link monitoring, automatic retries, a repair service, a confirmation dialog, or a new product action.
  - Rebuild unified cache, media preview, asset deletion, workspace persistence, backup, or `.drawnix` export.
  - Change element schemas, cache keys, storage formats, migration versions, analytics schemas, or network endpoints.
  - Claim reduced latency or request count without a five-sample measurement.

## Decisions

- Introduce a file-local typed outcome such as `{ status: 'valid' | 'invalid' | 'unknown'; reason: ... }`. The result remains internal to F-29; no public API or persisted field is added.
- Preserve `blob:` and `data:` as `valid`. A successful normal response or existing opaque no-CORS fallback remains `valid`.
- Treat only explicit, readable terminal absence responses (HTTP 404 or 410) as `invalid`. Network rejection, offline, aborted probe, DNS, CORS ambiguity, authorization response, rate limit, server error, and unsupported/inconclusive method response are `unknown` unless the bounded fallback produces valid or terminal-absence evidence.
- A non-OK HEAD other than 404/410 is not terminal. Use one GET fallback where current browser policy permits. Do not add additional retries or parallel probes.
- Partition results before mutation. Remove only `invalid` entries in reverse board order. Keep `unknown` entries untouched and provide localized aggregate counts for removed and preserved-unknown outcomes. Valid/unknown URLs themselves are not displayed or logged.
- Keep `isScanning` as the single-run guard. The action becomes available again in `finally`, which is the existing manual retry mechanism.
- Keep `Transforms.removeNode` for confirmed removals so existing history, undo, after-change, workspace save, tab sync and close snapshot behavior remains intact. Do not directly mutate `board.children`.

## Alternatives Considered

- Treat every fetch rejection as invalid.
  - Rejected because the deterministic diagnostic proves it deletes content when reachability is unknown.
- Treat every non-OK response as invalid.
  - Rejected because 401/403/405/429/5xx do not prove resource absence and can be temporary or method-specific.
- Preserve all HTTP failures, including 404/410.
  - Rejected because it would make the existing cleanup incapable of removing definitively absent CORS-readable resources.
- Consult only the unified cache.
  - Rejected because remote canvas media may be valid without a cache entry and cache availability is not URL validity. Cache integration would also cross F-06/F-13 boundaries without evidence.
- Add a confirmation dialog after scanning.
  - Rejected for this minimal correction: the user already invoked a destructive cleanup action, and the confirmed root cause is misclassification. A preview/confirmation product flow would be a separate feature proposal.
- Add retries with backoff.
  - Rejected because retries delay the action, do not resolve offline/CORS ambiguity, and create new timing semantics without measurements.

## Risks / Trade-offs

- Some resources formerly deleted after ambiguous failures will now remain.
  - This is intentional fail-safe behavior. Aggregate unknown feedback lets the user restore connectivity and rerun the existing action.
- Some servers return a misleading 404 to HEAD while GET succeeds.
  - The implementation/test matrix must specify whether a readable terminal HEAD response is accepted directly or confirmed by the single GET fallback. Prefer confirming HEAD absence with GET when that does not exceed the existing maximum of two requests.
- GET no-CORS may return opaque for an error response.
  - Opaque means the browser withholds status; preserving it as valid retains current compatibility and avoids destructive guessing. It is not reported as measured reachability.
- Multiple media entries can share a URL.
  - Classification may be deduplicated only if it preserves per-element removal counts and is measured. The minimal implementation may retain current per-element probes.
- A removal can race with another board edit while probes are pending.
  - Before deletion, resolve the current element by stable identity/path rather than relying solely on the scan-time index, or prove current path references cover the race. Add a focused concurrent-edit test; do not delete a different element after indices shift.

## Verification

- Unit classifier matrix: `blob:`, `data:`, HEAD 2xx, HEAD 404/410 plus chosen confirmation rule, HEAD 405 then GET success, HEAD 403/429/5xx, HEAD rejection then opaque GET, both requests rejected, and abort.
- Component matrix: no media, all valid, all invalid, all unknown, mixed results, duplicate activation, unmount/late completion, shared URL, and board index change during probe.
- Board integration: confirmed removals form normal Plait history, one undo restores all removed elements, unknown elements create no remove operation, and after-change contains the correct children.
- App adjacency: current `handleBoardChange`/`WorkspaceService.saveCurrentBoard` receives confirmed removal state; unknown-only scans do not create a board mutation or storage write.
- Browser: same build/data/theme at desktop and compact widths; online valid, intercepted 404/410, and browser-offline rejection. Record DOM messages, retained/removed element counts, undo, reload recovery, request sequence, viewport, locale and screenshots.
- Run focused tests, Drawnix typecheck/lint comparison, full typecheck/test comparison, cycles, production build, size/startup gates, and relevant smoke/feature/visual/responsive suites. No performance claim without at least five comparable samples.

## Migration and Rollback

No data migration, cache invalidation, schema rewrite, or user-data cleanup is required. The change affects only classification before future deletion. Rollback removes the tri-state outcome, feedback keys and tests together; already preserved unknown elements remain ordinary board content.

