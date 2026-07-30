## 1. Evidence and Approval

- [x] 1.1 Reproduce constrained AI image picker → unconstrained canvas library and retain pressed-state values and screenshot.
- [x] 1.2 Trace constraint props, shared filter owner, grid filter predicate, close path, and all writers/readers.
- [x] 1.3 Trace single/batch label props from current callers to the inspector output.
- [x] 1.4 Trace modal callback fulfillment/rejection through creation and quick-creation toolbar insertion/error paths and compare the insertion lesson.
- [x] 1.5 Check active AI input, subject reuse, batch layout, responsive library, and media editor changes for requirement conflicts.
- [ ] 1.6 Obtain user approval for invocation-local constraints, distinct batch labels, and failure-retains-selection semantics.

## 2. Implementation (Approval Required)

- [ ] 2.1 Add failing grid/modal tests for constraint enforcement, prior browse-filter preservation, and selection cleanup on constraint change.
- [ ] 2.2 Remove picker-to-global filter mutation and derive effective grid/selection filters from immutable constraints plus user filters.
- [ ] 2.3 Carry the batch label through modal/inspector and preserve the current default.
- [ ] 2.4 Add failing deferred tests for single/double/batch success, rejection, duplicate activation, retry, and unmount.
- [ ] 2.5 Catch selection rejection inside the modal, retain retry state, and reset pending state without duplicate user messages.
- [ ] 2.6 Make creation/quick toolbar insertion failures reject after their existing messages; audit every other direct modal caller for truthful completion.
- [ ] 2.7 Keep asset/task/cache/board formats, canvas layout, preview, deletion, and upload behavior unchanged.

## 3. Verification

- [ ] 3.1 Run focused modal/grid/inspector and caller tests with exact file/case counts and exit codes.
- [ ] 3.2 Verify browse/select/batch modes, type/category/source/search/playlist filters, success/failure/retry, rapid activation, close, and reopen.
- [ ] 3.3 Capture before/after screenshots at 1280/768/390/320 px, Chinese/English, light/dark, with identical assets and filter state.
- [ ] 3.4 Measure at least five selection success/failure cycles and report callback-to-close/retry-ready latency median/range without claiming an unmeasured performance gain.
- [ ] 3.5 Run Drawnix lint/typecheck and full typecheck/test/cycles/build/size/startup; compare failures with baseline.
- [ ] 3.6 Run available media-library, AI input, Chat, toolbar, Frame, fill, and knowledge picker Playwright flows; classify the missing configured browser separately.
- [ ] 3.7 Run OpenSpec strict validation; while the CLI is unavailable, record the blocker and complete a manual operation/name/conflict audit.
