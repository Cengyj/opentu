## 1. Evidence and approval

- [x] 1.1 Trace application-menu/hotkey entry, conditional mount, search/predicates, active index, close/dispatch and all target-owner boundaries.
- [x] 1.2 Capture production desktop roles/names/active state/result status, Arrow navigation, Escape BODY focus, whitespace state and screenshots.
- [x] 1.3 Measure 390×844 panel/list/input/row geometry and the project's 44×44 compact convention.
- [x] 1.4 Measure 640×360 panel/body/list/active-row geometry after keyboard wrap and capture the clipped state.
- [x] 1.5 Reproduce connected-opener focus loss in a controlled component and confirm no command-palette reduced-motion rule.
- [x] 1.6 Search formal specs, active changes and permanent tests; record single ownership and target-specific neighboring changes.
- [ ] 1.7 Obtain explicit user approval before modifying runtime code, translations, CSS or permanent tests.

## 2. Semantics and result state

- [ ] 2.1 Add failing tests for localized modal/combobox/listbox/group/option semantics, stable IDs, selected state and active descendant.
- [ ] 2.2 Add the semantic relationships without adding option Tab stops or changing command order/predicates.
- [ ] 2.3 Add concise localized result/no-result status and verify no full-list/query/target-content live announcement.

## 3. Focus and execution handoff

- [ ] 3.1 Add failing menu/hotkey focus tests for initial input, Tab containment, Escape/outside cancel return and stable fallbacks.
- [ ] 3.2 Capture invocation owner before ephemeral menu rows unmount and restore it for cancellation/non-surface execution.
- [ ] 3.3 Distinguish execution close so settings/search/conversion and other focus-owning targets retain final focus after mount.
- [ ] 3.4 Preserve close-before-next-frame dispatch, pointer/keyboard parity and exactly-one target activation.

## 4. Responsive touch and motion

- [ ] 4.1 Add failing 320/375/390/640×360 geometry tests for panel containment, active-row visibility, list scroll and locked body.
- [ ] 4.2 Provide compact/pointer-coarse search and option targets of at least 44×44 CSS px without enlarging glyphs or desktop density.
- [ ] 4.3 Bound panel/list to available dynamic viewport height so keyboard/pointer active options remain fully reachable.
- [ ] 4.4 Add reduced-motion CSS/tests for overlay, panel and option transitions while preserving immediate state feedback.

## 5. Verification and documentation

- [ ] 5.1 Run focused component/registry/a11y/responsive tests and Drawnix typecheck/lint comparison with exact exits/statistics.
- [ ] 5.2 Run the documented entry/focus/state/viewport/locale/theme/motion browser matrix and capture same-state after screenshots/geometry.
- [ ] 5.3 Run full typecheck/test comparison, cycles, production build, size/startup and relevant smoke/feature/visual/responsive suites.
- [ ] 5.4 Update F-31/F-28 evidence, ledger and any user/developer documentation whose shell contract/test location changed.
- [ ] 5.5 Rewalk open, focus, search, active option, execute/cancel, target handoff and return; record rollback and remaining risks.

