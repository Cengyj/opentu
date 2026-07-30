## Context

Diagnostic producers currently serialize data for four different sinks: short-lived in-memory arrays, localStorage/SW crash persistence, unified-log IndexedDB, and user-initiated JSON/copy output. Source-specific error normalizers cannot protect every sink, while final-export-only filtering leaves raw values at rest and visible in SW Debug.

## Goals / Non-Goals

- Goals: one explicit privacy boundary, bounded useful diagnostics, safe current and legacy export/display, and compatible storage/transport shapes.
- Non-Goals: claim a real secret leak, erase all historical stores, disable crash recovery, remove useful metric/status/category data, redesign SW RPC, or replace provider-domain normalization changes.

## Decisions

- Add a dedicated diagnostic sanitizer to `@aitu/utils`; do not broaden `sanitizeObject()` semantics for all callers.
- The sanitizer is cycle-safe and deterministic, with explicit maximum depth, items, keys, and string length. Unsupported values become stable type summaries rather than throwing.
- Sensitive-key matching covers current security keywords including `apiKey`, authorization, bearer, credential, password, secret, token, and key-shaped names. String redaction applies bearer/authorization/credential assignments anywhere, not only at string start.
- URL-valued fields retain at most origin/path; query and fragment are removed. Malformed URL-like values are bounded and credential-pattern-redacted.
- Crash snapshots are projected immediately before the shared `sendSnapshotToSW`/localStorage boundary so every producer inherits the rule. SW validates/projects again before persistence/broadcast as defense-in-depth.
- Unified logs normalize top-level message and Error fields as well as structured data before either memory or buffer insertion.
- Application and SW-debug export/copy paths always sanitize a fresh projection. This protects legacy raw records without destructive enumeration or schema migration.
- Retain stable error name/type/category, bounded safe message summary when it passes redaction, bounded stack locations with URL query/fragment removed, timestamps, durations, status, memory/page counts, FPS, and safe route path.

## Alternatives considered

- Final-export-only sanitization: rejected because raw values remain in localStorage/IndexedDB and SW Debug display/copy.
- Capture-only sanitization: rejected because legacy records and future missed producers could bypass it.
- Remove all messages/stacks: strongest privacy but disproportionately reduces diagnostic recovery; bounded allowlisted/redacted summaries retain safer value.
- Background rewrite/delete: rejected because it is destructive, needs migration/recovery semantics, and is unnecessary when read/export boundaries and existing eviction/clear controls suffice.

## Invariants

- Snapshot/log IDs, timestamps, types/categories/levels, store names/versions/keys, caps/retention, RPC method, memory thresholds, recovery state machine, and user clear controls remain unchanged.
- Sanitization never turns a failure into success, hides the existence/category of a failure, throws into application flow, or initiates network/storage work.
- Provider/task-specific changes still normalize their own raw bodies before generic diagnostics.

## Risks / Trade-offs

- Redaction and bounds reduce ad-hoc debugging detail; stable category/status/count/location summaries remain.
- Legacy raw data remains physically at rest until normal eviction/clear; UI/copy/export must filter it immediately.
- Over-broad `key` matching can hide harmless fields; tests must distinguish exact/key-shaped sensitive names from ordinary words such as `keyboard`.
- Recursive input can be large or cyclic; deterministic limits and no-throw tests are mandatory.

## Verification and rollback

- Table tests cover nested/array/cycle/oversize data, exact and embedded bearer/auth/key patterns, URL query/fragment, malformed URLs, stack strings, safe ordinary fields, and no mutation of input.
- Integration tests cover every crash producer through SW save/broadcast, unified memory/IDB, current and legacy application/SW-debug export/copy, and existing network URL positive control.
- Use synthetic values only; assert no sentinel reaches any protected sink and safe diagnostic fields remain.
- Run focused tests, package/full typecheck/lint, then full tests/cycles/build/size/startup and available E2E against baseline.
- Rollback sanitizer/call sites/tests; do not clear stores.
