## Context

The toolbox card currently provides two overlapping interaction layers: clicking the card opens the tool in a window, while child icon buttons delete, insert, or explicitly open it. Pointer event bubbling is already prevented by checking whether the event target is inside `.tool-item__actions`. The change must add semantic keyboard behavior without changing these established actions or the visual layout.

## Goals / Non-Goals

- Goals:
  - Make the card's existing default action discoverable and operable by keyboard.
  - Give every icon-only card action a stable, tool-specific accessible name.
  - Preserve exactly one callback per pointer or keyboard activation.
- Non-Goals:
  - Do not redesign the toolbox card, action visibility, focus styling system, drawer, or WinBox.
  - Do not change tool registration, multi-instance, pinning, API-key configuration, iframe permissions, insertion coordinates, deletion confirmation, or analytics semantics.
  - Do not add global keyboard shortcuts.

## Decisions

- Decision: keep the existing card element and add the minimum button-equivalent role, tab stop, keyboard handler, and accessible name.
  - Alternative: nest the whole card in a native `<button>`.
  - Rejected because: native buttons cannot validly contain the existing child buttons and would require a larger DOM/layout rewrite.
- Decision: activate the card on Enter keydown and Space keyup while preventing Space scrolling, following button keyboard timing and guarding child controls.
  - Alternative: activate both keys on keydown.
  - Rejected because: Space keydown differs from native button behavior and can cause repeat/double activation.
- Decision: include the tool name in every icon-button label, such as “将 我的提示词 插入画布”.
  - Alternative: generic labels such as “插入”.
  - Rejected because: repeated controls need target context when navigated outside visual grouping.

## Invariants

- Card pointer click and card keyboard activation call `onOpenWindow(tool)` once.
- Delete/insert/open child controls never trigger the card callback in the same activation.
- Missing optional callbacks remain no-ops and do not expose a misleading enabled action.
- Existing hover tips, DOM classes, data-track attributes, analytics payloads, and layout remain unchanged.
- No raw custom-tool URL, prompt, credential, or API key is added to accessible names or analytics.

## Risks / Trade-offs

- A custom button-equivalent card must match Enter/Space timing and ignore events originating from child controls.
- Adding cards to the Tab order increases the number of stops; this is intentional because the card exposes a distinct default action, but focus order must remain card then child actions in DOM order.
- Existing CSS may not provide a sufficiently visible focus indicator; browser verification must measure the current outline before adding any visual change. If a visible style change is required, update this change before implementation.

## Verification

- Component tests cover card role/name/tab stop, Enter, Space, pointer click, child action isolation, optional callbacks, and tool-specific action names.
- Browser checks at 1280×720 and 390×844 verify Tab order, visible focus, Enter/Space, action names, and one callback/action per activation.
- Re-run toolbox feature/smoke/visual/responsive tests where the configured Playwright browser is available.
- No performance claim is attached; verify that the card and action DOM counts are unchanged.

## Rollback

- Remove the card semantic/keyboard props, button accessible names, and focused tests.
- No storage, cache, manifest, task, canvas, or user-data rollback is needed.

