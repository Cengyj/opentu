## 1. Evidence and approval

- [x] 1.1 Trace application-menu, hotkey and command-palette writers through the always-mounted confirmation, explicit delete, history and autosave adjacency.
- [x] 1.2 Reproduce named dialog/initial Cancel plus BODY focus after desktop Escape and real compact pointer Cancel without confirming deletion.
- [x] 1.3 Measure 320×568, 390×844 and 640×360 dialog/action/body geometry and capture compact before screenshots.
- [x] 1.4 Search formal specs, active changes, focused tests and shared ConfirmDialog consumers; separate F-29 caller behavior from shared menu/palette/dialog owners.
- [ ] 1.5 Obtain explicit user approval before modifying runtime code, CSS or permanent tests.

## 2. Invocation and focus

- [ ] 2.1 Add failing tests for menu/hotkey/palette invocation, initial Cancel, Escape/pointer cancellation, completed confirmation and disconnected-owner fallback.
- [ ] 2.2 Capture a same-root, non-persisted invocation owner/fallback at every existing clear-board entry.
- [ ] 2.3 Return focus after cancellation or completion without reopening an ephemeral menu/palette or leaving BODY when a stable owner exists.
- [ ] 2.4 Coordinate command-palette handoff so the target owns open focus and the original workflow owns final return.
- [ ] 2.5 Preserve focus containment, visible focus, exact-one close and exact-one target/delete activation.

## 3. Compact actions

- [ ] 3.1 Add failing geometry tests for 320/375/390/640×360 and desktop containment, scroll lock and action hit boxes.
- [ ] 3.2 Add F-29-scoped compact/pointer-coarse action boxes of at least 44×44 CSS px without changing glyph/text size or desktop density.
- [ ] 3.3 Preserve current dialog width/wrapping/theme, localized copy, background lock and full viewport containment.

## 4. Verification and documentation

- [ ] 4.1 Run focused CleanConfirm/entry tests and Drawnix typecheck/lint comparison with exact exits/statistics.
- [ ] 4.2 Run the documented entry/focus/viewport/locale/theme/zoom/touch browser matrix and capture matched after screenshots/geometry.
- [ ] 4.3 Run full typecheck/test comparison, cycles, production build, size/startup and relevant smoke/feature/visual/responsive suites.
- [ ] 4.4 Update F-29/F-28 evidence, ledger and any interface documentation whose focus contract/test location changed.
- [ ] 4.5 Rewalk open, cancel, Escape, confirm, deletion, history, autosave and return; record rollback and remaining risks.

