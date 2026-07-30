# Change: Improve settings and toolbar accessibility

## Why

The reachable application menu exposes language and image-export submenus, but their parent items only open on mouse hover. In the current Chromium run, focus can reach the language item, yet `ArrowRight` opens no submenu and `Enter` closes the application menu. The toolbar's existing “More” control similarly opens by desktop hover or touch-device click detection, so native keyboard activation on desktop does not expose its panel. The canvas-settings switch is announced without a programmatic name.

A supplemental production measurement at 390×844 found all 13 application-menu rows, including Open, Save File, Export Image, Clear Board and Clean Invalid Media, at 32 CSS px high. At 320×568 and 640×360 the menu correctly uses internal scrolling and keeps the active row reachable, but the rows remain 32 px high. This is below the repository's existing 44×44 compact touch-target convention. The same 390×844 keyboard check focused Export Image and confirmed that `ArrowRight` left `aria-expanded=false`, one menu and zero PNG/JPG items, matching the earlier source/Language evidence.

Correcting these existing controls changes keyboard-, touch-, and assistive-technology-observable behavior and requires approval.

## What Changes

- Make the two existing application-menu submenus open and close through standard keyboard and touch activation while preserving pointer hover behavior.
- Keep submenu selection, parent-menu dismissal, focus return, current language selection, and PNG/JPG export callbacks consistent across pointer, keyboard, and touch paths.
- Make the existing toolbar “More” panel open through Enter/Space on desktop as well as through its current pointer/touch paths.
- At compact/pointer-coarse conditions, provide at least 44×44 CSS-pixel activation boxes for existing application-menu rows and submenu leaves while retaining internal menu scrolling and desktop density.
- Give the existing canvas task-progress-card switch a localized programmatic name associated with its visible setting copy.
- Preserve visible actions, toolbar layout, language values, export formats, settings values, analytics fields, and persistence formats.

## Impact

- Affected specs: `settings-toolbar-accessibility` (new delta)
- Affected code: shared `menu` components, application-menu language/export callers, `more-tools-button.tsx`, canvas settings switch, i18n values/tests as needed
- Adjacent changes: reuse existing hover-tip and color-system behavior; do not absorb provider-page controls, generic WinBox menus, or canvas editing toolbars owned by other functional changes
- Data impact: none; no language, toolbar, board, settings, cache, or migration format changes
- Visual impact: compact application-menu row hit boxes/scroll length only; icon/text size and desktop density remain unchanged
- Rollback: remove submenu/More keyboard wiring, switch naming, and focused tests; persisted user data remains unchanged

## Evidence

- `packages/drawnix/src/components/menu/menu-item.tsx:27-77` owns submenu open state, but only `mouseenter` opens it; the same button click still runs the ordinary parent selection chain.
- `packages/drawnix/src/components/menu/menu.tsx:39-85` handles Up/Down/Home/End/Escape/Enter/Space but has no Right/Left submenu navigation; Enter/Space calls `.click()`.
- `packages/drawnix/src/components/menu/common.ts:18-35` forwards an unprevented item selection to the parent menu.
- `packages/drawnix/src/components/toolbar/app-toolbar/app-toolbar.tsx:80-110` closes the application menu after any forwarded selection.
- The only two current `submenu` callers are `language-switcher-menu.tsx:20-47` and `app-menu-items.tsx:110-136`, so the same boundary prevents keyboard/touch selection of English and JPG.
- Supplemental F-29 interface audit: production zh-CN/DPR1 row heights were 32 px at 390×844, 320×568 and 640×360. At 320×568 the menu container was 418 px high with `clientHeight=416`, `scrollHeight=510`; End moved Version to y=518..550 inside the y=141..559 container. At 640×360 the container was 210 px high with internal scroll. These positive scroll results isolate the correction to touch geometry rather than menu containment.
- `packages/drawnix/src/components/toolbar/more-tools-button.tsx:130-173,192-235` opens by desktop hover; its click toggles only when touch-device detection succeeds.
- Controlled Chromium at 1280×720 showed: language parent focused; after `ArrowRight`, English menu-item count remained 0; after `Enter`, menu count became 0; activating “More” with Enter also left menu/panel count at 0.
- `packages/drawnix/src/components/settings-dialog/settings-dialog.tsx:3075-3090` renders visible title/description next to a `Switch` with no label relationship or `aria-label`; the live accessibility tree exposed an unnamed `switch`.

## Approval

Implementation is blocked until the user approves nested-menu focus/activation behavior, compact menu-item geometry, keyboard activation for the existing More panel, and the canvas-switch programmatic name.
