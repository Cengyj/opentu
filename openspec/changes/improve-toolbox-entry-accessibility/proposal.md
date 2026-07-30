# Change: Improve Toolbox Entry Accessibility

## Why

Toolbox tool cards open a tool through a click handler on a plain `<div>`. The card has no interactive role, tab stop, or Enter/Space handler. Its delete, insert, and open-window controls are square icon-only TDesign buttons wrapped in visual hover tips, but the buttons have no accessible names.

A controlled in-app Chromium accessibility snapshot at 1280×720 confirmed that a visible tool card was not keyboard focusable and that the insert/open-window buttons exposed empty accessible names. This prevents keyboard and screen-reader users from discovering which action each control performs. Correcting the interaction semantics is user-observable, so implementation requires approval.

## What Changes

- Expose each actionable tool card as one keyboard-focusable control with the tool name as its accessible name.
- Make Enter and Space perform the card's existing default “open in window” action without double-firing child button actions.
- Give delete, insert-to-canvas, and open-in-window icon buttons explicit accessible names that include the target tool name.
- Preserve the current pointer interactions, hover tips, card/action layout, search/category behavior, API-key handoff, analytics fields, registry, window launch mode, canvas insertion, and custom-tool deletion confirmation.

## Impact

- Affected specs: `toolbox`
- Affected code: `packages/drawnix/src/components/toolbox-drawer/ToolItem.tsx`, focused component tests, and F-15 browser evidence
- Preserved data/API semantics: no tool manifest, registry, localStorage key, iframe permission, window instance, canvas element, provider setting, or analytics payload schema change
- User-visible trade-off: each tool card and its explicit action buttons enter the Tab order; Enter/Space on the card opens the existing window action

## Evidence

- `packages/drawnix/src/components/toolbox-drawer/ToolItem.tsx:125-144` implements default opening only through `onClick` on a plain `<div>` and has no role, tabIndex, or keyboard handler.
- `packages/drawnix/src/components/toolbox-drawer/ToolItem.tsx:153-192` renders delete, insert, and open-window icon-only buttons without `aria-label` or visible text.
- `packages/drawnix/src/components/toolbox-drawer/ToolList.tsx:59-66` supplies the same insert/open/delete callbacks for every registered tool card, so the issue affects built-in and custom entries.
- Controlled application sample, local source at `http://127.0.0.1:7200/`, in-app Chromium (exact version unavailable), 1280×720: the tool card was absent from sequential keyboard focus, and accessibility nodes for the visible insert/open-window buttons had empty names.

