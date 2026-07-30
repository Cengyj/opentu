## Context

The outer application menu is a controlled shared Popover rendered into the board container. WinBox windows are appended separately and managed from a compact base layer of 5000. Shared `PopoverContent` currently forces every floating root to 5000 after merging caller styles, so the application's named `POPOVER_APP` value is not effective. A non-modal window can therefore cover a newly opened global menu even though the toolbar trigger remains active.

The initial fixed-band candidate was invalidated by source inventory. `ToolWindowService` defaults every `supportsMultipleWindows` or URL tool to `launchMode='new'`, exposes an explicit new-window command, and imposes no count limit. `ToolWinBoxManager` renders every active instance. Because `winboxManagerService` assigns `5000 + zeroBasedIndex`, the 501st registered window reaches 5500. The existing product contract is therefore unbounded at the service/UI boundary; this proposal must contain internal WinBox indices rather than assume a practical maximum or add an unrelated window cap.

## Goals / Non-Goals

- Goals: make the existing application menu and submenus topmost over any number of non-modal WinBox windows belonging to the same Drawnix instance, preserve pointer/visual reachability, keep higher-priority overlays above it, and retain all existing menu/window behavior and multi-window capacity.
- Non-Goals: global z-index normalization, changing ordinary toolbar/feedback/view popovers, changing TDesign portal layers, modal policy, menu redesign, keyboard/focus work owned elsewhere, WinBox geometry/activation semantics, limiting the number of windows, or new actions.

## Decisions

- Introduce one Drawnix-scoped managed WinBox host that creates an outer stacking context at the WinBox band. Every `WinBoxWindow` in that React tree, including tool-window portals and nested WinBox consumers, resolves its WinBox `root` to that host. Internal `5000 + index` values remain ordered but cannot compete with siblings outside the host.
- Preserve the current `container`/`document.body` resolution as a fallback when no Drawnix host context exists. Do not create one process-global host: multiple Drawnix roots must remain isolated and independently removable.
- Add an explicit optional `overlayZIndex` to `PopoverContent`. When absent, retain the current effective default of 5000 so unrelated callers do not change in this proposal. Use it only from `AppToolbar`; do not start honoring every existing `style.zIndex` value.
- Place the managed WinBox host at the named WinBox band and the application menu at the existing dialog-popover band (5500). The host—not a finite child count assumption—keeps all internal WinBox indices below the menu and higher application overlays.
- Keep WinBox children `position: fixed`, preserve the current viewport-relative geometry, and make only WinBox descendants pointer-operable through the otherwise non-interactive host. These are proposed invariants, not yet verified implementation facts; focused and real-browser tests are mandatory before acceptance.
- Keep the application-menu portal container, placement, dimensions, menu/submenu DOM, open state, dismissal, selection, focus, and analytics unchanged. The WinBox manager retains its ordering algorithm and values; only each window's outer root resolution changes inside an active Drawnix host.
- Keep `winboxManagerService` activation order, IDs, registration/unregistration, keepAlive, minimize/maximize/restore, and internal assigned values unchanged; only contain their CSS stacking reach.

## Invariants

- With no window open, menu geometry, contents, order, selection, dismissal, focus, and analytics remain unchanged.
- With a non-modal WinBox open, every visible menu/submenu point in its overlap is hit-testable as menu content, not window content.
- Opening/closing the menu does not change WinBox activation order, z-index variables, geometry, minimized/maximized state, or persistence.
- Opening additional supported tool windows remains unbounded by this change, and internal window order remains correct after activation and close across direct, tool, and nested WinBox callers.
- Notifications, authentication dialogs, viewers, loading, system errors, slideshow, and debug overlays retain their higher priority.
- Existing Popover callers without `overlayZIndex` retain their current effective stacking.

## Risks / Trade-offs

- Moving existing body/container-rooted WinBoxes under a Drawnix-scoped host can change containing-block assumptions, pointer targeting, fullscreen/maximize behavior, cleanup, or cross-root ordering even though WinBox children are currently fixed-position. Treat equal DOMRect, hit targets, lifecycle callbacks, and host removal as acceptance evidence; do not infer compatibility from CSS shape.
- A context fallback can accidentally split windows between hosted and legacy roots. Inventory all six static sites, unbounded ToolWinBox instances, nested media/prompt consumers, and any standalone package test/consumer; every WinBox in the active Drawnix tree must share the same host while absent-context behavior remains unchanged.
- An additive shared prop can be accidentally adopted as a general escape hatch. Keep the prop documented as an evidence-gated override and do not migrate unrelated callers in this change.
- Portal/stacking contexts can invalidate numeric reasoning. Acceptance depends on matched `elementFromPoint` samples and screenshots, not constants alone.
- Keyboard submenu and focus behavior share AppToolbar files with accessibility changes. Rebase without absorbing or overwriting their independent semantics.

## Verification And Rollback

- Add failing shared-Popover/AppToolbar tests proving the current style value is overridden and the explicit application-menu layer is applied without changing defaults.
- Add host/root tests with at least 501 controlled registered layers to prove an internal child at 5500+ remains below the 5500 menu sibling without imposing a count limit; verify multiple Drawnix hosts and absent-context fallback cleanup.
- Browser-check Settings, a direct generation/media window, and at least two simultaneous tool/nested WinBoxes: exact before/after rectangles, computed host/child/menu layers, overlap area, 3+ topmost samples, pointer selection, submenu, dismissal, and unchanged activation/minimize/maximize/restore/close.
- Capture a matched 1280×720 after screenshot using the same build/data/theme/viewport and add compact/tablet checks when the environment supports them.
- Run focused tests, edited-file lint, Drawnix/full typecheck, full tests, cycles, build, size, startup, and available visual/responsive/accessibility E2E against baseline.
- Rollback removes the explicit prop, caller opt-in, named-layer adjustment, tests, and after artifact. No migration or cache cleanup is required.
