## 1. Evidence And Approval

- [x] 1.1 Trace application-menu trigger/portal/layer, shared Popover merge order, WinBox manager/CSS layer, and hit-test return path.
- [x] 1.2 Reproduce the 1280×720 Settings overlap and record exact rectangles, area, computed layers, three topmost hits, and a before screenshot.
- [x] 1.3 Run no-window and higher-layer context-menu controls without changing provider/settings data.
- [x] 1.4 Separate application-menu stacking from menu keyboard, Settings/tool-window accessibility, WinBox geometry, global z-index, and visual-theme owners.
- [x] 1.5 Inventory all WinBox roots and multi-instance writers; reject the fixed-5500-only design because the 501st unbounded tool window reaches that layer.
- [ ] 1.6 Obtain user approval for the application-menu opt-in plus Drawnix-scoped WinBox stacking containment.

## 2. Failing Tests And Implementation (Approval Required)

- [ ] 2.1 Add failing host/root tests for unbounded internal layers, multiple Drawnix instances, absent-context fallback, lifecycle cleanup, and unchanged window order/geometry.
- [ ] 2.2 Add one Drawnix-scoped managed WinBox stacking host/context and route every active-tree `WinBoxWindow` root through it without adding a window limit.
- [ ] 2.3 Add failing shared-Popover/AppToolbar tests and the backward-compatible `overlayZIndex` prop without honoring unrelated legacy style values.
- [ ] 2.4 Opt only the application menu into the named dialog-popover band and synchronize its named TS/Sass values with the managed host boundary.
- [ ] 2.5 Preserve menu/submenu placement, selection, dismissal, focus, analytics, plus WinBox registration, activation, geometry, minimize/maximize/restore/close, keepAlive, and fallback semantics.
- [ ] 2.6 Keep storage, tasks, provider/settings data, theme, multi-window capacity, and unrelated overlay callers unchanged.

## 3. Verification

- [ ] 3.1 Run focused Popover/AppToolbar/menu/WinBox tests with exact counts and exit codes.
- [ ] 3.2 Verify controlled 1/2/501+ internal-window layers stay below the menu, multiple Drawnix hosts remain isolated, and absent-host roots retain current behavior.
- [ ] 3.3 Verify direct Settings/generation/media plus simultaneous tool/nested WinBox overlaps with computed host/child/menu layers, equal geometry, 3+ topmost hits, pointer selection, submenu, and dismissal.
- [ ] 3.4 Verify activation/minimize/maximize/restore/close/keepAlive order and host unmount cleanup remain unchanged with multiple windows.
- [ ] 3.5 Verify no-window application menu, non-opted-in Popovers, higher-priority notification/auth/viewer/critical overlays, and current multi-window creation remain unchanged.
- [ ] 3.6 Capture matched desktop before/after and available tablet/mobile/theme/zoom/high-DPI checks without claiming unmeasured visual improvement.
- [ ] 3.7 Run edited-file lint, Drawnix/full typecheck, full tests, cycles, build, size, startup, and available E2E against baseline.
- [x] 3.8 Attempt strict OpenSpec validation; if CLI remains unavailable, record exit 127 and complete manual structure/scenario/owner checks without claiming strict validation.
