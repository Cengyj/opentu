## Context

HoverTip is visual hover/focus feedback; its content did not become an accessible name for the rendered action elements. Pointer drag currently owns the only panel-position interaction and already computes clamped viewport coordinates.

## Goals / Non-Goals

- Goals: named action controls, exposed pin/busy state, keyboard/pointer movement parity, and visible focus.
- Non-Goals: redesign the panel, change memory thresholds/polling, add a performance dashboard, change refresh/project callbacks, alter persistence semantics, or claim a visual improvement without screenshots.

## Decisions

- Add localized `aria-label` values directly to each existing action button; HoverTip remains visual supplementary help.
- Pin is a toggle button with `aria-pressed`; its name still reflects pin/unpin action. Create-project retains native `disabled` and adds an accessible busy state while awaiting the existing callback.
- Render the move handle as `button type="button"` (or equivalent correct button semantics), retain pointer capture, and support unmodified Arrow keys in fixed 10 CSS-pixel steps.
- Keyboard movement calls the same clamp helper as pointer movement and keeps focus on the handle. It does not synthesize pointer state or trigger refresh/project actions.
- Add focus-visible styling using existing theme/focus tokens without changing the idle visual state.

## Alternatives considered

- Rely on Tooltip/HoverTip: rejected by the rendered accessible-name evidence.
- Make the whole panel draggable by keyboard: rejected because it gives unrelated content an ambiguous interaction role.
- Add free-coordinate inputs: new product UI not required by the existing capability.

## Invariants

- Visibility thresholds, memory/image values, warning levels, five-second check, delayed lazy mount, confirmation, callbacks, pointer drag bounds, storage key/schema, visuals, and z-index remain unchanged.
- Chinese and English names contain no board name, media URL, task/provider identifier, or diagnostic detail.
- Escape/Enter/Space behavior of dialogs and action buttons remains native.

## Risks / Trade-offs

- Changing a `div` to a button can inherit browser styling; reset only the handle's native chrome with scoped styles.
- Arrow keys could scroll the page if not handled; prevent default only while the focused move control handles a supported key.
- Pin action name plus pressed state can be redundant in some screen readers; component tests and browser accessibility inspection will verify the chosen wording.

## Verification and rollback

- Component tests cover Chinese/English names, pressed/busy/disabled states, pointer and Arrow movement, clamp edges, focus retention, and action callbacks.
- Browser-check keyboard-only Tab/Enter/Space/Arrow flow at desktop/tablet/mobile and light/dark themes; compare same-state screenshots to confirm no idle layout change.
- Run focused lint/typecheck/tests and repository gates against baseline.
- Rollback markup/handler/styles/tests only.
