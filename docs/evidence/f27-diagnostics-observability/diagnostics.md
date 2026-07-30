# F-27 diagnostics, analytics, and performance-panel evidence

Date: 2026-07-30 (Asia/Shanghai)

## Scope and environment

- Source state: current workspace without Git metadata; worktree cleanliness and history cannot be checked.
- Runtime: workspace-provided Node.js 24.14.0, Vitest 3.2.4, jsdom, Darwin 22.6.0 x86_64.
- All credential-like values were synthetic `F27_*_SENTINEL` strings. No `.npmrc` contents, application settings, API key, token, provider response, or paid/external request was read or used.
- OpenSpec CLI is absent from `PATH`; strict validation is recorded as blocked and is not represented as passing.
- The first two test commands invoked `pnpm exec vitest` before the workspace Node runtime was selected. Both exited 127 before test collection because `node` was absent from `PATH`. The pnpm warning named the repository credential-setting key but did not print a credential value. These runs are environment failures, not product failures.
- Temporary diagnostic tests were removed after each run. Their assertions describe the current unsafe or inconsistent behavior and are not retained as the desired contract.

## Current forward and reverse chains

### Page analytics and Web Vitals

Forward:

`bootstrap.tsx:277-290` waits for PostHog → `initPageReport()` → initial view, load, unload, visibility, popstate, and pushState listeners in `page-report-service.ts:257-324` → raw `location.href`/`document.referrer` collected at `:81-96`, `:237-251`, and `:286-301` → `analytics.track()` → common-property merge and `sanitizeObject()` at `posthog-analytics.ts:266-280` → `window.posthog.capture()`.

`bootstrap.tsx:327-339` delays `initWebVitals()` → dynamic Web Vitals callbacks at `web-vitals-service.ts:90-102` → raw, length-only-truncated `document.referrer` at `:31-49` → the same analytics wrapper → PostHog capture.

Reverse:

`window.posthog.capture()` has one project wrapper writer at `posthog-analytics.ts:266-280`; page view/unload/visibility and Web Vitals callers above supply the confirmed URL/referrer fields. `sanitizeObject()` redacts sensitive object keys and a limited class of whole strings, but `page_url`/`referrer` keys are not sensitive keys and a URL containing a query sentinel is not a whole-string bearer or API-key token (`packages/utils/src/security/index.ts:42-75`).

### Crash snapshots and downloadable diagnostics

Forward:

`bootstrap.tsx:50-52` calls `initCrashLogger()` → startup, uncaught/rejection, beforeunload, freeze, long-task, resource, console, and network handlers → `sendSnapshotToSW()` at `crash-logger.ts:543-569` → `swChannelClient.reportCrashSnapshot()` at `sw-channel/client.ts:493-505` → `channel-manager.ts:357-361,501-510` → `saveCrashSnapshot()` → `MemorySnapshotDB/snapshots`, capped at 50 records by `apps/web/src/sw/index.ts:3587-3708` → direct reader at `sw-debug/debug-storage-reader.js:527-565` → memory view/copy/export and combined export at `memory-logs.js:360-410` and `export-modal.js:210-263`.

An initialization/render failure instead reaches `ErrorBoundary.tsx:65-82` or `app.tsx:945-956` → `collectAndDownloadErrorLog()` → raw environment URL, current error/stack/component stack, crash diagnostics, and all unified memory logs are composed at `error-log-exporter.ts:62-90` → `JSON.stringify`/Blob/download at `:34-56`.

Reverse:

The downloaded error JSON has the one application writer above. `getDiagnosticData()` returns the current user-action, console-error, and network-error arrays without a final sanitizer (`crash-logger.ts:1376-1397`). The combined SW debug export copies selected in-memory state and its own raw `location.href` directly to `downloadJson()` (`export-modal.js:239-263`); the crash-only export does the same (`memory-logs.js:401-410`). Existing network URL collection is a positive control: request URLs pass through `sanitizeUrl()` before storage (`crash-logger.ts:1201-1255`), and its query sentinel did not reach the diagnostic sink. Rejected-fetch `Error.message`, console strings/stacks, snapshot top-level URL/error/custom data, and final exports lack the same complete boundary.

### Unified logs

Forward and reverse:

Callers → `UnifiedLogService.log()` → raw `message` and `Error.message/stack`, partial `data` sanitization (`unified-log-service.ts:169-211,683-700`) → per-category memory cache (`:284-312`) and, for configured categories, 500 ms batch → `aitu-unified-logs/logs` IndexedDB (`:319-359`) → query/sync diagnostics or `getMemoryLogs()` → application error-log export.

The partial sanitizer matches `token`, `password`, `secret`, and Gist IDs by key. It does not match `apiKey` or `authorization`, does not inspect arbitrary string values for bearer/query credentials, and does not sanitize the top-level message or Error fields.

### Performance panel

Forward:

`drawnix.tsx:677-701` enables the non-critical feature after five seconds/idle → `DrawnixDeferredFeatures.tsx:206-213` lazy-mounts `PerformancePanel` → `memoryMonitorService.getMemoryStats()` every five seconds (`PerformancePanel.tsx:132-148`) → high-memory/image thresholds decide visibility → icon controls and pointer drag update React state → `savePersistedSettings()` writes `drawnix_performance_panel_settings` localStorage (`:116-130`) → the next refresh initializer reads the record (`:84-104`).

Reverse:

The settings key has one component reader/writer. Pin and pointer-move callers at `:225-261` share the writer. The writer catches rejection, still returns the updated React state, and exposes no outcome. The rendered controls at `:352-452` use visual HoverTips, but the buttons themselves contain only icons and the drag handle is a pointer-event `div`.

## Controlled sentinel results

### Service-to-sink propagation

Command: explicit workspace Node → Drawnix Vitest config → temporary `f27-diagnostics.test.ts`.

- Exit 0; 1/1 file and 3/3 tests passed.
- Page service inputs contained the page-query and referrer sentinels at `analytics.track`.
- Web Vitals input contained the referrer sentinel at `analytics.track`.
- Unified memory logs retained message, `apiKey`, Authorization/Bearer, nested query URL, and `Error.message` sentinels.

Command: explicit workspace Node → Web Vite config/jsdom → temporary `f27-diagnostics.test.ts`.

- Exit 0; 1/1 file and 3/3 tests passed.
- The mocked SW crash sink received top-level URL, custom-data `apiKey`, and uncaught error sentinels.
- Console message/Error and rejected-fetch Error sentinels reached `getDiagnosticData()`.
- The rejected-fetch URL query sentinel did not reach diagnostics, confirming the existing URL sanitizer boundary.
- The captured download Blob contained environment URL, current error, component stack, crash diagnostics, unified-log message, and unified-log `apiKey` sentinels.

### Final PostHog sink

The first page/Web Vitals run stopped at the wrapper input and was not treated as proof of remote capture. A separate test used the real `posthog-analytics.ts` implementation and a synthetic `window.posthog.capture` sink.

- Exit 0; 1/1 file and 2/2 tests passed.
- Page query and referrer token sentinels survived `sanitizeObject()` and reached final PostHog capture.
- Web Vitals referrer token sentinel also reached final PostHog capture.

### Performance-panel DOM and write failure

Command: explicit workspace Node → Drawnix Vitest config/jsdom → temporary component diagnostic.

- Exit 0; 1/1 file and 2/2 tests passed.
- All four rendered icon buttons existed, but none was queryable by its Chinese visible purpose (`新建项目`, `刷新页面`, `常驻`, `关闭`) as an accessible name.
- The drag handle had `tabIndex === -1` and no role.
- With a previously durable `pinned: true` record and forced `Storage.setItem()` `QuotaExceededError`, clicking pin removed the active state in UI while localStorage remained `pinned: true`.
- Import-time ConfigWriter IndexedDB errors and stale Browserslist/source-map warnings appeared on stderr. The assertions did not use those systems; these messages are classified as test-environment/tool noise.

## Confirmed issues

### F27-ANALYTICS-001

- Status: confirmed by final-sink synthetic test.
- User scenario: a user opens Opentu through a URL or referrer that contains a credential-shaped query parameter while analytics is enabled.
- Current behavior: complete page URL and referrer are forwarded, and the generic object sanitizer does not remove query values stored inside those ordinary string fields.
- Expected behavior: page analytics retains route/performance dimensions without sending query values or fragments; referrer is reduced to a non-sensitive origin-level value.
- Impact: initial view, unload, hidden/visible, SPA view, and Web Vitals events. No claim is made that a real credential has been observed in production telemetry.
- Evidence strength: strong deterministic test through final PostHog capture plus static full chain.
- Preferred change: `sanitize-page-analytics-context`; derive query/fragment-free page context before analytics and keep the generic wrapper as defense-in-depth.
- Alternative: call current `sanitizeUrl()` only for known sensitive parameter names. Rejected because page analytics has no demonstrated need for any query/fragment and a name denylist cannot cover unknown one-time codes.
- Verification: permanent final-capture tests for initial/unload/visibility/SPA/Web Vitals, safe route fields, malformed/relative referrers, and no sentinel in payload.
- Rollback: restore prior context builders/tests; no local data migration.

### F27-DIAG-002

- Status: confirmed boundary defect; synthetic arbitrary strings only, not a claim of a real secret leak.
- User scenario: an error occurs, crash state is retained for debug, or the user downloads application/SW diagnostic JSON.
- Current behavior: crash snapshot URL/error/custom data, console strings/stacks, rejected-fetch Error messages, unified log message/Error/partially sanitized data, and final download composition can retain arbitrary values without a common bounded redaction boundary.
- Expected behavior: every diagnostic sink receives a bounded, serializable, privacy-safe projection; the final download boundary re-sanitizes all included current and legacy records.
- Impact: in-memory arrays, localStorage beforeunload backup, SW RPC, `MemorySnapshotDB`, `aitu-unified-logs`, error JSON, SW debug copy/export. Domain-specific provider/task source normalization remains owned by its existing changes.
- Evidence strength: strong deterministic sink tests plus static persistence/export chain. A real credential/provider payload was not inspected.
- Preferred change: `sanitize-diagnostic-capture-and-export`; shared cycle-safe sanitizer, capture-time projections, and mandatory final export defense with forward-only legacy handling.
- Alternative: sanitize only `error-log-exporter.ts`. Rejected because raw snapshots remain in localStorage/SW IndexedDB and are separately visible/copyable/exportable in SW Debug.
- Verification: table tests for key/value/bearer/query/fragment/stack/HTML/control/oversize/cycle cases; SW bridge/storage/export tests; positive safe diagnostics; no source-provider request.
- Rollback: restore previous projections/call sites/tests. No store wipe; historical records omitted by a later ordinary safe overwrite cannot be reconstructed.

### F27-A11Y-003

- Status: confirmed by rendered DOM test.
- User scenario: a keyboard or screen-reader user responds to a high-memory performance panel.
- Current behavior: icon actions have no programmatic names; the move handle is pointer-only and absent from keyboard navigation.
- Expected behavior: localized button names and state, and keyboard-operable bounded panel movement while pointer behavior/visuals remain unchanged.
- Impact: performance panel only; it is delayed/lazy and visible only under its existing conditions or persisted pin state.
- Evidence strength: strong component-level current-source rendering plus static caller chain; no formal browser screenshot is claimed.
- Preferred change: `improve-performance-panel-accessibility`.
- Alternative: rely on HoverTip text. Rejected because the real rendered buttons were not exposed by those names.
- Verification: Chinese/English accessible-name/state tests, Tab/Enter/Space/Arrow movement, pointer parity, viewport clamping, high-memory visibility, focus-visible checks.
- Rollback: remove semantic/keyboard attributes and tests; no data change.

### F27-STORE-004

- Status: confirmed by forced localStorage failure.
- User scenario: the user pins/unpins or moves the performance panel while localStorage is denied/full.
- Current behavior: UI commits the new setting after a caught write failure; refresh reads the previous durable record and restores the old state without prior failure feedback.
- Expected behavior: pin changes do not present a failed write as saved; drag may remain transient during movement but final position commit has a visible, retryable failure outcome and restores the last durable value.
- Impact: one localStorage key and performance-panel UI only; no workspace/settings-manager record.
- Evidence strength: strong deterministic failure injection plus one-reader/one-writer reverse trace.
- Preferred change: `ensure-performance-panel-write-consistency`.
- Alternative: leave optimistic state and show only a warning. Rejected because it still represents a durable preference as saved when refresh will restore another value.
- Verification: success, quota/security failure, pin/unpin, drag-end commit, retry, refresh rehydrate, no feedback flood, existing visibility thresholds.
- Rollback: restore optimistic catch-and-ignore writer/tests; key/schema require no migration.

## Non-findings and unknowns

- No performance optimization is claimed. The F-27 tests measured deterministic behavior, not page latency, render commits, memory savings, or bundle size.
- Existing network URL sanitization worked for the tested credential-shaped query and is a positive control, not a defect.
- No real PostHog event history, SW database, application unified-log database, provider payload, or user diagnostic export was inspected.
- It is unknown whether any production event or persisted historical record contains a real credential. Obtaining that evidence would require access to user/telemetry data and is unnecessary for proving the missing boundary.
- The visual appearance was not changed, so there are no before/after screenshots or visual-improvement claims.
- Formal Playwright screen-reader/responsive/visual checks remain for post-approval implementation.
