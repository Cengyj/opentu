# Change: Make the Batch-Image Spreadsheet Keyboard and Screen-Reader Operable

## Why

The batch-image tool advertises Enter, Tab, undo, redo, and drag behavior, but its spreadsheet shortcuts have no keyboard-only entry path. In the live DOM, inactive prompt/count/image cells are pointer-handled `div` elements with no gridcell/button role or tab stop; the root has `tabIndex=-1` and is focused only after a pointer-selected cell calls `selectCell()`. Five visible toolbar icon buttons, four column-fill buttons, row-selection checkboxes, and the library close action also lack stable action/row/column names.

A pointer click followed by Enter successfully opened the prompt textarea, proving the internal shortcut implementation works after pointer entry; the defect is the missing semantic/focus entry and control naming contract. Changing keyboard and assistive-technology behavior requires approval.

## What Changes

- Give the existing spreadsheet a localized, named grid contract with one predictable keyboard entry point and row/column-aware active-cell semantics.
- Preserve the existing single active-cell model and make Enter, Tab/Shift+Tab, arrows, typing, Escape, delete, copy/paste, undo, and redo reachable without a pointer.
- Give row and select-all checkboxes stable localized names that include row scope where applicable.
- Give existing toolbar, column-fill, row-image, add-row, and library controls localized accessible names; keep the visible text and action results unchanged.
- Keep pointer drag/fill/drop, table geometry, compact horizontal scrolling, task creation, persistence, imports/exports, model/provider routing, and outer WinBox behavior unchanged.
- Add component and browser coverage for keyboard entry, names, focus visibility, nested editor/popover precedence, and Chinese/English.

## Impact

- Affected specs: `batch-image-generation`
- Affected code: `packages/drawnix/src/components/ttd-dialog/batch-image-generation.tsx`, focused styles only if required for the existing focus indicator, shared leaf controls only through optional naming props, and tests
- Related changes: `improve-tool-window-accessibility` owns the outer WinBox dialog/title controls; `fix-tool-window-viewport-transition` owns outer compact geometry; neither supplies spreadsheet semantics
- Preserved data/API semantics: no cache/task/asset/Excel schema, provider request, model preference, analytics payload, or canvas insertion change
- Privacy: accessible names SHALL use localized action/row/column labels and SHALL NOT include prompt bodies, image URLs, task IDs, provider errors, credentials, or stored draft contents
- Rollback: remove the grid semantics, names, keyboard entry adapter, focus tests, and any scoped focus style; no data cleanup or migration is required

## Evidence

- `packages/drawnix/src/components/ttd-dialog/batch-image-generation.tsx:656-673,838-847` focuses the root only from `selectCell()` and scopes keyboard handling to focus already inside the component.
- `packages/drawnix/src/components/ttd-dialog/batch-image-generation.tsx:2358-2534` implements shortcuts but rejects events outside that focus scope.
- `packages/drawnix/src/components/ttd-dialog/batch-image-generation.tsx:2631-2652,2878-2897` renders inactive editable cells as pointer-only `div` elements.
- `packages/drawnix/src/components/ttd-dialog/batch-image-generation.tsx:3146,3177-3243,3365-3535,3574-3584` provides a programmatic-only root and unnamed icon/selection controls.
- Live DOM at `1280×720` had five prompt cells, zero sequential prompt-cell tab stops, root `tabIndex=-1`, and five unnamed visible toolbar icon buttons. Pointer select → Enter → Escape did open and close the correct editor.
- Runtime evidence: `docs/evidence/f19-batch-image/metrics.json`, `diagnostics.md`, and the three viewport screenshots.
