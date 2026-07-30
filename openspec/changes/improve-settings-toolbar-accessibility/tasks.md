## 1. Evidence And Approval

- [x] 1.1 Trace application-menu parent selection, both submenu consumers, Popover ownership, and outer-menu dismissal.
- [x] 1.2 Reproduce language submenu and More-panel keyboard behavior in controlled Chromium and inspect the canvas switch accessibility tree.
- [x] 1.3 Separate F-26 controls from provider switches, canvas editing toolbars, generic WinBox/context menus, language persistence, and z-index hypotheses.
- [x] 1.4 Measure 320×568, 390×844 and 640×360 application-menu row/scroll geometry and recheck the Export Image keyboard submenu boundary.
- [ ] 1.5 Obtain user approval for submenu focus/activation, compact menu-item geometry, More keyboard activation, and the canvas-switch name.

## 2. Failing Tests And Implementation (Approval Required)

- [ ] 2.1 Add failing shared-menu tests for click/tap, Enter/Space, Right/Left, Escape, focus movement/return, and single leaf selection/dismissal.
- [ ] 2.2 Make submenu parents open without forwarding leaf selection and preserve existing hover behavior.
- [ ] 2.3 Add failing More-panel tests and make its native trigger activation work on desktop keyboard and touch without double toggles.
- [ ] 2.4 Add a localized programmatic name/relationship to the canvas task-progress-card switch.
- [ ] 2.5 Preserve language/export callbacks, toolbar registry/layout, analytics, visible copy, settings values, and all persisted formats.
- [ ] 2.6 Add failing compact/coarse-pointer tests for at least 44×44 application-menu parents/leaves, internal scrolling and active-row reveal.
- [ ] 2.7 Apply compact hit boxes without enlarging glyphs/text or changing desktop density.

## 3. Verification

- [ ] 3.1 Run focused menu, app-toolbar, More-panel, settings, i18n, and accessibility tests with exact counts and exit codes.
- [ ] 3.2 Verify keyboard-only and touch/pointer flows in Chinese/English, including focus return, disabled items, outside close, and no duplicate activation.
- [ ] 3.3 Capture identical desktop/tablet/mobile light/dark accessibility and visual snapshots; compare control geometry and overflow.
- [ ] 3.4 Run targeted lint, Drawnix/full typecheck, full tests, cycles, build, size, startup, and available smoke/feature/visual/responsive E2E against baseline.
- [x] 3.5 Attempt strict OpenSpec validation; CLI is unavailable (exit 127), so complete manual structure, scenario, and requirement-name conflict checks without claiming strict validation.
