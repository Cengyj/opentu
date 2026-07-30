## 1. Evidence And Approval

- [x] 1.1 Trace the live toolbar entry through drawer/list/item state and prove the legacy task button/summary are unreachable.
- [x] 1.2 Inspect the current 1280×720 drawer accessibility tree, names, roles, selected state, focus order, and current Escape owner.
- [x] 1.3 Run a temporary real-component diagnostic for task actions, selection, preview, error details, progress, and live regions; record results and remove the diagnostic.
- [x] 1.4 Measure and capture the 390×844 and 320×568 compact layouts, including overflow and control rectangles.
- [x] 1.5 Separate concurrency/cancellation/persistence/lyrics/error-content/mobile-shell owners and document active-change conflicts.
- [x] 1.6 Record OpenSpec CLI absence and complete manual structure/scenario/requirement/owner checks.
- [ ] 1.7 Obtain user approval for focus/Escape, semantics/announcements, localization, compact wrapping, and 44×44 touch targets.

## 2. Failing Tests And Implementation (Approval Required)

- [ ] 2.1 Add failing disclosure, non-modal surface name, initial focus, nested Escape, close, and focus-return tests.
- [ ] 2.2 Add failing status-tab keyboard/selection and type-filter name/pressed-state tests.
- [ ] 2.3 Add failing select-all/row-selection and all existing task-action accessible-name tests.
- [ ] 2.4 Add failing preview/error-detail keyboard tests and preserve one callback per pointer or keyboard activation.
- [ ] 2.5 Add failing progressbar and bounded terminal live-status tests for processing/completed/failed/cancelled/retry transitions.
- [ ] 2.6 Add failing Chinese/English render tests for normal, empty, loading, success, processing, failed, cancelled, retry, archive, confirmation, and long-copy states.
- [ ] 2.7 Add failing 320/390/landscape geometry, overflow, 44×44 target, zoom, and long-text tests.
- [ ] 2.8 Implement the minimum task-specific drawer/trigger focus and semantic contract with nested overlay precedence.
- [ ] 2.9 Implement semantic status/type/selection/action/preview/details/progress behavior without changing task callbacks or ownership.
- [ ] 2.10 Move application-owned queue copy into the existing typed i18n boundary without rewriting task or result data.
- [ ] 2.11 Implement compact wrapping/target sizing with existing theme and z-index tokens; preserve desktop/tablet density.

## 3. Verification

- [ ] 3.1 Run focused task panel/item/progress/drawer component tests with exact exits and counts.
- [ ] 3.2 Browser-check pointer/keyboard/focus/Escape/nested overlay behavior and accessibility snapshots at desktop/tablet/mobile in Chinese/English and light/dark.
- [ ] 3.3 Capture same-state before/after screenshots and geometry at 1280×720, 768×1024, 390×844, 320×568, and 568×320, including 200% zoom.
- [ ] 3.4 Verify empty/loading/processing/success/failed/cancelled/retry/archive/long-text/broken-media states without provider calls or destructive actions.
- [ ] 3.5 Run Drawnix/full typecheck and lint, full tests/cycles/build/size/startup, and available smoke/feature/visual/responsive E2E against baseline.
- [ ] 3.6 Re-walk toolbar → task state → list/action → nested surface → close/focus return and update specs, evidence, ledger, conflicts, and rollback record.
