## 1. Evidence and Approval

- [x] 1.1 Inspect the live grid, active editor, toolbar, checkboxes, row image controls, column actions, and library controls for role, name, tab stop, and focus.
- [x] 1.2 Prove pointer select → Enter/Escape works and trace the root focus/key-scope dependency.
- [x] 1.3 Separate batch-content ownership from pending outer WinBox accessibility and responsive changes.
- [ ] 1.4 Obtain user approval for the grid, roving focus, accessible-name, and keyboard exit behavior.

## 2. Implementation (Approval Required)

- [ ] 2.1 Add failing component tests for named grid entry, one roving tab stop, row/column semantics, navigation, edit/return, and boundary exit.
- [ ] 2.2 Add failing tests for localized unique toolbar, column, checkbox, row-image, add-row, and library action names.
- [ ] 2.3 Adapt the existing active-cell state machine to expose roving focus without creating a parallel selection owner.
- [ ] 2.4 Preserve nested editor/dropdown/dialog/viewer key precedence and all pointer drag/fill/drop behavior.
- [ ] 2.5 Add only scoped token-based focus styling required to expose the current active target.
- [ ] 2.6 Keep prompt bodies, image URLs, task IDs, provider errors, credentials, and stored contents out of accessible names and analytics.

## 3. Verification

- [ ] 3.1 Run focused batch component/control tests with exact file/case counts and exit codes.
- [ ] 3.2 Verify Chinese/English, light/dark, 5 and large row sets, import/delete, model/params/media/viewer nesting, and pointer parity.
- [ ] 3.3 Verify keyboard entry, arrows, Tab/Shift+Tab, Enter, typing, Escape, Delete, copy/paste, undo/redo, and grid exit at desktop/tablet/mobile.
- [ ] 3.4 Capture same-state before/after screenshots and focus rectangles; record contrast/target geometry without unsupported visual claims.
- [ ] 3.5 Run Drawnix typecheck/lint and full typecheck/test/cycles/build/size/startup against the baseline.
- [ ] 3.6 Run available smoke/feature/visual/responsive Playwright flows and classify the configured-browser blocker separately.
- [ ] 3.7 Run OpenSpec strict validation; while the CLI is unavailable, record exit 127 and complete a manual format/name/conflict audit.
