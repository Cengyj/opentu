# Change: Fix application-menu stacking above non-modal windows

## Why

The application menu remains clickable while Settings and other existing WinBox windows are open, because those windows are non-modal. In the current production artifact at 1280×720, opening the application menu over Settings creates both surfaces at computed `z-index: 5000`. Their rectangles overlap by 114,395.25 CSS px², and three top-left/center/bottom-right `elementFromPoint` samples in that overlap all hit Settings instead of the menu. The menu enters the accessibility tree and focuses its first item, but visually only an approximately 16 px left strip remains exposed and pointer interaction over the rest reaches the window.

This is a concrete application-menu/WinBox stacking defect. It is not evidence for repository-wide z-index normalization.

## What Changes

- Keep the existing application menu and its submenus visually and pointer-operable above currently open non-modal WinBox application windows.
- Contain all WinBoxes belonging to one Drawnix application instance inside one managed outer stacking context, so the existing unbounded internal activation order cannot escape the WinBox band.
- Add a backward-compatible explicit stacking override to the shared `PopoverContent`; preserve the current default for every caller that does not opt in, and opt in only the application menu above the contained WinBox host.
- Keep notifications, auth dialogs, viewers, loading, system errors, slideshow, debug overlays, and the existing unlimited multi-window creation contract outside and above/below the same named bands as today.
- Preserve application-menu placement, contents, selection/dismissal, keyboard behavior, focus ownership, and all WinBox activation/geometry semantics.
- Do not normalize all Popovers, Sass/TypeScript values, TDesign portals, context menus, tooltips, drawers, dialogs, or magic numbers in this change.

## Impact

- Affected specs: `application-menu-stacking` (new delta capability)
- Affected code: Drawnix-scoped WinBox layer host/context, shared `WinBoxWindow` root resolution and manager/CSS, shared `popover.tsx`, `app-toolbar.tsx`, named layer constants, focused tests
- Adjacent changes: `improve-settings-toolbar-accessibility` owns submenu/More keyboard behavior; `improve-settings-surface-accessibility` owns Settings focus/semantics; WinBox changes own geometry/window accessibility; none owns this stacking transition
- Data/API impact: no user data, storage, cache, provider, task, or serialized API changes; the shared component receives one additive optional prop
- Rollback: remove the opt-in prop/constant adjustment/tests and matched after artifact; the menu-behind-window defect returns without migration or cleanup

## Evidence

- `app-toolbar.tsx:54-111` keeps the menu available and portals it into the board container while passing `Z_INDEX.POPOVER_APP` through `style`.
- `popover.tsx:197-220` spreads caller `style` and then unconditionally writes `zIndex: 5000`, so the caller's 4500 is ignored.
- `winbox-manager-service.ts:17,115-130` assigns WinBox layers from `Z_INDEX.DIALOG_AI_IMAGE` (5000); `winbox-custom.scss:6-10` enforces that variable with `!important`.
- `tool-window-service.ts:318-323,325-428,616-624` defaults every explicitly multi-window or URL tool to a new instance and has no count guard; `MinimizedToolsBar.tsx:135-154` exposes another new-window action. `ToolWinBoxManager.tsx:296-380` renders every active instance as a managed WinBox. The 501st registered window therefore receives 5500 under the current compact `BASE + index` assignment, so a fixed menu value of 5500 alone is not a valid solution.
- Current production source has six static `WinBoxWindow` JSX sites in five consumer files, plus unbounded tool-window component instances and nested WinBox consumers. `WinBoxWindow.tsx:608-624` and upstream WinBox `winbox.js:114,315` already support an explicit root, providing a bounded implementation seam; actual geometry, pointer behavior, React portal context, multiple Drawnix roots, and fallback behavior still require tests.
- Production rectangles: menu `(61,39)–(302.1875,551)`, Settings `(77,43)–(1203,677)`, intersection `225.1875×508=114,395.25 CSS px²`; both computed layers are 5000.
- Topmost overlap hits: `.wb-nw`, `.settings-dialog__nav-shell`, and `.settings-dialog__sidebar-list`; 0/3 belonged to the menu.
- Negative control after Settings closed: the same menu rectangle and layer were unchanged, its center topmost hit belonged to the menu, and WinBox count was 0.
- Positive higher-layer control: the Settings provider context menu at 20,000 had a center topmost hit inside that context menu above the same 5000 WinBox.
- Before-only screenshot: `docs/evidence/f26-settings-toolbar/app-menu-behind-settings-1280x720-before.jpg`, 1280×720, 62,387 bytes, SHA-256 `a2ce9470f4de4f0403c5e88bf24d97669bcc727918fbcc5002cb64f69e44d640`.

## Approval

Implementation is blocked until the user approves the application-menu stacking change, including the Drawnix-scoped managed WinBox stacking host required by the proven unbounded multi-window contract. A fixed 5500-only patch is explicitly rejected.
