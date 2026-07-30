## 1. Evidence And Approval

- [x] 1.1 Inspect reachable navigation, mode, upload, feedback, and empty-history semantics in Chromium.
- [x] 1.2 Trace upload and history pointer/nested-control activation in source.
- [x] 1.3 Record desktop/tablet/mobile geometry, names, live-region count, file-input labeling, and touch rectangles.
- [x] 1.4 Separate outer WinBox and shared ComboInput ownership from Music Analyzer content.
- [ ] 1.5 Obtain user approval for localized names, state, keyboard, announcements, and compact touch behavior.

## 2. Failing Tests And Implementation (Approval Required)

- [ ] 2.1 Add Music caller tests for localized navigation/action names and selected/pressed state.
- [ ] 2.2 Add upload click/Enter/Space/drop/clear/file-type tests with single activation.
- [ ] 2.3 Add history row pointer/Enter/Space and nested audio/favorite/expand/delete/task isolation tests.
- [ ] 2.4 Add alert/status announcement, duplicate suppression, and privacy assertions.
- [ ] 2.5 Reuse approved shared WorkflowNavBar and ComboInput contracts without duplicating implementations.
- [ ] 2.6 Add compact 44×44 hit-area rules without changing desktop visual geometry.

## 3. Verification

- [ ] 3.1 Run focused Music Analyzer/shared navigation/ComboInput tests with exact counts and exit codes.
- [ ] 3.2 Inspect accessibility snapshots in create/reference/lyrics/generate/history and terminal task states for one/two windows.
- [ ] 3.3 Verify pointer/keyboard parity, focus visibility, Enter/Space/Escape precedence, audio and nested actions, Chinese/English, and privacy-safe names.
- [ ] 3.4 Capture before/after screenshots and control rectangles at desktop/tablet/mobile, light/dark, 100%/200%, and reduced motion.
- [ ] 3.5 Run Drawnix/full typecheck and lint, full test/cycles/build/size/startup, and available E2E against baseline.
- [x] 3.6 Run OpenSpec strict validation; while unavailable, record exit 127 and complete manual format/name/conflict validation.
