## 1. Evidence and Approval

- [x] 1.1 Trace every custom-tool mutation and all UI/sync result consumers.
- [x] 1.2 Reproduce a rejected write with an in-memory catalog change.
- [x] 1.3 Confirm the storage key/version/schema and public result shapes can remain unchanged.
- [ ] 1.4 Obtain user approval for durable-before-visible and serialized mutation ordering.

## 2. Implementation (approval required)

- [ ] 2.1 Add failing tests for success/failure of add, update, remove, clear, and import.
- [ ] 2.2 Add failing tests for overlapping mutations, duplicate/count validation, and queue recovery after rejection.
- [ ] 2.3 Implement an immutable, ordered persist-then-commit mutation boundary.
- [ ] 2.4 Preserve existing validation, keys/schema, return values, caller feedback, and privacy fields.
- [ ] 2.5 Add CustomToolDialog and GitHub sync result regressions.

## 3. Verification

- [ ] 3.1 Run focused toolbox/custom-dialog/sync tests, ESLint, and Drawnix typecheck.
- [ ] 3.2 Measure 1/10/50-entry mutation samples before/after under the same localForage test environment.
- [ ] 3.3 Verify write-failure feedback and reload consistency in the application browser.
- [ ] 3.4 Compare full typecheck, unit tests, cycles, build, size, startup, and lint with baseline.
- [ ] 3.5 Run available toolbox smoke/feature/visual/responsive flows and classify browser blockers.
- [ ] 3.6 Run OpenSpec strict validation; while unavailable, record the blocker and perform manual format/conflict review.

