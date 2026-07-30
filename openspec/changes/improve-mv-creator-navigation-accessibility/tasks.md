## 1. Evidence And Approval

- [x] 1.1 Inspect reachable MV navigation names in Chromium.
- [x] 1.2 Trace music clip and history record pointer/nested-control activation.
- [x] 1.3 Separate form and outer-window ownership from MV row/navigation scope.
- [ ] 1.4 Obtain user approval for localized navigation names and keyboard row activation.

## 2. Failing Tests

- [ ] 2.1 Add MV caller tests for localized history, favorite, and back names.
- [ ] 2.2 Add music clip Enter/Space, pointer parity, and nested audio tests.
- [ ] 2.3 Add history record Enter/Space and nested favorite/expand/delete tests.

## 3. Implementation

- [ ] 3.1 Reuse one optional shared workflow navigation naming contract.
- [ ] 3.2 Add button-equivalent keyboard behavior to selectable MV music rows.
- [ ] 3.3 Add button-equivalent keyboard behavior to selectable MV history rows.
- [ ] 3.4 Preserve nested control activation and current visual styling.

## 4. Verification

- [ ] 4.1 Run MV Analyze/History, WorkflowNavBar, and shared interaction focused tests.
- [ ] 4.2 Inspect accessibility snapshots for empty and populated Analyze/History states in one and two windows.
- [ ] 4.3 Verify pointer/keyboard parity, Tab order, Enter/Space, audio, favorite, expand, delete/confirm, and privacy-safe names.
- [ ] 4.4 Run Drawnix/full typecheck, test, cycles, build, size, startup, and available E2E against baseline.
- [ ] 4.5 Run OpenSpec strict validation; while the CLI is unavailable, record the blocker and complete manual structure/conflict validation.

