## Context

The palette is conditionally mounted under `DrawnixDeferredFeatures` only while `appState.openCommandPalette` is true. Menu/hotkey entries set that boolean; no opener identity is passed. The component renders an inline fixed overlay and panel. Only the search input is focusable. Active command state is a CSS class on generic div rows; category text and no-match text are generic divs.

All target commands are built from the registry and filtered by board predicates. The palette closes before target dispatch. Some targets open their own dialogs/drawers/windows; others update board/tool state. The shell must improve its own interaction without taking target feedback or final-surface semantics from those feature owners.

## Goals / Non-Goals

- Goals:
  - Provide localized named modal, combobox/listbox/option/group and active-descendant semantics matching current visual behavior.
  - Preserve input-owned keyboard navigation/pointer execution while making active/result state perceivable.
  - Provide deterministic focus entry, cancel return and target-aware execute handoff.
  - Keep compact controls at least 44×44 CSS px and all active options reachable in portrait/short landscape.
  - Respect reduced motion and preserve desktop theme/z-index/density.
- Non-Goals:
  - Add commands, recents/history/favorites, new search syntax, command customization or analytics.
  - Change target command operations, copy/outcomes, storage, caching, undo or recovery.
  - Make options independent Tab stops; the approved combobox pattern keeps Arrow navigation from the input.
  - Change global dialog/focus defaults for unrelated surfaces.
  - Claim faster search/rendering without measurement.

## Decisions

- Treat the overlay as one modal dialog named by a localized hidden/visible command-palette title. Give the input `role=combobox`, localized explicit name, `aria-expanded=true`, `aria-controls=<listboxId>` and `aria-activedescendant=<activeOptionId>`.
- Render the result container as `role=listbox`; category wrappers as named groups where supported; rows as `role=option` with stable command-derived DOM IDs and `aria-selected`. Keep rows out of the Tab order and retain input Arrow handling/pointer click.
- Use a narrow polite status for localized result count/no-match changes. Do not live-announce the entire list, shortcuts, query on every keystroke or command-target contents.
- Capture a connected invoker/previous focused element before opening. Cancel/Escape/outside click restores it; an unmounted menu row falls back to its stable application-menu button. Hotkey uses the connected prior workflow element. Execute records a close reason: target-opening commands own final focus after mount; non-surface commands return to the captured stable workflow control without reopening the palette.
- Apply 44 px minimum activation height to search/option targets only under the existing compact or pointer-coarse boundary. Keep icon/shortcut glyph sizes and desktop row density unchanged.
- Replace fixed-only `max-height:420px` in short viewports with a safe `min(420px, available dynamic viewport height)` budget including top/bottom inset/safe area. The panel remains inside the viewport; the list keeps internal scroll; `scrollIntoView` must make the active option fully visible.
- Add `@media (prefers-reduced-motion: reduce)` to remove overlay/panel animation and nonessential option transition. Preserve immediate open/active visual states.

## Alternatives Considered

- Make every command row a native button in the Tab sequence.
  - Rejected because 27–37 Tab stops conflict with the current searchable Arrow-navigation model. Combobox/listbox semantics provide the established pattern.
- Add only `role=dialog`.
  - Rejected because active selection, option names, result ownership and keyboard state would remain unexposed.
- Return focus to `body` after menu/hotkey invocation.
  - Rejected because production and component diagnostics prove the resulting lost workflow position.
- Always restore the palette invoker after executing a command.
  - Rejected because commands opening Settings, search or conversion dialogs need their target surface to own final focus.
- Unlock body scroll in landscape.
  - Rejected because it exposes background canvas movement. The panel/list must fit within the modal overlay.
- Shrink fonts/rows to fit more landscape commands.
  - Rejected because the active option remains outside the viewport and compact touch targets are already below project convention.
- Keep animations because they are short.
  - Rejected because reduced-motion preference applies to nonessential scale/translate/blur regardless of duration.

## Risks / Trade-offs

- ARIA combobox patterns are sensitive to ID lifetime and filtered results.
  - Derive stable option IDs from command IDs; clamp active index before publishing `aria-activedescendant`; clear it for no results.
- Result count announcements can be noisy while typing.
  - Debounce is not justified; use atomic concise status and verify actual screen-reader output where available without announcing each option.
- Focus restoration can race next-frame target dispatch.
  - Pass/record close reason and verify surface-opening versus non-surface commands separately; final target owners get precedence.
- 44 px rows increase scroll length.
  - The list already scrolls; verify active-row reveal and compact list performance without claiming improvement.
- Dynamic viewport units vary.
  - Provide safe `vh` fallback and measure 320×568, 375×667, 390×844, 640×360 and tablet/desktop.

## Verification

- Semantics: one localized named modal; named combobox; listbox/groups/options; stable IDs; active descendant and selected option through Arrow wrap/filter; concise result/no-result status.
- Focus: menu and hotkey entry, initial input, Tab containment, Escape/outside cancel return, execute handoff for tool/board command versus settings/search/conversion target, no BODY fallback when a stable owner exists.
- Keyboard/pointer: Arrow wrap, Enter, Escape, hover/click, predicates, filtered active-index clamp and no duplicate target call; composition behavior stays with the separate input change.
- Responsive: 320×568, 375×667, 390×844, 640×360, tablet and 1280×720; panel inside viewport; full active row visible; list scroll; 44×44 compact targets; no background scroll.
- Visual: zh/en, long labels/shortcuts, light/dark, 100%/high-DPI, reduced motion; same command order/icons/theme tokens/z-index.
- Run focused tests, Drawnix typecheck/lint comparison, full typecheck/test comparison, cycles, production build, size/startup and relevant smoke/feature/visual/responsive suites.

## Migration and Rollback

No data migration, cache invalidation, registry rewrite or user-data cleanup is required. Rollback removes F-31 semantic/focus/responsive/motion wiring and tests together.

