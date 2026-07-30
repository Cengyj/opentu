## 1. Evidence and approval

- [x] 1.1 Trace application-menu entry, URL probe, destructive board operation, history, autosave, tab-sync and close-snapshot adjacency.
- [x] 1.2 Reproduce the double-network-rejection and scan-time-index race paths with synthetic component diagnostics; record request/removal/message/identity outcomes without accessing real network or user data.
- [x] 1.3 Search formal specs, active changes and permanent tests; record the new capability owner and non-overlap boundaries.
- [ ] 1.4 Obtain explicit user approval for this change before modifying runtime code, translations or permanent tests.

## 2. Classification and mutation safety

- [ ] 2.1 Add a typed internal valid/invalid/unknown result with aggregate-safe reasons.
- [ ] 2.2 Preserve blob/data/success/opaque compatibility and classify network/policy/temporary failures as unknown.
- [ ] 2.3 Use a bounded fallback for inconclusive HEAD results and delete only terminal-absence outcomes.
- [ ] 2.4 Resolve each element against current board identity/path before deletion so scan-time indices cannot delete a different element.
- [ ] 2.5 Preserve current duplicate-run guard, Plait history/undo, after-change and workspace persistence boundaries.

## 3. Feedback and tests

- [ ] 3.1 Add localized aggregate feedback for confirmed removals, no invalid items, preserved unknown items, and mixed outcomes without exposing URLs.
- [ ] 3.2 Add classifier tests for success, terminal absence, method fallback, opaque, offline/network rejection, abort, authorization/rate-limit/server error and duplicate URLs.
- [ ] 3.3 Add component tests for empty/valid/invalid/unknown/mixed, duplicate activation, late completion/unmount and concurrent board index changes.
- [ ] 3.4 Add board/App adjacency coverage for undo, after-change, autosave and unknown-only no-mutation behavior.

## 4. Verification and documentation

- [ ] 4.1 Run focused unit/integration tests and relevant package typecheck/lint, recording command, exit code and statistics.
- [ ] 4.2 Run the same-state browser matrix for online valid, intercepted terminal absence and offline rejection; capture request sequence, retained/removed counts, feedback, undo, reload recovery and screenshots.
- [ ] 4.3 Run full typecheck/test comparison, cycles, production build, size/startup and relevant smoke/feature/visual/responsive suites without hiding baseline failures.
- [ ] 4.4 Update F-29 ledger/evidence and any user/developer documentation whose cleanup semantics or test location changed.
- [ ] 4.5 Rewalk menu/command entry through classification, mutation, history, persistence and UI feedback; record rollback and remaining risks.
