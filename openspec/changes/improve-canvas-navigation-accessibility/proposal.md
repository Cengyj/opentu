# Change: Improve Canvas Navigation Accessibility

## Why

The reachable canvas search and minimap navigation surfaces expose existing pointer actions that assistive technology cannot identify or operate. The previous/next/close search buttons render only icons and have empty accessible names. The minimap canvas accepts pointer click and drag navigation, but it has no role, accessible name, focus target, or keyboard equivalent.

A controlled in-app Chromium sample also measured the compact navigation targets at a 390×844 viewport as 28×28 px (zoom out), 36×28 px (zoom menu), 28×28 px (zoom in), and 24×24 px (minimap toggle). This contradicts the source comment that describes a 44 px touch target and makes the most compact layout harder to operate by touch. Correcting names, keyboard behavior, target geometry, and motion behavior is user-observable, so implementation requires approval.

## What Changes

- Give canvas-search previous, next, and close actions localized accessible names without changing their existing click or Enter/Shift+Enter/Escape behavior.
- Expose the interactive minimap canvas as one localized, focusable two-dimensional navigation widget with concise keyboard instructions.
- Make Arrow keys pan the existing canvas viewport while minimap focus is active; prevent those keys from also scrolling the page or triggering canvas shortcuts.
- Keep compact navigation glyphs visually unchanged while making each zoom/menu/minimap-toggle target at least 44×44 CSS px at viewports up to 768 px.
- Disable the canvas-search entrance animation, view-navigation position transition, minimap entrance animation, and minimap preview motion when `prefers-reduced-motion: reduce` is active.
- Preserve viewport math, pointer/touch behavior, automatic minimap expand/hide timing, search matching, focus entry order, analytics payloads, storage, and rendering data.

## Impact

- Affected specs: `canvas-navigation-accessibility` (new capability)
- Affected code:
  - `packages/drawnix/src/components/canvas-search/canvas-search.tsx`
  - `packages/drawnix/src/components/canvas-search/canvas-search.scss`
  - `packages/drawnix/src/components/view-navigation/ViewNavigation.tsx`
  - `packages/drawnix/src/components/view-navigation/view-navigation.scss`
  - `packages/drawnix/src/components/minimap/Minimap.tsx`
  - focused component/browser tests and F-04 evidence
- Preserved data/API semantics: no board element, viewport persistence, workspace storage, cache, migration, service-worker, command, analytics event, or public component-prop schema change
- User-visible trade-off: the top-right control group occupies more physical space on compact viewports; keyboard focus can enter the minimap and Arrow keys are then owned by that widget

## Evidence

- `packages/drawnix/src/components/canvas-search/canvas-search.tsx:186-211` renders the three icon-only buttons without visible text or an accessible-name attribute. Controlled accessibility snapshots at 1280×720 and 390×844 report all three buttons with empty names.
- `packages/drawnix/src/components/minimap/Minimap.tsx:506-590,858-887` binds viewport navigation to pointer events on a `<canvas>` with no role, label, description, `tabIndex`, or keyboard handler. The expanded 390×844 sample measured the rendered canvas as 108×72 px and reported empty role/name/tabindex attributes.
- `packages/drawnix/src/components/view-navigation/view-navigation.scss:209-356` successively reduces controls at 768, 640, and 480 px. The 390×844 browser sample produced 28×28, 36×28, 28×28, and 24×24 px targets even though the comment at line 220 says “minimum 44px”.
- Pointer and keyboard navigation already converge on `BoardTransforms` and the same viewport persistence path, so this change can add an input adapter without changing serialized viewport data.

## Approval Gate

This change SHALL remain proposal-only until the user approves the observable accessibility, keyboard, touch-target, and reduced-motion behavior. The existing canvas-search correctness and LayerPanel state fixes are separate restorations of current behavior and are not blocked by this proposal.
