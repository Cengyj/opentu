## Context

Music Analyzer combines shared workflow navigation/ComboInput with domain-owned upload, history, and feedback surfaces. The outer WinBox is non-modal and separately owned. Nested controls inside history rows and the audio preview make a naive parent key handler unsafe.

## Goals / Non-Goals

- Goals:
  - Give every existing Music Analyzer action/state one stable localized programmatic meaning.
  - Provide keyboard parity for upload and history selection without double activation.
  - Announce terminal errors and meaningful progress/success changes.
  - Meet compact touch sizing while preserving current visual hierarchy.
- Non-Goals:
  - Change outer WinBox focus/Escape/geometry, add a focus trap, redesign pages, change generated content, or add new upload/generation capabilities.
  - Change task/record/cache/provider/model/analytics schemas.
  - Duplicate the shared ComboInput implementation.

## Decisions

- Add optional localized labels/state props to shared WorkflowNavBar and use the same contract coordinated with comic/MV callers.
- Express scratch/reference mode with `aria-pressed` or a native radio-group-equivalent contract while keeping the same two buttons and callbacks.
- Render a named keyboard-operable upload trigger outside nested audio/clear controls. Enter/Space invokes the same hidden file chooser once; drag/drop remains on the visual zone.
- Give selectable history rows button-equivalent role/tab stop and Enter/Space activation. Ignore bubbled activation from button, audio, link, input, select, textarea, or other interactive descendants.
- Add localized names and pressed/expanded state to row favorite/expand controls without including prompt, lyrics, filename, URL, task ID, or provider error in accessible names.
- Use `role=alert` for terminal errors and a polite status region for progress/success. Coalesce unchanged values and do not announce simulated progress more often than its existing visible changes.
- Apply 44×44 minimum hit boxes only under the current compact/pointer-coarse boundary when desktop geometry would otherwise change.
- Consume the shared ComboInput combobox/listbox/option contract once its owner change is approved; this change supplies labels/caller tests only.

## Invariants

- Pointer click/drop and keyboard activation choose the same file/record exactly once.
- Nested audio/favorite/expand/delete/task controls never select the parent row accidentally.
- Visible labels, counts, values, task creation, record selection, model choice, and storage remain unchanged.
- Multiple windows create no duplicate IDs or cross-window active-descendant references.

## Risks / Trade-offs

- Space can scroll or double-activate a row.
  - Prevent default only on the focused row/trigger and test one callback.
- File chooser cannot be opened in synthetic unit environments.
  - Assert the hidden input click and verify real browser keyboard flow without uploading private files.
- Progress announcements can become noisy.
  - Use polite status, meaningful text changes, and test no duplicate announcement for identical text.
- Shared navigation/ComboInput changes can conflict with pending F-16/F-18 proposals.
  - Implement optional primitives once and gate each domain caller by its approved change.

## Verification And Rollback

- Component tests: localized names, mode pressed state, upload Enter/Space/click/drop, history pointer/keyboard parity, nested controls, alert/status behavior, multiple instances, privacy-safe names.
- Browser: desktop/tablet/mobile, light/dark, Chinese/English, 100%/200%, keyboard/focus, reduced motion, empty/loading/success/failure/cancel/retry/history states.
- Record control rectangles and same-state screenshots; no visual-improvement claim without before/after evidence.
- Roll back domain call sites/styles/tests; no schema, cache, task, or user-data action.

