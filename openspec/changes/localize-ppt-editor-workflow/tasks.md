## 1. Evidence And Approval

- [x] 1.1 Inventory reachable PPT panel, outline, add-dialog, slideshow, status, confirmation, tooltip, error, and empty-state literals.
- [x] 1.2 Trace current language ownership and distinguish ephemeral UI copy from persisted default Frame names and user content.
- [ ] 1.3 Capture the current Chinese literals in a controlled English-mode runtime once the browser viewport/state is reliable.
- [ ] 1.4 Obtain user approval for the copy boundary and active-language naming of newly created default pages.

## 2. Failing Tests And Implementation (Approval Required)

- [ ] 2.1 Add failing Chinese/English render tests for normal, empty, loading, success, failure, cancel, retry, and slideshow states.
- [ ] 2.2 Add scoped PPT keys to the existing i18n boundary and wire `FramePanel`, `AddFrameDialog`, and `FrameSlideshow`.
- [ ] 2.3 Localize newly created default names while preserving existing stored/custom names and bilingual default-name recognition.
- [ ] 2.4 Keep user content, provider/model labels, raw external errors, URLs, filenames, analytics categories, and persistence formats unchanged.
- [ ] 2.5 Reuse approved accessible-name keys from `improve-ppt-editor-accessibility` without broadening either change.

## 3. Verification

- [ ] 3.1 Run focused i18n, PPT panel/dialog/slideshow, page-order, save/restore, outline, and export tests with exact counts/exit codes.
- [ ] 3.2 Verify Chinese/English long/empty/error copy, default/custom names, refresh, reorder, fullscreen, and keyboard/pointer parity.
- [ ] 3.3 Capture same-state desktop/tablet/mobile light/dark screenshots and record overflow/layout-shift measurements.
- [ ] 3.4 Run targeted lint, Drawnix/full typecheck, full tests/cycles/build/size/startup, and available E2E against baseline.
- [x] 3.5 Run OpenSpec strict validation; CLI unavailable (exit 127), then complete manual format/name/conflict validation.
