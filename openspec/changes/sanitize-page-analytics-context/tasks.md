## 1. Evidence and approval

- [x] 1.1 Trace page lifecycle and Web Vitals fields through the real analytics sanitizer to final PostHog capture.
- [x] 1.2 Prove page-query/referrer propagation with credential-shaped sentinels and no real telemetry or credential.
- [x] 1.3 Confirm startup timing, event names, metric values, and unrelated analytics remain outside this change.
- [ ] 1.4 Obtain user approval for query/fragment-free page context and origin-only referrer semantics.

## 2. Failing tests and implementation (approval required)

- [ ] 2.1 Add final-capture tests for every page lifecycle writer and Web Vitals.
- [ ] 2.2 Add the non-throwing page/referrer context helper with HTTP(S), malformed, empty, and opaque cases.
- [ ] 2.3 Route page view/performance/unload/visibility/SPA and Web Vitals through the helper.
- [ ] 2.4 Preserve analytics-disabled behavior, release fields, scheduling, event names, and metric/timing values.

## 3. Verification

- [ ] 3.1 Run focused service/helper/final-capture tests with exact counts and exit codes.
- [ ] 3.2 Assert query/fragment/referrer sentinels are absent while safe origin/path and metrics remain.
- [ ] 3.3 Run package/full typecheck and lint, full tests/cycles/build/size/startup, and available E2E against baseline.
- [x] 3.4 Record OpenSpec CLI absence; complete manual format, requirement-name, and active-change conflict checks without claiming strict validation passed.
