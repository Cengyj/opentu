## Context

`HoverTip` provides pointer help but does not name its child control in the current accessibility tree. `FramePanel` already owns language state, while `AddFrameDialog` and `FrameSlideshow` currently hard-code visible Chinese copy. Slideshow inactivity changes opacity without coordinating keyboard focus.

## Goals / Non-Goals

- Goals: make every existing action identifiable, expose selection/state, associate dimensions with their inputs, and keep focused slideshow controls visible.
- Non-Goals: new shortcuts, focus trap, toolbar redesign, touch-size redesign, slideshow timing changes, new drawing tools, export changes, or deck data changes.

## Decisions

- Put explicit localized names on the actual native/TDesign interactive control; do not rely on tooltip, SVG, CSS content, `title`, or adjacent text.
- Use `aria-pressed` for mutually exclusive view/tool toggle buttons and selected pen options where it matches the existing toggle behavior; use labeled groups for color/style/width choices.
- Width/height names include the dimension and unit context; preset buttons retain their visible label as the accessible name.
- Keyboard focus within the slideshow controls overrides inactivity hiding. The existing timer may hide controls only after focus leaves.
- Accessible strings must not include prompt content, page image URL, provider/task ID, error payload, credential, or hidden user data.
- Coordinate keys with `localize-ppt-editor-workflow`; whichever change is implemented second reuses existing strings rather than duplicating catalogs.

## Invariants

- Pointer, Enter/Space, Escape, arrow/page navigation, drawing tools, fullscreen lifecycle, and viewport restoration remain unchanged.
- Visible resting geometry, iconography, theme variables, and transition animations remain unchanged.
- No board, cache, task, history, prompt, or PPT metadata write is added.

## Risks / Trade-offs

- Incorrect `aria-pressed` ownership can announce stale state; component tests must rerender each tool/view/option transition.
- Keeping controls visible while focused changes the duration of an existing overlay state, so screenshots and keyboard tests must verify there is no permanent stuck-visible state.
- Color names must be meaningful and localized rather than raw hex alone.

## Verification And Rollback

- Component tests assert non-empty localized names, view/tool/option state transitions, width/height distinction, privacy exclusions, and focus/timer interaction.
- Browser verifies Tab order, visible focus, Enter/Space/pointer parity, Escape, fullscreen enter/exit, reduced motion, and viewport restoration in Chinese/English.
- Same-state desktop/tablet/mobile light/dark screenshots confirm no unintended resting layout delta.
- Rollback removes semantic attributes/focus override/tests only; no data migration is required.
