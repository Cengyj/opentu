## Context

The spreadsheet already owns an active cell, selected cells, edit mode, parameter popover, row checkboxes, and a document key handler. `selectCell()` programmatically focuses a `tabIndex=-1` root, after which the shortcuts work. The minimum change is therefore to expose a standard keyboard entry and semantics around the existing state machine, not to replace the table or add a second selection store.

The outer WinBox remains a separate pending accessibility boundary. This change starts at the batch tool content and must allow nested textareas, number inputs, model dropdowns, parameter popovers, media dialogs, and viewers to retain their own key handling.

## Goals / Non-Goals

- Goals:
  - Provide a discoverable localized name and one predictable Tab entry into the grid.
  - Keep active cell, selected cells, edit mode, and visible focus synchronized.
  - Preserve current spreadsheet shortcuts and pointer parity.
  - Name every existing icon-only action and row-selection control without exposing user content.
- Non-Goals:
  - Replace the HTML table, implement a new virtual grid, add shortcuts, or redesign spreadsheet visuals.
  - Change drag/fill/drop, row/task history, cache writes, generation, exports, or model/provider behavior.
  - Change outer tool-window dialog/focus/Escape or viewport geometry.

## Decisions

- Decision: use the existing table as the semantic grid owner and expose one roving active-cell tab stop rather than making every cell a permanent Tab stop.
  - This prevents dozens of sequential stops while giving keyboard users an entry point and preserving arrow/Tab movement inside the existing state machine.
- Decision: active cell semantics are derived from `activeCell`; do not create a parallel DOM-only selection state.
  - Row and column position/name are localized and safe; prompt text and task metadata are excluded.
- Decision: Enter opens the existing editor/popover, Escape returns to the active cell, and nested editable/popover/viewer handlers retain precedence.
  - The current `isEditableElementTarget()` guard is retained and extended only where a named nested surface requires it.
- Decision: supply explicit `aria-label` or equivalent project-supported accessible-name props to icon buttons and checkboxes.
  - Hover tips remain visual help but are not treated as the programmatic name contract.
- Decision: reuse current focus colors/tokens and add style only if the roving focus target lacks a visible indicator.

## Alternatives Considered

- Give the root `tabIndex=0` without grid/cell semantics.
  - Rejected because focus would enter an unnamed container without conveying the active row/column or control mode.
- Put every cell in the document Tab order.
  - Rejected because five rows already create more than twenty stops and larger imports would make navigation inefficient.
- Convert each row or cell to a native button.
  - Rejected because cells contain textareas, number inputs, dropdowns, upload buttons, thumbnails, and checkboxes; nested interactive content would be invalid or conflict.
- Rely on `title` and `HoverTip` for icon names.
  - Rejected because the live accessibility snapshot still exposed empty button names.

## Risks / Trade-offs

- Roving focus can drift after row deletion/import or cache hydration.
  - Mitigation: clamp/restore active position through the same task-row updates and test first/middle/last deletion plus import.
- Tab currently performs spreadsheet movement after pointer entry; adding a document entry must not trap users in the tool.
  - Mitigation: specify and test an explicit exit at the grid boundary while retaining Shift+Tab symmetry.
- Nested controls may double-handle Enter, Space, Escape, or arrows.
  - Mitigation: preserve native editable-target guards and test parameter/model popovers, textarea, checkbox, upload, media viewer, and nested dialogs.
- Localized row/column names could accidentally include prompt text.
  - Mitigation: construct names only from static action labels and 1-based row/column labels.

## Verification

- Component tests: grid name/role, one roving tab stop, row/column names, arrows, Tab/Shift+Tab, Enter edit, printable replacement, Escape return, delete, copy/paste, undo/redo, boundary exit, and dynamic rows.
- Control tests: all toolbar/column/row/library actions and checkboxes expose unique localized names in Chinese and English.
- Nested precedence: textarea/number/model/params/media/viewer controls handle their own keys once, with no outer duplicate action.
- Browser checks at desktop/tablet/mobile, short/long rows, horizontal scroll, light/dark, Chinese/English, 100% zoom and DPR 1/high-DPI where available.
- Visual evidence uses identical viewport/data/theme before/after and records focus rectangle/contrast; no aesthetic claim without measured evidence.
- Run focused tests, Drawnix typecheck/lint, full typecheck/test/cycles/build/size/startup, and available smoke/feature/visual/responsive flows.

## Rollback Plan

Remove the semantic attributes, roving entry/exit logic, localized labels, focused tests, and any scoped focus style. Existing pointer handlers and programmatic shortcut behavior remain, and no storage or task data requires migration.
