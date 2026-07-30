# Change: Improve command-palette interface accessibility

## Why

The current production command palette is a visually modal overlay but exposes no dialog/combobox/listbox structure. The overlay, panel and list have no role/name; the search input has no explicit label, `aria-controls`, `aria-expanded` or `aria-activedescendant`; all 27 currently available rows are generic non-focusable divs with no role, ID, `aria-selected` or programmatic active state. ArrowDown visibly moved the active class from “Hand Tool” to “Selection Tool”, but the input and active row still exposed no selection relationship. The no-match node is also generic and has no live status.

Opening correctly focuses the search input. Escape from the current production menu path closes the palette and leaves focus on `BODY`; a mounted-component diagnostic produced the same result even with a connected “Stable opener” button. At 390×844, the first command row measured 37.390625 px high and the actual search input 22.5 px high, below the project's existing 44×44 compact touch convention. At 640×360, the fixed 420 px panel ended at y=474 under a 360 px scroll-locked body. After ArrowUp wrapped from the first to the last available command, the active “Clear Canvas” row was y=436.3125–473.703125 and fully outside the viewport.

The palette also always runs 120/150 ms scale/translate/blur animations; no command-palette reduced-motion rule exists. Correcting semantics, focus, status, compact touch geometry, landscape reachability and motion is user-observable and requires approval.

## What Changes

- Expose one localized named modal command surface and a standard combobox/listbox relationship for the search, grouped options and active option.
- Give every available command option a stable ID/role/selected state while retaining input-owned Arrow navigation and pointer activation.
- Expose localized result/no-result status without live-announcing every full command list or command target content.
- Preserve initial input focus and modal focus containment; return focus after cancel to the connected invoker or defined stable fallback.
- Coordinate execute close with command targets: commands that open another focus-owning surface hand final focus to that target; other commands return to the captured stable workflow control.
- At compact/pointer-coarse conditions, provide at least 44×44 CSS px search/option activation areas without enlarging glyphs; keep the list internally scrollable.
- Bound the panel to the short landscape viewport so the active option and complete list viewport remain reachable under body scroll lock.
- Disable nonessential palette overlay/panel animation under `prefers-reduced-motion: reduce` while preserving immediate state change.
- Preserve registry IDs/order/predicates, target execution, theme tokens, z-index, desktop density and all target-owned data/storage/recovery behavior.

## Impact

- Affected specs: new `command-palette-interface-accessibility`
- Affected code: `packages/drawnix/src/components/command-palette/command-palette.tsx`, `command-palette.scss`, open/focus-owner wiring in hotkey/application-menu/deferred feature paths, i18n keys if needed, focused tests and F-31 evidence/documentation
- Related boundaries: `stabilize-command-palette-input-handling` owns query/IME behavior; target-specific copy/outcomes remain with F-29 and other feature owners; F-30 result dialogs own their own final focus after opening
- Data/storage impact: none. No board, task, registry, cache, preference, workspace, backup or migration format change.
- Visual impact: compact hit areas, short-landscape height and reduced-motion behavior change; desktop option order/glyphs/theme/z-index remain.
- Rollback: revert semantic/focus/layout/motion wiring and tests together. No migration/cache cleanup is required; rollback restores the verified unnamed, body-focus and clipped interface.

## Evidence

- Render/behavior: `packages/drawnix/src/components/command-palette/command-palette.tsx:51-267` contains no dialog/combobox/listbox/option/status relationships, focuses by rAF, visually marks active class, closes on overlay/Escape and dispatches after close.
- CSS: `command-palette.scss:3-25,67-113,152-170` fixes max-height 420 px, uses 15 vh top padding, 8 px row padding and unconditional overlay/panel animations; no responsive or reduced-motion rule exists.
- State writers: application menu `app-menu-items.tsx:246-266` and hotkey `with-hotkey.ts:138-153`; conditional owner/unmount `DrawnixDeferredFeatures.tsx:115-190`.
- Production desktop: 27 current rows; all semantic attributes described above null; one visual active row; Tab/Shift+Tab remain on the only input; Escape ends at BODY; ` Mermaid ` produces a generic non-live no-match state.
- Production geometry: in-app Chromium, zh-CN, DPR1. Portrait 390×844 panel 358×420 at y126.59375–546.59375; input 22.5 px; row 37.390625 px; list client/scroll 373/1198. Landscape 640×360 panel y54–474; list y101.5–474, body 360/360 hidden; active last row y436.3125–473.703125, not fully inside viewport.
- Controlled focus diagnostic: exit 0 after assertion compatibility correction, connected opener remained unfocused and `document.activeElement===body` after Escape. Temporary file deleted.

