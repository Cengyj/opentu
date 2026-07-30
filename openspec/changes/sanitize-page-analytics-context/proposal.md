# Change: Sanitize page analytics context

## Why

Page-view, unload, visibility, and Web Vitals reporting currently place full `window.location.href` or `document.referrer` values in ordinary string fields. The generic analytics sanitizer redacts sensitive object keys but does not parse URLs stored under `page_url` or `referrer`. Controlled final-sink tests proved credential-shaped query sentinels reach `window.posthog.capture` unchanged.

No real telemetry, credential, or external request was inspected. Changing remotely reported URL/referrer semantics is a privacy and observability policy change and requires approval.

## What Changes

- Build page analytics context from origin/path only; never report page query strings or fragments.
- Reduce referrer context to an origin-only value when parseable; omit malformed, opaque, or unavailable referrers.
- Apply the same context builder to initial/SPA views, unload, hidden/visible, page performance, and Web Vitals.
- Keep the generic analytics sanitizer as defense-in-depth and add final PostHog capture tests.
- Preserve event names, metric values/ratings, route path, timing/resource counts, release context, PostHog initialization timing, and analytics-disabled behavior.

## Impact

- Affected specs: `analytics-privacy` (new delta)
- Affected code: page report, Web Vitals reporting, analytics URL-context helper/tests
- Related changes: `refactor-startup-shell-loading` owns initialization/import timing, not event payload privacy; provider/model changes own their domain event fields
- Data/API impact: no local schema or migration; future remote payloads intentionally lose query/fragment and referrer path/query detail
- Rollback: restore the previous URL/referrer builders and tests; already omitted remote fields cannot be reconstructed

## Evidence

- `page-report-service.ts:81-96` collects raw `location.href` and `document.referrer`; unload and visibility repeat raw href at `:237-251,286-301`.
- `web-vitals-service.ts:31-49` only truncates referrer length.
- `posthog-analytics.ts:266-280` passes merged data through `sanitizeObject()` before final capture.
- `security/index.ts:42-75` does not parse ordinary URL-valued strings.
- Synthetic final-capture diagnostics: 1 file/2 tests passed, exit 0; page-query/referrer-token and Web-Vitals-referrer sentinels reached `window.posthog.capture`.
- Full evidence: `docs/evidence/f27-diagnostics-observability/diagnostics.md`.

## Approval

Implementation is blocked until the user approves query/fragment-free page context and origin-only referrer reporting.
