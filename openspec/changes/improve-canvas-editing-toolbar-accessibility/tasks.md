## 1. Approval

- [ ] 1.1 Obtain user approval for native Tab delegation, localized names, state semantics, and the compact/touch 44×44 target requirement.

## 2. Focused tests

- [ ] 2.1 Add component tests for localized width/height names and unique label relationships.
- [ ] 2.2 Add component tests for ratio lock/unlock state and preset expanded/collapsed state.
- [ ] 2.3 Add component tests for localized shape, arrow, and link action names without shortcut changes.
- [ ] 2.4 Replace the current Tab-suppression characterization with a regression test for native Tab delegation and zero canvas-state mutation.

## 3. Implementation

- [ ] 3.1 Add/reuse i18n keys and annotate the existing inputs/buttons without introducing wrapper tab stops.
- [ ] 3.2 Add scoped compact/touch activation-area styles while preserving glyph dimensions and popup bounds.
- [ ] 3.3 Keep size math, pointer mode, drawing result, history, serialization, and persistence contracts unchanged.
- [ ] 3.4 Stop the Drawnix unmodified-key branch from cancelling Tab; leave focus ownership and order to the browser.

## 4. Verification

- [ ] 4.1 Run focused component tests, Drawnix typecheck, and targeted lint.
- [ ] 4.2 Run canvas-editing Playwright flows at 1280, 768, 390, and 320 widths in Chinese/English and light/dark themes.
- [ ] 4.3 Capture before/after accessibility snapshots, target rectangles, and visual screenshots with the same fixture.
- [ ] 4.4 Run full typecheck, tests, cycle check, build, startup verification, size, lint, and related smoke/visual/responsive suites; compare with the recorded baseline.
- [ ] 4.5 Run `openspec validate improve-canvas-editing-toolbar-accessibility --strict`; if the CLI remains unavailable, record exit 127 and perform structural/manual delta checks without claiming strict validation.
