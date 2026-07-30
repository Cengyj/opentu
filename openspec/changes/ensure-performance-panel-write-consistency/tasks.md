## 1. Evidence and approval

- [x] 1.1 Trace the only localStorage reader/writer and all pin/position callers through refresh rehydration.
- [x] 1.2 Force a synchronous quota rejection and prove UI/durable pin divergence.
- [x] 1.3 Separate panel-local settings from shared settings/toolbar stores, accessibility, and unmeasured performance claims.
- [ ] 1.4 Obtain user approval for commit-before-publish pin behavior and drag-end commit/rollback feedback.

## 2. Failing tests and implementation (approval required)

- [ ] 2.1 Add success/quota/security/read-malformed/pin/drag/cancel/retry/refresh tests.
- [ ] 2.2 Split transient and last-durable settings state without changing the stored schema.
- [ ] 2.3 Commit pin before publishing; preserve prior durable state on rejection.
- [ ] 2.4 Persist one final drag position on release/cancel and restore the durable position on rejection.
- [ ] 2.5 Add localized, deduplicated, privacy-safe retry guidance and preserve existing actions/thresholds/layout.

## 3. Verification

- [ ] 3.1 Run focused component/storage/typecheck/lint tests with exact counts and exits.
- [ ] 3.2 Verify normal refresh persistence, storage-denied rollback, retry, drag bounds, no feedback flood, and no sensitive feedback/log/analytics.
- [ ] 3.3 Run full typecheck/tests/cycles/build/size/startup and available E2E against baseline.
- [x] 3.4 Record OpenSpec CLI absence; complete manual format, requirement-name, and active-change conflict checks without claiming strict validation passed.
