## Context

The page-report services know which fields are URLs, while the generic analytics wrapper sees only arbitrary event objects. A generic key/string sanitizer cannot safely infer whether every string is a URL or which URL parts are needed for product analytics.

## Goals / Non-Goals

- Goals: prevent page query/fragment and referrer details from reaching PostHog while retaining route/performance analysis.
- Non-Goals: disable analytics, change consent/initialization, rename events, change Web Vitals thresholds, rewrite provider/task analytics, inspect historical PostHog data, or claim a real credential leak.

## Decisions

- Add a small non-throwing analytics context helper that returns page origin/path and referrer origin only.
- Page URL fields use `origin + pathname` when an absolute value is needed; `page_path` remains pathname only. Query and fragment are never copied.
- Referrer uses `new URL(referrer).origin` only for HTTP(S); empty, malformed, opaque (`null` origin), and unsupported schemes produce an empty/omitted value.
- Every page lifecycle producer and Web Vitals calls the same helper before `analytics.track()`.
- Final-capture tests use synthetic values and the real analytics wrapper so a test cannot stop at the pre-sanitizer boundary.

## Alternatives considered

- Apply current `sanitizeUrl()` only: this removes known sensitive query keys but preserves all other query/fragment data. No demonstrated F-27 metric needs them, and denylisting names cannot cover one-time codes with unknown keys.
- Fix only page view: rejected because unload, visibility, SPA, and Web Vitals are separate writers.
- Change `sanitizeObject()` to parse every string as URL: rejected because it would change unrelated analytics and diagnostic strings without field context.

## Invariants

- Event names, metric/timing values, rating logic, device dimensions, language, release context, scheduling, and analytics-disabled no-op behavior remain unchanged.
- Context building never throws or blocks the page lifecycle callback.
- No prompt, provider URL, credential, board data, or user content is added to analytics.

## Risks / Trade-offs

- Referrer path/query attribution becomes less granular; origin-level attribution remains.
- Route queries used as product state can no longer be distinguished remotely; no current F-27 requirement establishes such use.
- URL parsing failure may omit context; metric/event delivery continues.

## Verification and rollback

- Unit/final-sink tests cover initial view, unload, hidden/visible, pushState/popstate, page performance, Web Vitals, malformed/relative/opaque referrers, analytics disabled, and safe route retention.
- Assert credential-shaped query/fragment sentinels never reach final `posthog.capture`.
- Run Drawnix/app typecheck, focused lint/tests, then repository gates against baseline.
- Rollback helper/call sites/tests only; no storage operation is required.
