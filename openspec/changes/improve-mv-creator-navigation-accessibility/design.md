## Context

MV uses shared workflow navigation plus domain-owned selectable music and history rows. The current pointer behavior is valid, but accessible names are not localized and row selection has no keyboard-equivalent activation. Nested interactive controls make a simple parent key handler unsafe unless propagation and activation ownership are defined.

## Goals / Non-Goals

- Goals:
  - Give each MV navigation action one useful localized accessible name.
  - Let keyboard users select a music clip or history record with Enter/Space.
  - Prevent nested controls from selecting the row.
- Non-Goals:
  - Do not redesign rows, change target sizes, or alter colors/spacing.
  - Do not change form label/combobox behavior or outer WinBox focus.
  - Do not change clip discovery, record selection, task grouping, storage, generation, or analytics schemas.

## Decisions

- Add optional caller-supplied labels to the shared workflow nav and pass localized MV strings.
- Keep visible row markup and styling stable while giving selectable rows a button-equivalent role/tab stop and shared Enter/Space activation helper.
- Ignore bubbled row activation originating from nested interactive elements; nested controls retain native keyboard behavior.
- Use current visible clip/record text for row naming without including prompts, task IDs, credentials, media URLs, lyrics, or full records.

## Invariants

- Pointer click and Enter/Space select the same entity once.
- Audio play/pause, favorite, expand, delete, and confirm do not select the parent row.
- Counts, icons, visible text, record IDs, clip IDs, callbacks, and storage remain unchanged.
- Multiple MV windows produce no duplicate DOM IDs.

## Risks / Trade-offs

- Space can scroll the page or activate twice if default handling is incorrect.
  - Prevent default only for the focused selectable row and test one callback.
- Nested control events can bubble.
  - Detect interactive event targets and test audio/button cases.
- Shared nav prop names can diverge from the F-16 proposal.
  - Coordinate one optional prop contract before implementation.

## Rollback

Remove the optional MV navigation labels, row role/tab/keyboard handlers, and focused tests together. No storage or cache cleanup is required.

