## Context

The user path is canvas/AI/tool entry → `MediaLibraryModal` → `WinBoxWindow` → `MediaLibraryGrid` → `AssetItem` → desktop `MediaLibraryInspector` or mobile `Drawer`. `MediaLibraryModal` correctly notices the 768 px breakpoint, but its WinBox retains the desktop 800 px minimum. The mobile inspector subtree is mounted conditionally, yet its visible state only has a false/close writer.

`fix-tool-window-viewport-transition` has already isolated an opt-in viewport-constraint design in the shared wrapper. This change must not silently apply that behavior to every WinBox or make media-library approval depend on toolbox approval.

## Goals / Non-Goals

- Goals:
  - Keep close, upload, view, filter, batch-selection, and selected-asset details controls reachable at supported narrow widths.
  - Preserve the mounted media-library React subtree and current selection across automatic viewport fitting.
  - Preserve desktop geometry and inspector behavior when the viewport can contain the current minimum.
  - Provide one explicit, keyboard- and screen-reader-identifiable way to open the existing mobile detail drawer without changing a card tap into an automatic drawer open.
- Non-Goals:
  - Redesign the media library or add asset actions.
  - Change filters, insertion success/failure, deletion ordering, quota, cache, or persistence semantics; those belong to separate changes.
  - Change full-screen media preview/editor behavior.
  - Persist per-breakpoint window rectangles or add a new storage format.

## Decisions

- Use an explicit viewport-constraint opt-in for the media-library WinBox. If the shared wrapper primitive from `fix-tool-window-viewport-transition` is available, reuse it; otherwise implement the same generic primitive without enabling any non-media caller.
- Compute effective compact minima from the current viewport budget while retaining `800×500` whenever it fits. Automatic fitting includes both resize and reposition so the title controls remain within the viewport.
- Treat viewport fitting as automatic layout. It must not remount the grid, clear selection, maximize the window, or be reported as a user move/resize.
- Keep a normal card tap as selection. Show a localized details action for the selected asset on mobile; activation sets `showMobileInspector=true`, and closing the drawer returns focus to that action when it remains mounted.
- Do not render or enable the details action with no selected asset. Inspector actions and their existing confirmations remain unchanged inside the drawer.

## Alternatives Considered

- Change only `minWidth` with CSS.
  - Rejected because WinBox internal geometry and title controls remain outside the viewport and live transitions retain stale x/y.
- Automatically maximize the media library below 768 px.
  - Rejected because returning to desktop has no current unmaximize/restoration contract and maximizing changes more window semantics than fitting.
- Remount the WinBox with a viewport-dependent React key.
  - Rejected because it discards selection, scroll, pending upload, and mounted preview state.
- Open the detail drawer on every mobile card tap.
  - Rejected because the current code explicitly preserves tap-for-selection and refers to a separate details action; auto-open would interfere with multi-selection and browsing.
- Apply a global viewport rule to every WinBox.
  - Rejected because tool, generation, settings, prompt, and media windows have separate state and approval boundaries.

## Risks / Trade-offs

- Shared WinBox work can conflict with the pending toolbox viewport change.
  - Mitigation: one generic opt-in primitive, separate caller flags, and tests proving non-opted-in/maximized/minimized/split windows are unchanged.
- A mobile details action can crowd card overlays.
  - Mitigation: show it only for the selected asset, preserve the approved theme tokens, and verify 320/390 px, Chinese/English, and 200% zoom.
- Focus restoration can target an unmounted virtualized card.
  - Mitigation: restore only when the invoker remains connected; otherwise focus a stable grid control.
- Rapid resize/orientation events can cause repeated layout work.
  - Mitigation: coalesce the opt-in viewport transaction and measure event-to-stable geometry over at least five runs.

## Verification

- Component/wrapper tests: cold compact fit, desktop→mobile fit, orientation transition, title-control bounds, non-opted callers unchanged, mounted-content identity, and cleanup.
- Modal/grid tests: no selected asset/no details action; select asset/details action appears; keyboard activation opens labelled drawer; close restores focus when possible; batch-selection state remains intact.
- Browser matrix: `1280×720`, `768×1024`, `390×844`, `320×568`, and `844×390`, light/dark, Chinese/English, 100% and 200% zoom.
- For each state record viewport, WinBox/control rectangles, document scroll width, selected asset, drawer visibility, and card/grid scroll state.
- Capture same-state before/after screenshots and accessibility snapshots.
- Run focused tests, Drawnix lint/typecheck, full typecheck/test/cycles/build/size/startup, and available smoke/feature/visual/responsive tests.

## Rollback Plan

Remove the media-library opt-in, compact sizing/details action/focus behavior, localized strings, and focused tests. The asset, cache, board, and task stores are unchanged, so rollback needs no migration or cleanup.
