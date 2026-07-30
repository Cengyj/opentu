## 1. Evidence and Approval

- [x] 1.1 Reproduce the media-library window at `390×844` and retain raw window/action geometry and a screenshot.
- [x] 1.2 Trace the 768 px layout state, WinBox minima, resize/reposition behavior, and mobile inspector visible-state writers.
- [x] 1.3 Verify desktop details exist and a selected mobile fixture has no reachable detail drawer/action.
- [x] 1.4 Check the toolbox viewport and full-screen media preview/editor changes and record their boundaries.
- [ ] 1.5 Obtain user approval for compact fitting and the explicit mobile details action.

## 2. Implementation (Approval Required)

- [ ] 2.1 Add failing wrapper/modal tests for compact window bounds, live viewport transitions, mounted-state preservation, and unrelated WinBox callers.
- [ ] 2.2 Opt the media-library WinBox into compact fitting without changing desktop geometry or persisting automatic layout.
- [ ] 2.3 Add a selected-asset mobile details action that opens the existing drawer and has localized name/focus behavior.
- [ ] 2.4 Keep browse/select/batch modes, upload, filter, preview, inspector actions, asset/cache stores, and board data unchanged.

## 3. Verification

- [ ] 3.1 Run focused WinBox/modal/grid/inspector tests with exact file/case counts and exit codes.
- [ ] 3.2 Verify desktop/tablet/mobile/orientation states, no asset/one asset/many assets, selection and batch-selection, drawer close, and virtualized-card focus fallback.
- [ ] 3.3 Capture before/after geometry, screenshots, and accessibility snapshots at identical themes/viewports/data.
- [ ] 3.4 Measure at least five viewport transitions before/after and report event-to-stable-geometry median/range.
- [ ] 3.5 Run Drawnix lint/typecheck and full typecheck/test/cycles/build/size/startup; compare failures with baseline.
- [ ] 3.6 Run available media-library smoke/feature/visual/responsive Playwright flows and classify the missing configured browser separately.
- [ ] 3.7 Run OpenSpec strict validation; while the CLI is unavailable, record the blocker and complete a manual operation/name/conflict audit.
