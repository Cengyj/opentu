# Change: Improve Task Queue Responsive Accessibility

## Why

The reachable task queue is opened from a named native toolbar button, but the opened surface and many of its existing operations lose programmatic identity or keyboard reachability. A controlled current-source Chromium run at 1280×720 found an unnamed drawer root, an unnamed close button, five unnamed icon type filters, pointer-only status tabs, unnamed selection checkboxes, and an unnamed task delete action. Opening the drawer left focus on the toolbar trigger; the drawer's focusable controls occur earlier in document order, and `TaskQueuePanel` explicitly disables the shared Escape close path.

A real 320×568 responsive sample also measured a 366 CSS px filter row inside 296 CSS px of available width. The existing “多选” action occupied `x=310..378` and was clipped by the 320 CSS px drawer. At 390×844, the same row fit. A controlled real-component render additionally confirmed that download, edit, and delete actions, clickable preview/error-detail affordances, task selection, and processing progress currently lack the corresponding accessible semantics.

Correcting focus, keyboard, screen-reader, localization, touch-target, and compact-layout behavior is user-observable and requires approval before implementation.

## What Changes

- Expose the existing task trigger as a disclosure control and the opened queue as a named non-modal task surface, with deterministic initial focus, Escape handling, nested-overlay precedence, and focus restoration.
- Make status tabs, type filters, task selection, preview, error details, and every existing task action identifiable and operable by keyboard and assistive technology while preserving callbacks and filter results.
- Expose processing progress and lifecycle changes with bounded semantics that do not announce every visual animation frame.
- Keep every existing queue filter/action inside 320 px and wider compact drawers, make hidden status tabs reachable without a pointer-only scroll affordance, and meet the project's 44×44 CSS px compact touch-target convention.
- Render application-owned task-queue labels, status, actions, empty/loading/error/confirmation copy, tooltips, and accessible names through the existing Chinese/English language boundary. Stored prompts, result titles, provider/model values, error payloads, and task records remain unchanged.
- Add focused component, accessibility-tree, responsive geometry, localization, and visual regression coverage.

## Impact

- Affected specs: `task-queue-interface-accessibility` (new delta)
- Affected code: task toolbar entry/ARIA passthrough, `TaskQueuePanel`, `TaskItem`, `TaskProgressOverlay`, `VirtualTaskList`, `ArchivedTaskList`, task-specific `SideDrawer` opt-in semantics/focus, task queue styles, i18n keys, and focused tests
- Related active changes: `fix-task-queue-external-cancellation` owns cancel propagation and late writes; `enforce-task-queue-concurrency-limit` owns scheduling; `persist-github-synced-task-history` owns durable sync; `add-suno-lyrics-task-and-canvas-flow` owns lyrics result actions; `sanitize-suno-provider-error-feedback` and diagnostic changes own safe error content; `fix-mobile-toolbar-input-overlap` owns the closed canvas shell; `update-ui-color-system` owns palette tokens
- Data/API impact: no task, cache, board, IndexedDB, localStorage, Service Worker, provider, workflow, or migration schema change; a backward-compatible optional component-ARIA prop may be added only where the task surface requires it
- Rollback: remove the task-specific semantics/focus/localization/responsive rules and focused tests together; task records and user data remain compatible

## Evidence

- Live entry chain: `drawnix.tsx:340,510-526,1625-1632` → `unified-toolbar.tsx:23-27,449-457,564-573` → `bottom-actions-section.tsx:144-165` → `TaskQueuePanel.tsx:1250-1330`.
- `SideDrawer.tsx:229-275` renders an unlabeled `div` root and close icon button; only the pin action at `:243-252` has an explicit name. `TaskQueuePanel.tsx:1250-1267` passes `closeOnEsc={false}`.
- `TaskQueuePanel.tsx:1011-1023` renders status tabs; current Chromium DOM reports no `role`, `aria-selected`, or sequential tab stop on all five items. `:1029-1118` renders six type-filter buttons; five icon-only actions have empty names and the active state is CSS-only. `:1173-1188` renders the unnamed select-all checkbox.
- `TaskItem.tsx:522-556,828-842,848-934,975-1001` contains the row/preview, visual progress, icon actions, and pointer-only error details. The temporary real-component diagnostic reported zero progressbars/live regions and confirmed unnamed download/edit/delete plus unnamed task selection; it exited 0, 1/1 test, and was removed after recording evidence.
- At 1280×720, opening the drawer leaves `document.activeElement` on `data-testid="toolbar-tasks"`; the trigger is focus-order index 27 while the first twelve drawer controls occur earlier. The next four focusable elements after the trigger belong to the AI input, not the task drawer.
- At 320×568, `.task-queue-panel__filters` measures `x=12,w=296,scrollWidth=366`; the “多选” button measures `x=310,w=68,right=378`. Screenshot and raw values are recorded in `docs/evidence/f10-task-queue-accessibility/`.
- Every reachable task-queue/side-drawer label except the removed unreachable legacy `TaskToolbarButton` is a Chinese literal and the live files do not consume `useI18n`; therefore changing the application's existing language state cannot change that copy.

## Approval

Implementation is blocked until the user approves the task-surface focus/Escape contract, semantic/filter/progress announcements, localized copy boundary, and compact layout/touch-target changes.
