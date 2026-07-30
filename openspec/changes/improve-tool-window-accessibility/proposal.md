# Change: Make Tool Windows and Launcher Menus Keyboard Operable

## Why

The toolbox entry itself has a separate pending accessibility change, but the next surface in the same user flow remains inaccessible. In a controlled in-app Chromium sample at `1280×720`, an open Prompt History WinBox exposed no dialog role, accessible name, modal state, or tab stop. Its visible insert, split, minimize, maximize, and close controls were 32 px `SPAN` elements with no role, tab stop, accessible name, or keyboard activation. Opening the window did not move focus into it, and Escape left the window open.

The minimized/pinned tool launcher button does have an accessible name, but its context menu is exposed only by a pointer `context-menu` trigger. After a right click, focus was `BODY`; the visible “常驻工具栏” and “关闭” entries were `LI` elements with no role or tab stop. A keyboard user therefore cannot reach the existing pin, close, or multi-instance “new window” actions.

Adding dialog, focus, keyboard, and menu semantics changes user-observable interaction behavior, so implementation requires approval.

The reachable F-20 Music Analyzer confirms this is the shared outer-window boundary rather than a Prompt History special case: its insert, split, minimize, maximize/full, and close controls are visible `SPAN` elements with no role, name, or tab stop, and the close control is absent from the accessibility snapshot. F-20 content accessibility is tracked separately; this change owns only the common WinBox shell and focus lifecycle.

## What Changes

- Give each toolbox tool WinBox a dialog role and an accessible name derived from the visible tool title.
- Give visible title-bar controls localized accessible names, button semantics, tab stops, and Enter/Space activation equivalent to their pointer action.
- Move focus into a newly opened/restored tool window without remounting its content, close the active tool window on Escape when no nested surface handles the key, and restore focus safely after close/minimize.
- Make each named tool launcher expose its existing context actions through Shift+F10 and the Context Menu key as well as right click.
- Render that launcher menu with menu/menuitem semantics, initial focus, arrow/Home/End navigation, Enter/Space activation, Escape close, outside-click close, and focus restoration.
- Preserve pointer behavior, window ordering, action availability, visual hierarchy, tool state, persistence, iframe permissions, analytics payloads, and all product capabilities.

## Impact

- Affected specs: `toolbox`
- Affected code: `packages/drawnix/src/components/winbox/WinBoxWindow.tsx`, `packages/drawnix/src/components/toolbox-drawer/ToolWinBoxManager.tsx`, `packages/drawnix/src/components/toolbar/minimized-tools-bar/MinimizedToolsBar.tsx`, existing menu primitives or a focused launcher-menu adapter, localization strings, and tests
- Related changes: `improve-toolbox-entry-accessibility` covers cards and card action names; `improve-prompt-history-dialog-accessibility` covers only the nested create/edit dialog; neither supplies the outer tool-window or launcher-menu contract in this change
- Preserved data/API semantics: no tool definition, pin preference, task, cache, canvas, iframe sandbox, or analytics schema change
- Rollback: remove the opt-in accessibility props/handlers and launcher menu adapter/tests; no data migration or cleanup is required

## Evidence

- `packages/drawnix/src/components/winbox/WinBoxWindow.tsx:607-624` creates WinBox without an accessibility label/role contract.
- `packages/drawnix/src/components/winbox/WinBoxWindow.tsx:823-870` adds split and insert controls as WinBox control spans with pointer click callbacks only.
- `packages/drawnix/src/components/winbox/WinBoxWindow.tsx:873-905` registers and portals the window but does not label the root or move focus into it.
- `packages/drawnix/src/components/winbox/WinBoxWindow.tsx:1127-1208` handles pointer/touch interaction and focus activation ordering, but supplies no title-bar keyboard activation or Escape close path.
- `packages/drawnix/src/components/winbox/winbox-custom.scss:148-188` styles the controls as 32 px pointer targets; CSS hover tips do not create accessible names or keyboard semantics.
- `packages/drawnix/src/components/toolbar/minimized-tools-bar/MinimizedToolsBar.tsx:178-241` gives `ToolButton` an `aria-label`, but wraps it in a TDesign `Dropdown` configured only with `trigger="context-menu"`.
- `packages/drawnix/src/components/menu/menu.tsx:29-100,102-117` and `packages/drawnix/src/components/menu/menu-item.tsx:82-93` already provide project-native menu/menuitem semantics and keyboard navigation that can be reused instead of modifying third-party source.
- Runtime DOM evidence: one open tool window had `role=null`, `aria-label=null`, `tabindex=null`; its five visible controls had no role/name/tab stop; Escape left `winboxCount=1`. The launcher menu opened with focus on `BODY`, and both visible `LI` items had `role=null` and `tabindex=null`.
- Runtime screenshot: `docs/evidence/f15-toolbox/desktop-window-1280x720.png`.
- Additional caller evidence: F-20 title controls and root metrics in `docs/evidence/f20-music-analyzer/metrics.json` plus the three viewport screenshots in that directory.
