## Context

`WinBoxWindow` dynamically imports WinBox, creates its third-party DOM/instance in a React effect, saves a normal rectangle, and later has separate effects for visibility, auto-maximize, interaction, and dimension constraints. Callers mix numeric and percentage dimensions with explicit minimums.

WinBox parses non-autosize percentage dimensions and stores them without applying its parsed minimum. Its explicit `resize(w,h)` stores the requested values, clamps only local render variables, and does not write those clamped values back. Its no-argument `resize()` uses the stored values. The wrapper therefore cannot treat a visually clamped DOM rectangle as proof that WinBox's normal state was committed.

The first lazy-loaded open and a cached reopen differ because the dimension effect ran and returned before the first constructor became available, while every effect runs on a fresh cached mount. This creates a cold/warm state fork before any user resize.

## Goals / Non-Goals

- Goals:
  - Make the effective normal rectangle obey the caller's existing parsed min/max constraints on cold and warm creation.
  - Keep the stored normal rectangle and rendered rectangle identical so maximize/restore does not discard a constraint.
  - Recalculate initial caller placement from the effective dimensions.
  - Preserve intentional user/caller geometry transitions and feature state.
- Non-Goals:
  - Change any caller's declared percentage, minimum, maximum, responsive breakpoint, or product layout.
  - Implement viewport-resize/orientation recovery, mobile redesign, z-index, focus, dialog semantics, title-control keyboard behavior, or target sizing.
  - Persist new window geometry or change existing tool-window saved-size schemas.
  - Patch `node_modules/winbox`, replace WinBox, or add a global window-layout service.
  - Claim performance or visual improvement beyond exact geometry acceptance.

## Decisions

- Decision: normalize in the project wrapper, not third-party source and not three feature callers.
  - Caller-specific numeric workarounds would duplicate parsing/centering and leave other percentage/minimum combinations with the same shared state fork.
- Decision: compute effective targets from WinBox's already parsed numeric `width/height/minwidth/minheight/maxwidth/maxheight` immediately after construction. Clamp both dimensions first, then call `resize()` with already-effective numeric values so WinBox stores and renders the same values.
  - Do not duplicate WinBox percentage parsing against a guessed viewport/container size.
- Decision: after initial normalization, reapply the original `x`/`y` intent through the existing WinBox move API. `center` is therefore evaluated with the final rectangle; numeric/caller positions retain their existing intent.
- Decision: save `lastNormalPositionRef` only after normalization and placement. A later maximize/restore then reads one committed normal rectangle.
- Decision: adapt the current prop-constraint effect to pass already-effective clamped numeric values. It must not rerun merely because a portal child renders, and it must continue to skip active split mode.
- Decision: do not silently overwrite intentional current user size on unrelated rerenders. Normalization runs on construction and only when the existing width/height/minimum dependencies invoke the current constraint path.
- Decision: when the current viewport is smaller than a declared raw minimum, use WinBox's parsed effective min/max values so the rectangle does not exceed the current container merely to satisfy an impossible raw minimum.
- Decision: preserve maximum-mode skip-update behavior and callbacks. Normalization occurs before optional auto-maximize and does not emit a new product analytics event.

## Invariants

- Existing caller props, window IDs/classes, percentage values, declared minimums, breakpoints, open/close state, and portal content remain unchanged.
- Initial normal `width/height` equals the rendered rectangle and is within the current parsed effective min/max constraints.
- Maximize then restore returns to the latest committed normal rectangle unless the user/caller intentionally changed it.
- Split mode may intentionally lower a minimum and retains its current cycle; user drag/resize and keep-alive saved state are not reset by content rerenders.
- Settings drafts, generation parameters/tasks/results, media state, tool state, routing, storage, analytics, and all callbacks remain unchanged.
- No credential, URL, prompt, task data, or raw content enters geometry logs/tests.

## Alternatives Considered

- Pass resolved numeric sizes only from Settings, image, and video callers.
  - Rejected because it duplicates a shared prop contract, must reimplement center/viewport parsing, and leaves the wrapper inconsistent for future existing callers/viewports.
- Add `winboxLoaded` or `isReady` only to the dimension-effect dependencies.
  - Rejected because it fixes the cold/warm scheduling fork but still calls `resize` with an under-minimum stored value; maximize/restore would continue to reuse that value.
- Read `getBoundingClientRect()` and copy the DOM size into the instance.
  - Rejected because layout output can include transforms/scale and would create a read/write layout dependency. Parsed instance constraints are the authoritative geometry inputs.
- Change `height="60%"`/`"88%"` or lower minimums.
  - Rejected because no evidence says the feature specifications are wrong; doing so would hide the shared contract defect and redesign current layouts.
- Patch WinBox's constructor/resize implementation in `node_modules`.
  - Rejected because third-party source modification is prohibited and would be fragile across dependency updates.

## Risks / Trade-offs

- Existing callers may have visually relied on an under-minimum first open.
  - Mitigation: inventory every caller; focused tests prove already-valid numeric/percentage geometry is unchanged and only declared constraints take effect.
- Reapplying center after clamp changes current top/left placement.
  - Mitigation: this is necessary to keep the final rectangle inside the same viewport; exact expected rectangles are measured and approved before implementation.
- Split, auto-maximize, keep-alive, and viewport-transition changes share wrapper code.
  - Mitigation: test each state and rebase without absorbing their separate product semantics.
- The current constraint effect's `onResize` callback can persist geometry for tool windows.
  - Mitigation: normalization preserves the existing callback mechanism; tests assert no duplicate callbacks and no unintended saved-size write for unchanged valid geometry.
- F-08 responsive changes may land first.
  - Mitigation: rebase onto one shared normalization step, then keep orientation/maximized viewport recomputation in its existing owner.

## Verification And Rollback

- Add deterministic fake-WinBox tests that model non-autosize percentage parsing, local min clamp, stored normal values, first async load, cached remount, maximize/restore, center placement, and callback counts.
- Test already-valid percentage and numeric dimensions as negative controls; test an impossible raw minimum against a smaller effective viewport.
- Cover split enter/cycle/restore, manual resize, keepAlive hide/show/minimize/restore, autoMaximize, and prop-constraint changes without content remount.
- Browser verification at 1280×720 reproduces Settings three-cycle, image, and video rectangles before/after with identical data and no task/provider request. Available compact/orientation flows remain verified by their feature owners.
- Run focused wrapper/Settings/TTD tests, Drawnix typecheck/lint, then full typecheck/tests/cycles/build/size/startup and available smoke/feature/visual/responsive E2E against baseline.
- Capture matched screenshots only after implementation; exact rectangle values are the visual acceptance metric. No speed, memory, bundle, or aesthetic claim is implied.
- Rollback removes normalization/helper/tests and restores the prior wrapper effects. No migration, cache invalidation, credential rewrite, or user-data recovery is needed.
