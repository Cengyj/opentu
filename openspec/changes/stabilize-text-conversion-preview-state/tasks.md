## 1. Evidence and approval

- [x] 1.1 Trace all three entry families through dialog state, lazy converter, preview, insertion, Plait history and workspace persistence adjacency.
- [x] 1.2 Reproduce out-of-order Mermaid completion and stale insertion while current input is pending with controlled component diagnostics.
- [x] 1.3 Confirm the invalid-input retained-preview/enabled-button state in the current production build without inserting content.
- [x] 1.4 Search formal specs, active changes and permanent tests; record the new capability owner and F-05/F-28/F-31 boundaries.
- [ ] 1.5 Obtain explicit user approval for this change before modifying runtime code, translations, CSS or permanent tests.

## 2. Current-input ownership

- [ ] 2.1 Add failing tests for obsolete success/failure completion, current pending/failure after prior success, fallback attempts and unmount.
- [ ] 2.2 Add explicit converter loading/parsing/success/failure state keyed to the current normalized input and converter generation.
- [ ] 2.3 Ignore obsolete or post-unmount completions without adding parser calls, retries, caches or persisted state.
- [ ] 2.4 Do not invoke placeholder stub parsers before the real converter module is ready.

## 3. Insertion safety

- [ ] 3.1 Add one current-result eligibility predicate shared by panel button, keyboard shortcut and mutation recheck.
- [ ] 3.2 Keep loading, pending, error, stale and empty states non-inserting and non-closing.
- [ ] 3.3 Preserve successful smart/default placement, deep clone, Plait paste/history, viewport reveal and close behavior.
- [ ] 3.4 Add board/App adjacency tests proving blocked attempts do not mutate/save and successful attempts insert the exact current result once.

## 4. Verification and documentation

- [ ] 4.1 Run focused component/integration tests and Drawnix typecheck/lint comparison with exact exits/statistics.
- [ ] 4.2 Run same-state browser checks for initial, pending, success, failure, recovery, button and shortcut states at desktop and compact widths.
- [ ] 4.3 Run full typecheck/test comparison, cycles, production build, size/startup and relevant smoke/feature/visual/responsive suites.
- [ ] 4.4 Update F-30 evidence, ledger and any developer documentation whose conversion-state contract/test location changed.
- [ ] 4.5 Rewalk entry, current-input ownership, parser settlement, insertion, history, persistence and UI recovery; record rollback and remaining risks.

