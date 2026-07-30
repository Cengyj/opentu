# Design: Improve Canvas Navigation Accessibility

## Context

Canvas navigation has three related input surfaces. `CanvasSearch` owns an input and three icon actions. `ViewNavigation` owns zoom controls and the minimap toggle. `Minimap` paints a spatial overview into a canvas and maps pointer coordinates back to a `BoardTransforms.updateViewport` call. All viewport writes already pass through the board operation and workspace-save chain; the accessibility gap is at the input/semantic boundary.

The change must preserve compact layout viability at 320 px, the Chat Drawer right offset, existing zoom values, pointer drag precision, minimap auto-expand/auto-hide behavior, search shortcuts, and board serialization. It must also avoid turning the minimap into a misleading ordinary button or slider: the widget controls two axes and has no single scalar value.

## Goals / Non-Goals

- Goals:
  - Make existing search actions identifiable to screen readers.
  - Provide a bounded keyboard equivalent for the minimap's existing navigation intent.
  - Restore a measured 44×44 CSS px compact touch target without enlarging glyphs.
  - Respect the platform's reduced-motion preference for this feature's nonessential transitions.
- Non-Goals:
  - Do not redesign the control group, minimap artwork, color system, preview, or zoom menu.
  - Do not add new zoom levels, minimap search, location bookmarks, global shortcuts, or screen-reader descriptions of every board element.
  - Do not change board/viewport persistence, minimap polling, rendering cadence, analytics schemas, or auto-hide timing.
  - Do not solve the separate minimap polling performance hypothesis in this change.

## Decisions

### Localized names reuse the existing language owner

`CanvasSearch` already derives `isZh`; its three buttons will receive names matching their current hover tips, with the close action named as an operation instead of only “ESC”. `ViewNavigation` and `Minimap` will use the existing i18n owner or receive only the localized strings needed internally. No raw board text, element ID, coordinate, or persisted value is included in an accessible name.

Alternative: rely on `HoverTip` or `title`. Rejected because the current browser accessibility tree proves the tooltip wrapper does not name the button, and a title alone does not provide keyboard navigation.

### The minimap is a named custom two-dimensional navigation widget

The interactive canvas will be one focusable custom navigation widget with a localized accessible name, `role="application"`, and an `aria-describedby` relationship to visually hidden Arrow-key instructions. This role is limited to the canvas itself so browse mode is not changed for the surrounding application. A focused widget consumes ArrowLeft/Right/Up/Down and moves the viewport center by 10% of the current visible viewport dimension per keydown. No modifier means normal step; repeated keydown may repeat at the browser's normal rate. Other keys are left untouched.

Each keyboard move will call the same bounded viewport helper used by pointer navigation, followed by the existing render scheduling. It will not synthesize pointer events, start drag state, or add a new analytics payload value. Focus remains on the canvas after navigation.

Alternative: expose the canvas as a button. Rejected because a button has one activation, while pointer navigation selects a location on two axes. Alternative: use a slider. Rejected because ARIA slider represents one scalar value and cannot accurately expose both axes. Alternative: add four new visible pan buttons. Rejected because that changes the visual/product surface more than needed to make the existing navigation intent keyboard-operable.

### Compact targets use layout size, not overlapping pseudo-elements

At viewport widths up to 768 px, the zoom-out, zoom-menu, zoom-in, and minimap-toggle buttons will each have a minimum 44×44 CSS px layout box. Icon dimensions remain unchanged. The control-group padding may be reduced only if the four targets still do not overlap and the group remains within a 320 px viewport and clear of the current drawer avoidance offset.

Alternative: use invisible pseudo-elements extending beyond 24–36 px controls. Rejected because adjacent hit regions could overlap and make the target selected by a pointer coordinate ambiguous.

Search action target sizing will use the same 44 px minimum only in the compact/touch breakpoint, with the input retaining a usable width at 320 px. Desktop geometry remains unchanged apart from semantic attributes.

### Reduced motion changes only nonessential transitions

Within `prefers-reduced-motion: reduce`, entrance/position/preview transitions owned by canvas search, view navigation, and minimap will be disabled. Viewport movement itself remains immediate as it is today; auto-hide delays and state transitions remain unchanged.

## Invariants

- Pointer click/drag on the minimap produces the same viewport coordinates as before.
- Zoom out/in remain ±0.1 and menu actions keep their current callbacks and focus behavior.
- Search previous/next/close callbacks and Enter/Shift+Enter/Escape semantics do not change.
- Arrow keys are prevented only when focus is on the minimap widget; canvas editing and global shortcuts outside it are unchanged.
- Keyboard movement changes only the current viewport and follows the existing workspace save path.
- Automatic minimap expansion, manual expansion, 3-second auto-hide, preview, and render cadence remain unchanged.
- Existing `minimap_navigate` analytics event names and payload values remain unchanged; no board text or coordinates are logged.
- No board, workspace, cache, localStorage, IndexedDB, or Service Worker schema changes.

## Risks / Trade-offs

- `role="application"` changes screen-reader interaction mode while focus is on the widget. Browser checks must verify that Tab and Shift+Tab exit normally and the described Arrow-key contract is announced.
- A 44 px four-control group is wider than the current compact group. Responsive screenshots at 768, 390, and 320 px must prove it does not overlap drawers, safe areas, or the search surface.
- Arrow-key step size could feel too coarse or too fine. The 10% viewport-relative value is deterministic and scale-independent; approval and browser verification are required before shipping.
- Search actions may make a 320 px overlay too wide. The responsive layout must preserve the input and count without horizontal viewport overflow.

## Verification

- Component tests verify localized search-action names and unchanged callbacks/disabled states.
- Minimap tests verify role/name/description/tab stop, four Arrow directions, 10% viewport-relative deltas, preventDefault scope, focus retention, and pointer parity.
- ViewNavigation/style tests or computed-style browser checks verify every compact target is at least 44×44 px at 768, 390, and 320 px while glyph sizes remain unchanged.
- Browser accessibility snapshots at 1280×720 and 390×844 verify names, focus order, Arrow-key operation, Tab exit, and no duplicate action.
- Light/dark, Chinese/English, 100%/200% page zoom, high DPI, coarse pointer, and `prefers-reduced-motion` checks cover the required states.
- Formal smoke/feature/visual/responsive Playwright suites run when the configured browser revision is available; the current missing executable remains an environment blocker rather than a product result.
- No performance improvement claim is attached. Bundle/startup baselines must not regress, and polling performance remains a separately measured hypothesis.

## Rollback

Remove the semantic/keyboard props and handler, localized labels/instructions, compact hit-area styles, reduced-motion overrides, and focused tests. Restore the previous responsive dimensions. No stored data, cache, board, or migration rollback is required.
