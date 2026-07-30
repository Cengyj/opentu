## 1. Evidence And Approval

- [x] 1.1 Trace start, worker queue, entry updates, deletion, persistence, refresh, UI, analytics, and provider calls in both directions.
- [x] 1.2 Reproduce duplicate provider calls from concurrent starts with a deferred mock.
- [x] 1.3 Prove running-session deletion does not cancel the deferred call and removes local tracking.
- [x] 1.4 Prove persisted running session/entry states load unchanged without resume or interruption normalization.
- [ ] 1.5 Obtain user approval for singleflight, truthful stop, deletion guard, and additive interrupted/cancelled recovery states.

## 2. Failing Tests And Implementation (Approval Required)

- [ ] 2.1 Add same-session/different-session singleflight and rerun-after-settlement red tests.
- [ ] 2.2 Add pending/in-flight abortable/non-abortable stop tests for four modalities.
- [ ] 2.3 Add active deletion guard, late settlement, partial result, and analytics privacy tests.
- [ ] 2.4 Add persisted running/stopping load normalization and tolerant historical-status tests.
- [ ] 2.5 Implement one run owner/token per session and truthful status transitions.
- [ ] 2.6 Add workbench stop controls, live status, deletion gating, and keyboard/focus semantics.
- [ ] 2.7 Preserve routing, concurrency, completed results, manual feedback, key, and no-auto-resume behavior.

## 3. Verification

- [ ] 3.1 Run focused lifecycle/service/workbench tests with exact counts and exit codes.
- [ ] 3.2 Browser-check synthetic start/monitor/stop/delete/refresh/rerun in normal, failure, offline, and slow states.
- [ ] 3.3 Measure five runs of stop-to-no-new-invocation and singleflight request counts; report median/range and functional trade-offs.
- [ ] 3.4 Run Drawnix/full typecheck and lint, full tests/cycles/build/size/startup, and available E2E against baseline.
- [x] 3.5 Run OpenSpec strict validation; while the CLI is unavailable, record exit 127 and complete manual format/name/conflict validation.
