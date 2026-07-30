## Context

The user path is tool card or launcher → `toolWindowService.openTool` → `ToolWinBoxManager` → `WinBoxWindow` → WinBox DOM. `useDeviceType` correctly publishes the new viewport, and `ToolWinBoxManager` correctly derives compact numeric dimensions. The shared wrapper then restores the desktop minimum before calling WinBox `resize`, while WinBox retains the previous position. Programmatic `resize`/`move` callbacks also flow back into `toolWindowService.updateToolPosition`, so a naive clamp would overwrite the user's desktop rectangle and explain the observed failed round trip.

This change overlaps a shared file with `fix-generation-dialog-maximized-viewport-resize`. That pending change is limited to maximized image/video generation dialogs. The branches must remain explicit: this change applies only to tool windows that opt in and are visible, non-minimized, and non-split. Ordinary tool windows preserve/restore user rectangles; maximized tool windows remain maximized and derive their rectangle from the current viewport.

## Goals / Non-Goals

- Goals:
  - Keep the title bar and all window controls reachable after viewport resize or orientation change.
  - Preserve the mounted internal React component or iframe and its runtime state.
  - Preserve the user's non-compact rectangle across an automatic compact clamp.
  - Keep automatic layout callbacks from being misclassified as user movement/resizing.
  - Keep auto-maximized tool windows within the current viewport even when manifest dimensions are larger.
  - Coalesce repeated viewport events and remove listeners on cleanup.
- Non-Goals:
  - Change direct cold-open dimensions or the existing 16 px horizontal / 60 px vertical compact budget.
  - Change manual off-screen drag tolerance, split/minimize semantics, maximized-state identity, or z-index ordering.
  - Change generation-dialog behavior covered by the separate maximized-dialog proposal.
  - Persist per-breakpoint rectangles or add a new preference/data format.
  - Change tool execution, iframe permissions, canvas insertion, task recovery, or analytics schemas.

## Decisions

- Decision: add an explicit viewport-constraint option to `WinBoxWindow` and enable it only from `ToolWinBoxManager`.
  - This keeps non-tool WinBox consumers on their current behavior and makes the F-15 boundary testable.
- Decision: compute effective minima from the configured minima and the current available rectangle.
  - Desktop minima remain unchanged when they fit; compact viewports are not forced wider or taller than their available space.
- Decision: on the first automatic constraint, capture the live non-constrained geometry in a ref; suppress outward `onMove`/`onResize` persistence callbacks while applying the automatic `resize`/`move` pair.
  - This prevents `ToolWindowState.position/size` from treating responsive layout as a user preference.
- Decision: restore the captured rectangle when it fits again, clamping only if the expanded viewport is still smaller; clear the captured value after restoration.
- Decision: a genuine pointer/touch resize or move while constrained replaces the stale restoration candidate.
  - The user's later explicit action wins over a pre-transition snapshot.
- Decision: process `resize`/orientation-driven layout in one animation-frame callback and clean up the listener/frame on unmount.
  - This avoids multiple forced layouts during one viewport transition without changing user-visible timing guarantees.
- Decision: when the opted-in tool is maximized, size/move it to the current viewport budget on open and viewport changes, suppressing those layout callbacks from persistence while keeping maximized state.
  - Unlike ordinary windows, no pre-compact user rectangle is restored until the user exits maximize; the wrapper's existing maximize/restore owner remains authoritative.

## Alternatives Considered

- Pass only `minWidth={Math.min(400, viewportWidth - 16)}` from `ToolWinBoxManager`.
  - Rejected because it fixes the width clamp but not the stale x/y position, same-breakpoint desktop shrink, callback persistence, or round-trip restoration.
- Force width/height through CSS.
  - Rejected because WinBox internal geometry, resize handles, callbacks, and DOM geometry would diverge.
- Recreate the WinBox with a viewport-dependent React key.
  - Rejected because it remounts tool content and can discard unsaved form, iframe, scroll, and task UI state.
- Apply one global viewport policy to every `WinBoxWindow`.
  - Rejected because generation, settings, media, and prompt-optimization windows belong to other functional loops and have different maximize/minimum rules.
- Persist desktop and mobile rectangles in storage.
  - Rejected because no evidence requires cross-session breakpoint memory and it would introduce a data contract/migration.

## Risks / Trade-offs

- WinBox may emit move/resize callbacks synchronously or asynchronously; a suppression guard that is cleared too early could still persist automatic geometry.
  - Mitigation: focused fake-WinBox tests cover callback ordering, and the implementation keeps suppression tied to the complete layout transaction.
- Rapid resize events could restore and reclamp repeatedly.
  - Mitigation: animation-frame coalescing and one captured source rectangle per constrained interval.
- A user interaction can overlap a viewport transition.
  - Mitigation: user interaction cancels or replaces the pending restoration candidate; interaction/deferred-close behavior remains covered.
- The pending maximized-generation change touches the same wrapper.
  - Mitigation: tests assert the tool-maximized branch is gated by tool opt-in and does not execute for generation/non-tool windows; ordinary/min/split/hidden branches and implementation/rollback remain separable.

## Verification

- Wrapper tests with a fake WinBox: ordinary clamp/effective minima/position/callback suppression/round-trip restoration/user interaction plus auto-maximized initial fit, resize/orientation fit, and maximize/restore identity.
- Manager integration: internal and iframe tools receive the opt-in policy; cold compact sizing remains unchanged; multi-instance rectangles remain independent.
- Browser samples, at least five runs per direction where timing is measured: `1280×720 → 390×844 → 320×568 → 1280×720`, plus `844×390 ↔ 390×844`.
- For each state record viewport, WinBox rect, close-control rect, document scroll width, active instance, mounted-content identity, and pre/post saved tool state.
- Capture same-tool screenshots before and after at identical viewports/themes.
- Re-run focused tests, Drawnix typecheck/lint, full typecheck/test/cycles/build/size/startup, and available smoke/feature/visual/responsive tests.

## Rollback Plan

Remove the opt-in property, viewport transaction/listener, and focused tests. No stored rectangle or schema is introduced, so rollback requires no migration, cache deletion, or user-data action.
