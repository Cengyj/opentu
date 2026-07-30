## Context

`openCleanConfirm` is a session-only boolean in `DrawnixState`. Application-menu, hotkey and command-palette writers cannot tell the always-mounted `CleanConfirm` which workflow control invoked it. The shared Floating UI dialog still places initial focus on Cancel and contains focus, but it has no registered reference to restore after close. Menu/command rows are ephemeral, so even capturing the immediate active row is insufficient; the feature needs a stable workflow owner or fallback.

The dialog is already localized, named, centered and fully contained in every measured viewport. Its 36 px TDesign actions are the only measured compact geometry correction in this change. Shared `ConfirmDialog` modal semantics and other callers remain a separate audit boundary.

## Goals / Non-Goals

- Goals:
  - Preserve initial Cancel focus and return focus deterministically after every existing close path.
  - Support menu, hotkey and command-palette invocations without persisting DOM nodes or reopening ephemeral surfaces.
  - Bring F-29 compact clear-confirm actions to the existing 44×44 convention while preserving current fit and desktop density.
  - Preserve explicit destructive confirmation, exactly-once deletion, history/autosave and localized copy.
- Non-Goals:
  - Change clear-board deletion semantics, add restore/undo UI, add cleanup confirmation, change `.drawnix` files, or modify task/provider/cache behavior.
  - Redesign the application menu or command palette; those shells retain their existing changes.
  - Change shared `ConfirmDialog` defaults for its other consumers or infer `aria-modal` policy without the full caller matrix.
  - Claim visual or performance improvement before after-state measurements.

## Decisions

- Introduce a narrow F-29 invocation contract that records a connected workflow owner/fallback outside persisted application state. A DOM node must never enter storage, board serialization, analytics, logs, or backup data.
- Application-menu invocation uses the stable app-menu trigger within the same Drawnix root rather than the ephemeral menu row. Hotkey invocation uses a connected prior workflow control when one exists and otherwise a stable board/toolbar control. Command-palette invocation consumes the palette's approved captured workflow owner instead of the unmounted command option.
- CleanConfirm owns return on Cancel, Escape and completed Confirm. If the target is disconnected at close, it resolves a documented same-root fallback and never automatically reopens the menu or palette.
- Keep the current FloatingFocusManager and initial Cancel behavior. Do not add autofocus to Confirm or execute any action on open.
- Add an F-29-specific class/opt-in for compact or primary coarse-pointer activation boxes. Do not globally restyle every shared confirmation caller. Keep 320/390/640 dialog width, wrapping, button text and desktop density stable.

## Alternatives Considered

- Rely on FloatingFocusManager without a reference.
  - Rejected because the real menu path closes to BODY in two viewport states.
- Store `document.activeElement` unconditionally.
  - Rejected because application-menu and command rows unmount; restoring a disconnected node cannot recover workflow position.
- Always focus the global application-menu trigger.
  - Rejected because hotkey and command-palette users may originate from another connected workflow control, and multi-Drawnix pages require same-root ownership.
- Reopen the menu or palette after cancellation.
  - Rejected because it changes the existing close decision and can trap users in an unwanted surface.
- Increase every shared ConfirmDialog button globally.
  - Rejected until the 30 consumer files have a complete compact caller matrix. F-29 has exact local evidence and can opt in without cross-feature layout regression.
- Treat `aria-modal=null` as an F-29 defect.
  - Rejected for this change because it is a shared primitive policy observed across many callers; the current F-29 dialog is already named and focus-contained.

## Risks / Trade-offs

- Captured owners can disconnect between open and close.
  - Resolve connection at close and use a same-root stable fallback; test unmount and root isolation.
- Command-palette close/next-frame dispatch can race confirmation focus and owner handoff.
  - Coordinate the two approved contracts and assert initial Cancel, final return and exactly-one target call without a later palette restoration stealing focus.
- Hotkey origin can be the board canvas or BODY.
  - Define the fallback explicitly and never focus a hidden/unfocusable element.
- 44 px actions can increase footer width or dialog height.
  - Measure 320×568, 390×844 and 640×360 with Chinese/English text and preserve complete containment, wrapping and background scroll lock.

## Verification

- Entry/focus: application menu, hotkey and command palette; connected/disconnected owner; initial Cancel; Tab containment; Escape, pointer Cancel and Confirm return; no BODY when a stable owner exists.
- Mutation: open/cancel/Escape cause zero delete/history/save operations; Confirm causes exactly one current `deleteFragment`, current history/after-change/autosave, and closes once.
- Responsive: 320×568, 375×667, 390×844, 640×360, tablet and 1280×720; full dialog in viewport; compact actions at least 44×44; body/canvas locked; desktop density unchanged.
- Visual/accessibility: zh/en, light/dark, zoom/high-DPI, pointer/keyboard/touch, same-state before/after, named dialog/description/native actions and visible focus.
- Run focused component/entry tests, Drawnix typecheck/lint comparison, full tests, cycles, production build, size/startup and relevant smoke/feature/visual/responsive suites.

## Migration and Rollback

No migration, cache invalidation, preference rewrite or user-data cleanup is required. Rollback removes only the transient invocation contract, F-29 scoped style and tests.

