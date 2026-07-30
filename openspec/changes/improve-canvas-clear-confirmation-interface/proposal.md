# Change: Improve canvas-clear confirmation interface

## Why

The existing clear-board action is reachable from the application menu, `mod+Backspace`/`mod+Delete`, and the command palette. All three entries write only `openCleanConfirm=true`; the always-mounted `CleanConfirm` has no `DialogTrigger` or invocation-owner input. In the current production build, the confirmation correctly opens as a named dialog with initial focus on Cancel, but cancelling from the real desktop application-menu path with Escape leaves `document.activeElement` on `BODY`. A real 390×844 expanded-toolbar/menu path produced the same BODY result after pointer cancellation.

The confirmation itself fits completely at 320×568, 390×844, and 640×360, but its current Cancel and Confirm activation boxes are 62×36 CSS px at all three measured viewports. That is below the repository's existing 44×44 compact touch-target convention. Correcting focus return and compact activation geometry changes observable interface behavior and therefore requires approval.

## What Changes

- Capture a non-persisted invocation owner when the existing clear-board confirmation is opened from the application menu, hotkey, or command palette.
- Preserve the current initial Cancel focus and focus containment while the confirmation is open.
- On cancellation, Escape, or completed confirmation, return focus to the connected invoking workflow control or a documented stable fallback instead of `BODY`.
- Coordinate with the command-palette focus-handoff owner so a palette invocation returns to the workflow owner captured before the palette, not to an unmounted command row.
- Give only the F-29 clear-board confirmation's compact/pointer-coarse Cancel and Confirm actions at least 44×44 CSS-pixel activation boxes while preserving glyph/text size and desktop density.
- Preserve the current localized title/description/actions, named dialog, explicit confirmation, no-mutation cancellation, exactly-once board deletion, Plait history, autosave, registry IDs, shortcuts, and storage formats.

## Impact

- Affected specs: new `canvas-clear-confirmation-interface`
- Affected code: F-29 clear-confirm invocation wiring in the application menu/hotkey/command registry, `components/clean-confirm/clean-confirm.tsx`, a scoped style if required, focused tests, and F-29/F-28 evidence
- Related boundaries: `improve-settings-toolbar-accessibility` owns shared application-menu/submenu keyboard and compact menu-item geometry; `improve-command-palette-interface-accessibility` owns palette-level capture/handoff; shared `ConfirmDialog` modal defaults and its other consumers are not changed by this proposal
- Data impact: none. No board element schema, history format, workspace record, cache, localStorage, IndexedDB, backup, task, provider, or migration change.
- Visual impact: only compact clear-confirm action hit boxes; the current dialog size/copy/theme and desktop action density remain.
- Rollback: revert invocation-owner/fallback wiring, scoped compact styling and focused tests together. No migration or data cleanup is required; rollback restores the verified BODY focus and 36 px compact actions.

## Evidence

- Entries: `packages/drawnix/src/components/toolbar/app-toolbar/app-menu-items.tsx:147-168`, `plugins/with-hotkey.ts:178-186`, and `components/command-palette/command-registry.ts:383-390` write the same boolean without an owner.
- Mount/close: `packages/drawnix/src/drawnix.tsx:323-335,1672-1674`; `hooks/use-drawnix.tsx:57-76`; `components/clean-confirm/clean-confirm.tsx:6-30` is always mounted and passes no reference trigger to the shared dialog.
- Destructive boundary: `clean-confirm.tsx:23-28` closes through state and calls `board.deleteFragment(board.children)` only on Confirm.
- Dialog primitive: `components/dialog/ConfirmDialog.tsx:149-188` supplies heading/description/native actions; `components/dialog/dialog.tsx:137-162` supplies the focus manager but can restore only a registered reference, which this caller does not provide.
- Production browser: existing `dist/apps/web`, loopback, in-app Chromium, zh-CN, DPR 1. At 1280×720, menu -> Clear Board -> Escape opened with Cancel focused and closed to BODY. At 390×844, expanded toolbar -> menu -> Clear Board -> pointer Cancel also closed to BODY.
- Geometry: dialog/button samples were 320×568: dialog 288×186.1875, buttons 62×36; 390×844: 358×160.59375, buttons 62×36; 640×360: 440×160.59375, buttons 62×36. Every dialog was fully in viewport under a scroll-locked body.
- Permanent focused `CleanConfirm`/`ConfirmDialog` behavior tests were not found. A current source search finds 30 consumer files plus the shared primitive, so this proposal uses an F-29 caller opt-in rather than changing all shared defaults without a caller matrix.

