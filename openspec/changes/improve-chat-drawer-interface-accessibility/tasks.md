## 1. Evidence and approval

- [x] 1.1 Trace Drawer open/close/width/focus, title edit, session CRUD, ordinary status, composer controls, i18n, and compact CSS in both directions
- [x] 1.2 Run the current three-file Chat UI test baseline and classify its stderr separately
- [x] 1.3 Record controlled 1280 × 720, 390 × 844, and 320 × 568 DOM/keyboard/geometry observations and screenshots
- [x] 1.4 Check overlap with Chat persistence, in-flight isolation, workflow UI, AI input accessibility, and startup-shell changes
- [x] 1.5 Record source/browser evidence, alternatives, validation thresholds, and rollback boundaries
- [ ] 1.6 Obtain user approval for the user-observable interface behavior changes

## 2. Reproduction tests (approval required)

- [ ] 2.1 Add close/reopen tests at 320/390/768 and opener/focus-return tests for pointer, Enter, Space, Escape, and programmatic open
- [ ] 2.2 Add a 1280 → 320 → 1280 width round-trip test plus pointer/keyboard resize boundary tests
- [ ] 2.3 Add title/session native-control, active-state, rename/delete, edit-Escape, focus, and non-nesting tests
- [ ] 2.4 Add ordinary loading/error/empty localization and bounded announcement tests in Chinese and English
- [ ] 2.5 Add composer locale/preview and compact/pointer-coarse 44 × 44 geometry tests

## 3. Implementation (approval required)

- [ ] 3.1 Preserve preferred desktop width while rendering compact mode full-screen and keep a compact reopen control reachable
- [ ] 3.2 Connect trigger/Drawer semantics and implement close focus return without programmatic focus stealing
- [ ] 3.3 Convert title editing and resize handle to named native/equivalent keyboard controls with nested Escape ownership
- [ ] 3.4 Restructure session selection/actions without nested interaction and expose active/focus/touch states
- [ ] 3.5 Localize Drawer, sessions, ordinary-message states, composer labels/placeholders/previews, and time formatting
- [ ] 3.6 Add bounded loading/error semantics and compact/pointer-coarse hit boxes without changing callbacks

## 4. Verification

- [ ] 4.1 Run focused Chat UI/session tests and record command, exit code, files, assertions, duration, and stderr classification
- [ ] 4.2 Run 10 responsive width round trips and keyboard/pointer/focus/status/i18n/touch browser checks at 1280/768/390/320
- [ ] 4.3 Capture same-data/theme/viewport after screenshots and compare geometry, overflow, focus, and visible states with the before evidence
- [ ] 4.4 Run edited-file lint, Drawnix/full typecheck, full tests, cycles, production build, size, and startup verification against baseline
- [ ] 4.5 Run available Chat smoke, feature, visual, responsive, keyboard, and accessibility flows; classify missing browser/runtime/credential conditions separately
- [ ] 4.6 Rewalk ordinary success, loading, error, close/reopen, session CRUD, edit cancel, refresh, compact/desktop, and auto-open paths without changing storage or request semantics
- [x] 4.7 Complete manual OpenSpec structure/requirement/scenario/conflict checks and record CLI unavailability

