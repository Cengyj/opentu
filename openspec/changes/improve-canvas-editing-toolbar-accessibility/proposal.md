# Change: Improve canvas editing toolbar accessibility

## Why

The reachable canvas editing toolbar exposes width, height, aspect-ratio lock, and preset-size controls without accessible names. In the current 1280×720 application UI, the two inputs are announced only as unnamed textboxes and the lock/preset controls as unnamed buttons; the icon controls are 18×18 CSS pixels. The Chinese UI also exposes English-only creation-picker names and the popup link action as `Link`.

The same reachable flow cannot use unmodified Tab to leave a focused canvas when the pointer is within the board. The Drawnix global hotkey plugin treats every unmodified key as handled and calls `preventDefault()` even when the key is Tab and no canvas action runs. This blocks the browser's native forward focus movement into the editing controls.

These are current-source and runtime facts, not conclusions inferred from filenames: `SizeInput` renders visual `W`/`H` spans and hover tips without label relationships, while the shape/arrow lists store English titles directly. Adding semantic names, localized action labels, state relationships, or larger touch targets changes user-observable keyboard, screen-reader, and compact-layout behavior, so implementation requires approval.

## What Changes

- Give canvas width and height inputs localized accessible names without changing their stored values, parsing, aspect-ratio math, or commit/cancel semantics.
- Delegate unmodified Tab from the focused canvas to the browser so focus can follow the existing DOM order without changing pointer or element state.
- Give the aspect-ratio and preset-size controls localized, state-specific names and expose the existing pressed/expanded state to assistive technology.
- Localize the existing shape, arrow, and link action names while preserving the current tools, shortcuts, pointer modes, and drawing results.
- On touch-capable or compact editing surfaces, provide at least a 44×44 CSS-pixel activation target for the affected icon actions without enlarging the visual glyph or obscuring the selected element.
- Add focused component and browser coverage for names, state changes, keyboard operation, target size, popup fit, and focus order.

## Impact

- Affected specs: `canvas-editing-toolbar-accessibility` (new delta)
- Affected code:
  - `packages/drawnix/src/components/toolbar/popup-toolbar/size-input.tsx`
  - `packages/drawnix/src/components/toolbar/popup-toolbar/size-input.scss`
  - `packages/drawnix/src/components/toolbar/popup-toolbar/link-button.tsx`
  - `packages/drawnix/src/plugins/with-hotkey.ts`
  - `packages/drawnix/src/components/shape-picker.tsx`
  - `packages/drawnix/src/components/arrow-picker.tsx`
  - `packages/drawnix/src/i18n.tsx`
  - focused component and Playwright tests
- No element schema, serialization, clipboard format, cache, migration, task, network, analytics payload, or workspace persistence changes

## Evidence and approval gate

- `packages/drawnix/src/components/toolbar/popup-toolbar/size-input.tsx:301-355` renders `W`/`H`, hover-only lock text, and a preset trigger without `label`, `aria-label`, `aria-pressed`, or `aria-expanded` contracts for the final controls.
- `packages/drawnix/src/components/toolbar/popup-toolbar/size-input.scss:29-37,55-100` sizes the inputs at 36×18 and lock/preset buttons at 18×18.
- `packages/drawnix/src/components/shape-picker.tsx:28-63` and `packages/drawnix/src/components/arrow-picker.tsx:19-35` store English-only action titles; the selected-text popup exposes `Link` in the current Chinese UI.
- `packages/react-board/src/hooks/use-plugin-event.tsx:82-91` forwards document keydown to `board.globalKeyDown`; `packages/drawnix/src/plugins/with-hotkey.ts:317-410` then unconditionally prevents every unmodified key after the recognized shortcuts. The focused characterization test in `with-hotkey.test.ts:310-325` proves Tab is default-prevented, performs no canvas action, and is not delegated; 1 file/21 tests passed, exit 0. In the current application browser, pressing Tab from the canvas body left `document.activeElement` on BODY.
- Controlled application run: local Vite, application in-app Chromium, 1280×720, light theme, 100% page zoom, one selected text/rectangle. Accessibility snapshot contained two unnamed size textboxes and two unnamed size buttons; DOM measurements were 36×18 and 18×18 respectively.
- The proposal is investigation-only. Runtime implementation is blocked until the user approves native Tab delegation, semantic names, localization, and compact/touch target behavior.
