## 1. Evidence and approval

- [x] 1.1 Trace menu/hotkey open, raw query scoring, predicate filtering, active index, keyboard close/dispatch and target ownership.
- [x] 1.2 Reproduce boundary-whitespace false empty in the current production build without executing a command.
- [x] 1.3 Reproduce Chinese IME composition Enter closing/scheduling the active command with a controlled mounted-component diagnostic.
- [x] 1.4 Search formal specs, active changes and permanent tests; record the new capability owner and command-target boundaries.
- [ ] 1.5 Obtain explicit user approval before modifying runtime code or permanent tests.

## 2. Query consistency

- [ ] 2.1 Add failing tests for leading/trailing ASCII/Unicode whitespace, whitespace-only, internal spaces and zh/en label/keyword/shortcut matching.
- [ ] 2.2 Normalize boundary whitespace for matching only while preserving raw input/caret state.
- [ ] 2.3 Preserve current scores, category ordering, predicate filtering and registry IDs for normalized-equivalent queries.

## 3. Composition-safe keyboard behavior

- [ ] 3.1 Add failing tests for composing Enter/Escape/ArrowUp/ArrowDown, keyCode 229 and post-composition behavior.
- [ ] 3.2 Delegate palette keys to the browser/IME while composition is active without changing active index, closing or scheduling a command.
- [ ] 3.3 Preserve ordinary post-composition navigation, close-before-dispatch timing and exactly-one target activation.

## 4. Verification and documentation

- [ ] 4.1 Run focused component/registry tests and Drawnix typecheck/lint comparison with exact exits/statistics.
- [ ] 4.2 Run safe browser checks for whitespace/paste/composition at desktop and compact sizes without destructive/provider/file actions.
- [ ] 4.3 Run full typecheck/test comparison, cycles, production build, size/startup and relevant smoke/feature/visual/responsive suites.
- [ ] 4.4 Update F-31 evidence/ledger and any user/developer documentation whose input contract/test location changed.
- [ ] 4.5 Rewalk open, query, composition, active selection, dispatch, target handoff and close; record rollback and remaining risks.

