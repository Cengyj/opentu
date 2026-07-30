## Context

Toolbox cards and toolbar launcher buttons call `toolWindowService`, `ToolWinBoxManager` renders each active instance through `WinBoxWindow`, and WinBox creates the root/title-bar/control DOM outside React's returned tree. Internal tool content is then portaled into `.wb-body`. The wrapper can safely decorate the created DOM, but accessibility behavior must be opt-in to F-15 tool windows so generation/settings/media windows are not changed during this functional loop.

The launcher context menu is a separate boundary. `ToolButton` is keyboard-focusable and named, but the surrounding TDesign Dropdown listens only for a context-menu pointer event and renders unfocusable `LI` entries. The repository's existing `Menu` and `MenuItem` primitives already implement roles, focus, arrows, Home/End, Enter/Space, and Escape.

## Goals / Non-Goals

- Goals:
  - Make the outer tool window discoverable as a named dialog.
  - Provide keyboard parity for every visible title-bar action.
  - Establish predictable focus entry, Escape, and safe focus restoration for open/minimize/close.
  - Expose launcher context actions to keyboard users with standard menu behavior.
  - Keep visuals and pointer actions equivalent.
- Non-Goals:
  - Add a modal focus trap to non-modal tool windows.
  - Change nested dialogs, tool content keyboard behavior, toolbox card semantics, or global WinBox consumers.
  - Increase target sizes or redesign title bars/menus without separate visual evidence.
  - Add keyboard shortcuts beyond standard dialog/control/context-menu keys.
  - Change pin, close, open-new-window, z-index, persistence, or analytics semantics.

## Decisions

- Decision: add opt-in accessibility labels/options to `WinBoxWindow`, supplied by `ToolWinBoxManager` from the current localized tool title.
  - The wrapper decorates the root and visible controls after WinBox creation and after title/state changes, without patching third-party code.
- Decision: focus the named window root or first stable window control after a new open/restore only when focus has not already been intentionally placed by mounted tool content.
  - The root uses programmatic focus (`tabIndex=-1`), while visible actions use button semantics and normal tab stops.
- Decision: translate Enter and Space on a decorated control into the same existing click callback; do not duplicate the action implementation.
- Decision: handle Escape only for the active tool window while focus is inside it and only when the event was not prevented/handled by a nested dialog, popover, viewer, or editor.
- Decision: capture the connected invoker before focus enters the window; close/minimize restores it when safe, otherwise the named launcher is the fallback and otherwise no forced focus move occurs.
- Decision: replace or adapt only the minimized-tools launcher context-menu surface to use the existing project `Menu`/`MenuItem` contract.
  - Shift+F10 and the Context Menu key open the same options as right click; initial focus enters the first enabled item; all close paths restore the launcher button.
- Decision: keep accessible names tool-specific and localized, but exclude raw custom-tool URLs, permissions, prompts, credentials, and IDs.

## Alternatives Considered

- Rely on CSS hover tips or `title` attributes.
  - Rejected because they do not make spans keyboard-operable and do not establish dialog/menu roles.
- Patch `node_modules/winbox` or TDesign Dropdown DOM.
  - Rejected because third-party source changes are prohibited and fragile across dependency updates.
- Globally modify all WinBox windows and all TDesign Dropdowns.
  - Rejected because it crosses unrelated feature loops and could change modal/focus behavior elsewhere.
- Add only `tabIndex` to the existing spans and list items.
  - Rejected because unnamed generic elements still lack control/menu semantics and standard keyboard behavior.
- Trap focus in the outer tool window.
  - Rejected because tool windows are non-modal and users must be able to move between canvas, toolbar, and multiple windows.

## Risks / Trade-offs

- Focus entry could override an intentional autofocus inside tool content.
  - Mitigation: defer the fallback focus and apply it only if focus remains on the invoker/body/outside the new tool window.
- Escape could close the outer window while a nested surface is open.
  - Mitigation: act only on an unhandled bubbling event from within the active window; nested surfaces retain first opportunity to prevent/stop the key.
- Multiple open windows require unique active-window behavior and focus restoration.
  - Mitigation: use existing activation order/WinBox manager state and per-instance invoker refs; cover two-instance tests.
- Replacing the launcher menu implementation could shift placement or styling.
  - Mitigation: reuse current z-index/theme variables, record exact before/after geometry, and require same-viewport screenshots before acceptance.

## Verification

- Component tests: named dialog root, localized control names, visible control tab order, Enter/Space parity, focus entry, nested Escape precedence, close/minimize restore, disconnected invoker fallback, and cleanup.
- Launcher tests: right click, Shift+F10, Context Menu key, menu/menuitem roles, first-enabled focus, arrow/Home/End cycling, Enter/Space, Escape/outside close, disabled options, multi-instance option, and focus restoration.
- Browser checks at `1280×720`, `390×844`, and `320×568`, Chinese/English, pointer and keyboard, one and two tool instances.
- Visual checks: identical window/menu placement, z-index, title truncation, and control geometry; no claim of visual improvement without measured evidence.
- Run focused tests, Drawnix typecheck/lint, full typecheck/test/cycles/build/size/startup, and available smoke/feature/visual/responsive flows.

## Rollback Plan

Remove the opt-in root/control decoration, focus/Escape handlers, launcher keyboard/menu adapter, localization strings, and focused tests. Existing pointer callbacks and stored tool/pin state remain intact; no migration, cache deletion, or data recovery is required.
