## Context

Prompt history uses an internal WinBox tool. Create/edit is a nested custom overlay rather than a TDesign dialog. Its fields are correctly associated through labels, but the overlay does not establish a modal accessibility boundary or own keyboard focus.

## Goals / Non-Goals

- Goals:
  - Expose a named modal dialog to assistive technology.
  - Put focus on a useful first control when opened.
  - Keep Tab and Shift+Tab inside the dialog while it is open.
  - Close on Escape and restore focus to the exact invoking control when it still exists.
- Non-Goals:
  - Do not redesign the dialog or replace all project dialogs.
  - Do not change prompt validation, edit permissions, persistence, analytics, or result aggregation.
  - Do not change toolbox/WinBox focus management outside this nested dialog.

## Decisions

- Decision: implement the minimum modal focus contract within `PromptHistoryTool` and reuse the existing form/overlay/theme styles.
  - Alternative: migrate the surface to a different dialog component.
  - Rejected because: it expands visual, portal, z-index, and dependency behavior beyond the confirmed defect.
- Decision: store the invoking element when opening and restore it after any close path.
  - Alternative: always focus the global "新建提示词" button.
  - Rejected because: row-level create/edit invocations would return users to the wrong context.
- Decision: handle Escape and focus cycling only while `dialogState` exists, with listener cleanup on close/unmount.
  - Alternative: install a permanent tool-level keyboard handler.
  - Rejected because: it risks intercepting shortcuts when no modal is open.

## Invariants

- Pointer mask dismissal, close button, Cancel, and successful Save all close the same dialog state.
- Empty sent prompt still blocks Save and retains entered values.
- Read-only sent prompts remain read-only for aggregated records where editing is not allowed.
- No raw prompt text is added to analytics or DOM attributes.
- Opening and closing the nested dialog does not remount the prompt-history tool or WinBox.

## Risks / Trade-offs

- A custom focus trap must correctly handle disabled/hidden controls and both Tab directions.
- The invoker can disappear after a successful edit/filter refresh; restoration must fall back safely without throwing.
- Nested media viewer/portal behavior must remain outside this dialog's keyboard handler when the create/edit state is closed.

## Verification

- Component tests cover create and edit invokers, initial focus, Tab/Shift+Tab cycling, Escape, pointer/Cancel/Save close, and focus restoration.
- Browser checks at 1280×720 and 390×844 verify dialog role/name/modal state, background isolation, focus order, Escape, and unchanged layout in light and dark themes.
- No performance claim is attached; record five open/close interaction samples only to detect a material regression, with the same viewport/data/theme before and after.

## Rollback

- Remove the dialog refs/effect/keyboard handler and related ARIA attributes/tests.
- No data cleanup or migration is needed; the change is limited to transient UI behavior.

