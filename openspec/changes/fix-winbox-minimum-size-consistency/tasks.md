## 1. Evidence And Approval

- [x] 1.1 Reproduce cold-first, cached-reopen, maximize, and restore rectangles for Settings at one controlled viewport.
- [x] 1.2 Reproduce the same shared boundary on current image and video generation callers without submitting a task or reading credentials.
- [x] 1.3 Trace wrapper lazy loading, creation, constraint effects, stored normal rectangle, maximize/restore, caller props, and third-party read-only behavior.
- [x] 1.4 Inventory all current `WinBoxWindow` callers and separate measured percentage-below-minimum callers from numeric/above-minimum negative controls.
- [x] 1.5 Separate current-viewport min/restore consistency from generation orientation, tool/media viewport transitions, Settings/tool accessibility, z-index, and responsive redesign.
- [x] 1.6 Record exact raw rectangles, viewport, source lines, no-request boundary, and cleanup requirements in the feature evidence/ledger.
- [ ] 1.7 Obtain user approval for shared cold/warm normalization, effective centered placement, and maximize/restore consistency.

## 2. Failing Tests And Shared Fix (Approval Required)

- [ ] 2.1 Add a deterministic fake-WinBox harness for stored versus rendered geometry, lazy first load, cached remount, and callback observation.
- [ ] 2.2 Add failing tests for percentage dimensions below a parsed minimum on cold and warm creation.
- [ ] 2.3 Add failing tests for maximize/restore returning to the effective normalized rectangle and center placement using final dimensions.
- [ ] 2.4 Add negative controls for already-valid percentage/numeric dimensions and an impossible raw minimum constrained by the current viewport.
- [ ] 2.5 Implement one wrapper-level normalization step before saving normal position, without patching third-party code.
- [ ] 2.6 Make the existing dimension/minimum update effect store and render the same effective numeric values while skipping split mode.
- [ ] 2.7 Preserve exactly-once resize/move/maximize/restore callbacks and avoid content remount or unrelated geometry writes.

## 3. Caller Preservation (Approval Required)

- [ ] 3.1 Add focused Settings tests for first open, reopen, maximize/restore, close/reopen, and unchanged drafts/views/save guards.
- [ ] 3.2 Add focused image/video dialog tests for declared minimums, center placement, maximize/restore, modes, parameters, and task non-submission.
- [ ] 3.3 Test split cycle/restore, manual resize, keepAlive minimize/hide/show/restore, and autoMaximize with current callbacks and state.
- [ ] 3.4 Verify Media Library, Prompt Optimize, and numeric toolbox windows retain already-valid geometry at the measured viewport.
- [ ] 3.5 Rebase against active viewport-transition changes without absorbing orientation, compact, saved-size, or accessibility semantics.

## 4. Verification

- [ ] 4.1 Run focused WinBox/Settings/TTD/media/tool tests with exact file/test counts, exits, and no external provider/task request.
- [ ] 4.2 Capture matched 1280×720 Settings/image/video before/after rectangles and screenshots across cold/warm/maximize/restore cycles.
- [ ] 4.3 Run focused lint and Drawnix typecheck, then full typecheck/tests/cycles/build/size/startup against the recorded baseline.
- [ ] 4.4 Run available generation, settings, media, toolbox, smoke, feature, visual, and responsive E2E; classify missing browser tooling separately.
- [ ] 4.5 Verify desktop/tablet/mobile, orientation, zoom/high-DPI, light/dark, reduced motion, and long-content states only where supported; make no unmeasured performance claim.
- [x] 4.6 Attempt strict OpenSpec validation; the CLI is unavailable (exit 127), so complete manual file, scenario, unique-requirement, and active-owner checks without claiming strict validation.
