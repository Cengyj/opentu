## Context

The shared menu already provides native button menu items and vertical keyboard movement. Submenu state is local to `MenuItem`, while a successful item selection bubbles through `MenuContentPropsContext` and closes the outer application menu. Hover currently bypasses that selection chain, but Enter/Space and touch click do not. The toolbar More panel uses a wrapper click handler whose desktop branch intentionally does nothing.

## Goals / Non-Goals

- Goals: make existing nested actions reachable without hover, preserve one selection/close path, return focus predictably, keep compact application-menu actions at least 44×44 CSS px while retaining internal scroll, let keyboard users open More, and name the existing canvas switch.
- Non-Goals: new menu items, language persistence, new export formats, menu restyling, global focus-trap work, generic context-menu redesign, provider switch changes, toolbar persistence changes, or z-index normalization.

## Decisions

- A submenu parent is an opener, not a selectable leaf. Pointer/touch click and Enter/Space open it without forwarding the outer menu's select event.
- `ArrowRight` opens the focused submenu and focuses its first enabled item. `ArrowLeft` closes it and returns focus to its parent. Escape closes the current menu level before the outer menu. Existing mouse enter/leave timing remains available.
- Selecting a submenu leaf uses the existing single bubbling selection path so language/export executes once and the application menu closes once.
- The More trigger's native button owns keyboard activation. Enter/Space and click toggle the existing panel regardless of hover capability; pointer hover may still use the existing delayed-open behavior. No synthetic touch-device inference is used to suppress native button activation.
- Under the current compact or primary coarse-pointer boundary, application-menu parents/leaves use at least 44 px activation height without enlarging icons/text. Keep the existing bounded `.menu-container` overflow owner so 320×568 and 640×360 remain internally scrollable; focused Arrow/Home/End items must be fully revealed. Desktop row density is unchanged.
- The canvas switch's accessible name comes from the existing visible setting title through an explicit relationship or localized label on the actual switch. It does not include settings payloads, provider data, task IDs, URLs, errors, or credentials.

## Invariants

- Chinese/English values, PNG/JPG callback arguments, menu ordering, toolbar button registry, and analytics names remain unchanged.
- Pointer hover and click remain usable; leaf callbacks execute at most once per activation.
- Focus is never moved into a closed or disabled menu item.
- No localStorage, IndexedDB, board, cache, settings, or toolbar schema changes are introduced.

## Risks / Trade-offs

- Shared `MenuItem` is consumed beyond F-26 for ordinary leaf items; tests must prove leaf click/Enter and parent dismissal are unchanged.
- Portal focus timing can race Popover mount; focus must be scheduled from open state without arbitrary delays.
- A click that follows touch pointer events can double-toggle; pointer/click tests must cover one activation per gesture.
- Existing hover-close timers can close a keyboard-open submenu; keyboard ownership must cancel stale timers.
- Taller compact rows increase scroll length and can expose submenu placement/safe-area regressions; verify parent/leaf visibility, active-row reveal and no background canvas scrolling at 320/390/640×360.

## Verification And Rollback

- Component tests cover language and image-export submenus with hover, click/tap, Enter/Space, Right/Left, Escape, focus return, selection, and single callback/dismissal.
- More-panel tests cover desktop keyboard, pointer hover, touch/pointer click, outside close, and no double toggle.
- Settings tests and browser accessibility snapshots verify the switch name and unchanged checked state/callback.
- Browser verification covers Chinese/English, desktop/tablet/mobile/short landscape, keyboard-only, touch/pointer parity, 44×44 row geometry, active-row internal scroll, light/dark, zoom/high-DPI, and reduced motion without claiming visual improvement unless measured.
- Rollback removes the event/focus wiring, accessible relationship, and focused tests only; no data recovery is needed.
