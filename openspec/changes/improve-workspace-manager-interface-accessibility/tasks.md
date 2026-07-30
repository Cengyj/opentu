## 1. Evidence and approval

- [x] 1.1 Trace project trigger → deferred ProjectDrawer → tree/actions/search/dialog → useWorkspace and reverse UI writers
- [x] 1.2 Record controlled keyboard-versus-pointer, menu, dialog, search and English-provider component evidence
- [x] 1.3 Record 1280×720 production DOM/focus order/geometry and two before screenshots
- [x] 1.4 Separate confirmed findings from shared ConfirmDialog and compact/touch hypotheses
- [x] 1.5 Define non-overlapping ownership with deletion-transition, operation-failure, F-03/F-04/F-25 and other drawer/menu changes
- [ ] 1.6 User approves ProjectDrawer keyboard/focus/state/search/language/resize behavior

## 2. Tests first (approval required)

- [ ] 2.1 Add failing project trigger/drawer name, relationship, initial focus, close and return-focus tests
- [ ] 2.2 Add failing tree role/state/roving/arrow/Enter/Space/modifier/exact-callback tests
- [ ] 2.3 Add failing named focus-visible More and opt-in ContextMenu focus/submenu/Escape/return tests
- [ ] 2.4 Add failing rename and nested dialog/menu/drawer Escape precedence tests
- [ ] 2.5 Add failing loading/true-empty/no-match state tests
- [ ] 2.6 Add failing zh/en initial/live-switch and user-data sentinel tests
- [ ] 2.7 Add failing keyboard-resize clamp/value/callback/dock tests and non-opt-in shared negative controls

## 3. Implementation (approval required)

- [ ] 3.1 Add backward-compatible ProjectDrawer opt-in SideDrawer/BaseDrawer accessibility and resize props
- [ ] 3.2 Relate the toolbar trigger and ProjectDrawer, implement focus entry/return and nested Escape precedence
- [ ] 3.3 Implement the roving hierarchical tree contract while preserving pointer/drag/modifier behavior
- [ ] 3.4 Name/reveal item actions and implement the opt-in ContextMenu keyboard/focus contract
- [ ] 3.5 Split loading, true-empty and filtered no-match rendering
- [ ] 3.6 Add typed ProjectDrawer/F-02 zh/en keys and consume the existing provider
- [ ] 3.7 Implement bounded keyboard width adjustment using the existing width owner

## 4. Verification

- [ ] 4.1 Run focused ProjectDrawer/SideDrawer/ContextMenu unit and component tests with exit codes and counts
- [ ] 4.2 Run focused lint and Drawnix typecheck
- [ ] 4.3 Repeat the 1280×720 production keyboard/DOM flow and save after screenshots
- [ ] 4.4 Obtain 768/390/320 same-state screenshots/geometry before any compact/touch conclusion; record environment blockage if unavailable
- [ ] 4.5 Verify true empty, no match, loading, normal, rename validation, delete cancel/failure/success and refresh adjacency
- [ ] 4.6 Verify zh/en live switch while user names/files/errors remain byte-preserved
- [ ] 4.7 Run full typecheck/test comparison, cycles, build:web, size and verify:startup
- [ ] 4.8 Run available smoke/feature/visual/responsive E2E and classify environment failures separately
- [ ] 4.9 Collect five before/after samples before making any drawer-open/render/input performance claim
- [ ] 4.10 Re-run full forward/reverse chain and update ledger, F-28 matrix, docs and rollback record
- [ ] 4.11 Run `openspec validate improve-workspace-manager-interface-accessibility --strict`; while CLI is unavailable, retain exit 127 and manual structure/uniqueness checks
