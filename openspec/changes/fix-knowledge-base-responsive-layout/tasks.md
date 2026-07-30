# Tasks: Keep the knowledge base operable on narrow viewports

## 1. Evidence and approval

- [x] 1.1 Trace manifest/window sizing and the internal tree/editor/details layout.
- [x] 1.2 Capture 390×844 WinBox, pane, action, scroll-width geometry and a same-state screenshot.
- [x] 1.3 Confirm the generic outer-window issue does not make the internal 982 px three-pane issue redundant.
- [x] 1.4 Check toolbox, media-library, generation-dialog, editor-durability, and accessibility changes for shared-file/behavior conflicts.
- [x] 1.5 Confirm note/storage/asset/backup schemas and desktop width preferences can remain unchanged.
- [ ] 1.6 Obtain user approval for the caller opt-in, compact pane navigation, focus behavior, and desktop-width preservation.

## 2. Implementation

- [ ] 2.1 Add failing tests for container breakpoint, pane visibility, mounted editor identity, selection, and desktop-width preservation.
- [ ] 2.2 Reuse the approved shared WinBox viewport constraint and opt in only the knowledge-base caller.
- [ ] 2.3 Implement container-driven tree/editor/details compact navigation without remounting the editor.
- [ ] 2.4 Add named keyboard/touch controls, focus return, theme-token styles, overflow handling, and reduced-motion-safe transitions.
- [ ] 2.5 Preserve desktop layout/resizers, right-tab state, read-only Skills, search, tags, import/export, and save/error behavior.

## 3. Verification

- [ ] 3.1 Run focused knowledge-base/window tests with exact counts, duration, and exit code.
- [ ] 3.2 Capture identical before/after geometry, accessibility snapshots, and light/dark screenshots at desktop/tablet/320/390/landscape sizes.
- [ ] 3.3 Measure at least five cold opens and viewport transitions and report stable-layout latency/event counts median/range.
- [ ] 3.4 Verify empty/loading/success/failure/retry, long content, search, missing media, virtual Skill, editor mode, and details paths.
- [ ] 3.5 Run Drawnix/full typecheck, full tests, cycles, build, size, startup, and available smoke/feature/visual/responsive flows.
- [ ] 3.6 Rewalk desktop↔compact transitions, draft preservation, focus, and width restoration and update the F-23 ledger/spec documentation.
