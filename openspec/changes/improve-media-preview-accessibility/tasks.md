## 1. Semantics and focus

- [ ] 1.1 Add labelled modal-dialog semantics to `UnifiedMediaViewer`.
- [ ] 1.2 Implement initial focus, Tab/Shift+Tab containment, Escape close, and focus restoration.
- [ ] 1.3 Add accessible names and toggle/current/slot state to all preview controls and thumbnails.

## 2. Localization and responsive behavior

- [ ] 2.1 Move preview action names and status text to the existing i18n resources.
- [ ] 2.2 Expand mobile interaction hit areas without clipping or hiding existing controls.
- [ ] 2.3 Add reduced-motion handling for non-essential preview animations and transitions.

## 3. Verification

- [ ] 3.1 Add deterministic component tests for dialog semantics, names, focus cycle, Escape, and focus restoration.
- [ ] 3.2 Verify 1280, 768, 390, and 320 px in Chinese and English, light and dark themes, including 200% zoom.
- [ ] 3.3 Record before/after accessibility snapshots and responsive screenshots at identical states.
- [ ] 3.4 Run targeted lint, Drawnix typecheck, media tests, and relevant Playwright accessibility/responsive flows.
