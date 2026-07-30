## Context

Canvas creation and editing controls are split across the unified creation toolbar, shape/arrow pickers, and the selection popup toolbar. Visual glyphs and hover tips are already present, but hover content is not a substitute for an accessible name and the size controls do not expose their state. The global canvas hotkey layer also cancels unmodified Tab without running a canvas action, so native forward focus cannot leave the canvas when the pointer is within the board. Compact/touch sizing must not make the popup overflow or cover the selection.

The existing `refactor-hover-tip-unification` change remains the authority for visual hover implementation, and `update-ui-color-system` remains the authority for color tokens. This change does not replace either one and does not introduce a new tooltip or color system.

## Goals / Non-Goals

- Goals:
  - Make every affected input/button distinguishable by a localized accessible name.
  - Preserve native Tab focus movement from the canvas into existing application controls.
  - Expose the existing aspect-ratio lock and preset popup state.
  - Preserve keyboard activation and make touch activation targets meet the approved threshold.
  - Preserve existing drawing, sizing, history, persistence, and pointer semantics.
- Non-Goals:
  - Add shapes, arrows, presets, link capabilities, or new shortcuts.
  - Redesign the popup toolbar, change size math, or alter element serialization.
  - Modify minimap/search accessibility, tool-window accessibility, or the global color/hover architecture.

## Decisions

- Decision: use explicit localized labels for width and height inputs.
  - The visible `W`/`H` may remain for compact visual density, but assistive names SHALL be full semantic words.
  - Alternative: rely on the adjacent visual span.
  - Rejected because: the spans are not associated with the inputs and the current accessibility tree proves they do not name them.
- Decision: return before the unmodified-key shortcut block when the key is Tab, without moving focus programmatically.
  - The browser SHALL retain ownership of DOM-order focus movement; the hotkey layer SHALL continue handling the existing named shortcuts.
  - Alternative: select and focus a toolbar control from Drawnix code.
  - Rejected because: programmatic focus would add a new navigation order and couple the canvas plugin to toolbar mounting and responsive visibility.
- Decision: name aspect-ratio actions by the action that will occur and expose current state separately.
  - The control SHALL distinguish “lock” from “unlock” and expose its boolean state; preset trigger SHALL expose popup expansion.
  - Alternative: reuse hover text only.
  - Rejected because: hover is unavailable to screen readers, keyboard-only users, and many touch users.
- Decision: preserve visual glyph size and enlarge the activation box only at the approved compact/touch boundary.
  - Alternative: globally enlarge all desktop controls.
  - Rejected because: it changes desktop density without evidence and increases popup overflow risk.
- Decision: reuse the current i18n table for shape, arrow, and link names.
  - Alternative: keep English names because they are technically understandable.
  - Rejected because: the application already provides a language owner and the current mixed-language state is measurable.

## Risks / Trade-offs

- Wider activation boxes may make the popup overflow at 320/390/768 widths.
  - Mitigation: retain glyph size, allow the existing popup wrap/scroll strategy, and test exact viewport bounds.
- New focusable or state attributes may change Tab order or announcement verbosity.
  - Mitigation: do not add wrapper tab stops; annotate existing controls and verify one focus stop per action.
- Delegating Tab may expose pre-existing focus-order gaps outside the canvas editing surface.
  - Mitigation: scope the implementation to stopping cancellation only, record the exact next focus target at each tested viewport, and leave unrelated application-wide order changes to their owning feature.
- Localized labels can exceed hover/popup width.
  - Mitigation: keep accessible text independent from glyph width and verify Chinese/English hover layout.
- Touch-target styles may conflict with the pending canvas-navigation accessibility change.
  - Mitigation: scope selectors to creation pickers and the selection popup; do not alter shared navigation selectors.

## Validation

- Component tests:
  - Chinese and English width/height names are unique.
  - Lock/unlock name and state change together.
  - Preset trigger reports collapsed/expanded and remains keyboard operable.
  - Shape, arrow, and link names use the active locale while shortcuts remain unchanged.
- Browser validation:
  - 1280×720, 768×1024, 390×844, and 320×568; light/dark; Chinese/English; 100% and 200% zoom.
  - Tab/Shift+Tab, Enter, Space, Escape, and screen-reader accessibility snapshot.
  - Characterization/regression test proves Tab is not default-prevented and does not mutate pointer, selection, history, or app state.
  - Exact target rectangles and popup viewport bounds; no overlap with selected-element resize handles.
  - Same rectangle/text fixture before and after; size operations, undo/redo, selection, link edit, and persistence remain identical.

## Rollback

Remove only the new i18n keys, semantic attributes, scoped target-size styles, and focused tests. No persisted data or cache rollback is required.
