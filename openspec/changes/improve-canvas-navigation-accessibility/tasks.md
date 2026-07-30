## 1. Evidence and Approval

- [x] 1.1 Trace zoom, search, minimap pointer, viewport persistence, and analytics paths in both directions.
- [x] 1.2 Measure compact target boxes and inspect search/minimap accessibility semantics in a controlled 390×844 application sample.
- [x] 1.3 Confirm the 1280×720 search correctness flow and separate the already-restored search counting behavior from this observable change.
- [x] 1.4 Audit formal specs and active changes for canvas-navigation accessibility requirement or file overlap.
- [ ] 1.5 Obtain user approval for accessible names, minimap Arrow-key behavior, 44 px compact targets, and reduced-motion behavior.

## 2. Implementation (approval required)

- [ ] 2.1 Add failing search component tests for localized names, disabled states, and unchanged previous/next/close callbacks.
- [ ] 2.2 Add failing minimap tests for role/name/description/tab stop, Arrow-key deltas, event containment, focus retention, and pointer parity.
- [ ] 2.3 Add failing responsive/computed-style coverage for 44×44 targets at 768, 390, and 320 px and no overlay overflow.
- [ ] 2.4 Implement the minimum semantic, keyboard, localized-name, responsive-hit-area, and reduced-motion changes.
- [ ] 2.5 Preserve viewport math, search shortcuts, minimap timing/rendering, analytics payloads, public props, and storage formats.

## 3. Verification

- [ ] 3.1 Run focused CanvasSearch, ViewNavigation, Minimap, hotkey, selection, and react-board replacement tests, ESLint, and Drawnix typecheck.
- [ ] 3.2 Verify pointer/touch/keyboard parity and accessibility-tree names at 1280×720, 768×1024, 390×844, and 320×568.
- [ ] 3.3 Capture comparable light/dark, Chinese/English, normal/reduced-motion, 100%/200% screenshots and measured target rectangles.
- [ ] 3.4 Run available smoke/feature/visual/responsive Playwright suites and classify browser/tool blockers separately.
- [ ] 3.5 Compare full typecheck, unit tests, cycles, build, size, startup, and lint with the recorded baseline.
- [ ] 3.6 Run OpenSpec strict validation; while the CLI is unavailable, record the blocker and complete a manual format/conflict audit.
