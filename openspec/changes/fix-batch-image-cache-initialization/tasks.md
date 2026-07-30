## 1. Evidence and Approval

- [x] 1.1 Trace the toolbox entry, component initialization, row mutation paths, kvStorage read/write, migration/backup registration, and refresh recovery.
- [x] 1.2 Prove the ordering defect with the current state transitions and retain the browser/DOM evidence.
- [x] 1.3 Check formal specs and active changes; confirm no current batch-image capability defines initial draft hydration.
- [ ] 1.4 Obtain user approval for the loading and draft-recovery semantics.

## 2. Implementation (Approval Required)

- [ ] 2.1 Add deferred-resolve, empty, malformed, reject, and unmount component tests for initial hydration.
- [ ] 2.2 Gate batch row mutations/imports/submission behind one accessible initial loading boundary.
- [ ] 2.3 Choose the cached draft or existing defaults once, then retain the current post-hydration save behavior.
- [ ] 2.4 Preserve the cache key/shape, task IDs, row IDs/counter, image references, backup/migration inclusion, and model/provider/task contracts.

## 3. Verification

- [ ] 3.1 Run focused batch-image and storage tests with exact file/case counts and exit codes.
- [ ] 3.2 Verify cached/empty/rejected reads, edit/import/delete, close/reopen, refresh, and no unhandled rejection.
- [ ] 3.3 Capture same-state before/after loading and hydrated screenshots at desktop/tablet/mobile and in Chinese/English.
- [ ] 3.4 Measure at least five cold and five warm mount-to-editable samples before/after and report median/min/max without unsupported claims.
- [ ] 3.5 Run Drawnix typecheck/lint and full typecheck/test/cycles/build/size/startup against the recorded baseline.
- [ ] 3.6 Run available smoke/feature/visual/responsive Playwright flows and classify the configured-browser blocker separately.
- [ ] 3.7 Run OpenSpec strict validation; while the CLI is unavailable, record exit 127 and complete a manual format/name/conflict audit.
