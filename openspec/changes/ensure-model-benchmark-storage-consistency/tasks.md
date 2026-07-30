## 1. Evidence And Approval

- [x] 1.1 Trace benchmark hydration, every state mutation, KV write, RxJS projection, history UI, and export consumer in both directions.
- [x] 1.2 Reproduce delayed-load overwrite and reverse-completion durable regression with controlled deferred KV mocks.
- [x] 1.3 Confirm key, state shapes, 12-session retention, task-store separation, and provider invocation do not need to change.
- [ ] 1.4 Obtain user approval for readiness, ordered write, and safe persistence feedback semantics.

## 2. Failing Tests And Implementation (Approval Required)

- [ ] 2.1 Add service red tests for delayed load success/failure and every reachable mutation before readiness.
- [ ] 2.2 Add reverse-completion, rejection-recovery, retention, and active-session red tests.
- [ ] 2.3 Implement one initialization result and prevent provisional writes after read failure.
- [ ] 2.4 Serialize accepted whole-state writes without poisoning later writes after rejection.
- [ ] 2.5 Add sequence-safe, privacy-safe persistence feedback while retaining current in-memory edits.
- [ ] 2.6 Preserve key/schema/retention/IDs/task-store separation and provider routing.

## 3. Verification

- [ ] 3.1 Run focused service/workbench storage tests with exact counts and exit codes.
- [ ] 3.2 Measure 1/10/50 accepted mutations over five runs and report latency median/range, queue depth, and zero lost state.
- [ ] 3.3 Browser-check slow/read-failure/write-failure/retry and refresh history using mock storage.
- [ ] 3.4 Run Drawnix/full typecheck and lint, full tests/cycles/build/size/startup, and available E2E against baseline.
- [x] 3.5 Run OpenSpec strict validation; while the CLI is unavailable, record exit 127 and complete manual format/name/conflict validation.
