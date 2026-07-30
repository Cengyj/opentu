## 1. Evidence and approval

- [x] 1.1 Repair the responsive test's stale primary-input locator without changing product behavior or thresholds.
- [x] 1.2 Re-run the focused suite and isolate the remaining toolbar/input geometry failure.
- [x] 1.3 Capture cross-viewport rectangles, stacking, screenshot, source writers, negative controls, and complete forward/reverse chain.
- [x] 1.4 Confirm AI submission, toolbar actions, global z-index, storage, desktop/tablet layout, and other accessibility changes are outside this change.
- [ ] 1.5 Obtain user approval for the scoped mobile visual-layout contract.

## 2. Failing tests and implementation (approval required)

- [ ] 2.1 Add focused failing geometry and topmost-hit-target tests for 640×360, 375×667, and 360×640.
- [ ] 2.2 Add state coverage for collapsed/expanded toolbar and compact/focused/expanded/attachment/long-text AI input.
- [ ] 2.3 Implement one safe-area-aware mobile clearance contract without changing desktop/tablet/input behavior or z-index.
- [ ] 2.4 Preserve toolbar internal scrolling and action reachability on short landscapes.
- [ ] 2.5 Add non-zero safe-area and orientation-transition coverage.
- [ ] 2.6 Capture and review same-state mobile before/after screenshots without relaxing the overlap assertion.

## 3. Verification

- [ ] 3.1 Run focused responsive TypeScript, lint, and Playwright tests with exact commands, exits, counts, and geometry.
- [ ] 3.2 Browser-check pointer/touch hit testing, Chinese/English, light/dark, 100% zoom/high-DPI, and available physical mobile safe-area behavior.
- [ ] 3.3 Re-run all seven existing responsive viewports and compare desktop/tablet negative controls.
- [ ] 3.4 Run full typecheck/tests/cycles/build/size/startup and available smoke/feature/visual/responsive E2E against baseline.
- [ ] 3.5 Update F-28 evidence, feature ledger, specs, screenshots, residual risks, and independent rollback instructions.
- [x] 3.6 Record OpenSpec CLI absence; manually check structure, scenario format, unique requirement name, and active-change ownership without claiming strict validation passed.
