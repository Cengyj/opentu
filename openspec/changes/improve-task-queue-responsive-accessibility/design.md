## Context

The task queue is a persistent non-modal drawer mounted before the unified toolbar in DOM order after its first open. The trigger is a named native `ToolButton`, while the queue root is a generic `div`. The panel reuses TDesign buttons, tabs, checkboxes, and hover tips, but the rendered accessibility tree shows that hover text does not name icon-only controls, TDesign's current tabs are not exposed as tabs or sequential focus stops, and checkbox labels are empty. Task lifecycle state flows from the task service through RxJS/Jotai into the panel, but the visual progress surfaces do not expose `progressbar` or bounded live-status semantics.

At 320 CSS px, the no-wrap type-filter/search/action row preserves its 366 px content width and clips the trailing multi-select action. At 390 px it fits. Task-queue copy is hard-coded Chinese even though the reachable toolbar and application already own a `zh`/`en` context.

## Goals / Non-Goals

- Goals: named task disclosure/surface; deterministic open/close focus; nested-overlay-safe Escape; semantic keyboard status/type filters; named task actions/selection/preview/details; useful non-noisy lifecycle/progress semantics; 320 px fit; 44×44 compact touch targets; Chinese/English application copy; focused regression evidence.
- Non-Goals: no task scheduling, concurrency, cancellation, retry, persistence, archive retention, GitHub sync, provider routing, error sanitization, media caching, workflow, result insertion, analytics taxonomy, palette redesign, new task action, new shortcut, modal focus trap, or performance claim.

## Decisions

- Keep the queue non-modal. Expose it as a labelled non-modal task dialog/surface, keep background operation available, and do not add a backdrop or focus trap.
- Add task-specific opt-in ARIA/focus hooks to the shared drawer primitive rather than silently changing every project/toolbox drawer. On open, focus the task heading (programmatically focusable, not a new tab stop), so the next Tab reaches header and queue controls in document order. On close, restore the exact toolbar invoker when it remains mounted.
- Add `aria-expanded` and `aria-controls` to the existing task trigger through a backward-compatible `ToolButton` ARIA passthrough. Keep its current name, badge, click callback, analytics attribute, and selected visual class.
- Close the queue on Escape only when no nested queue-owned viewer, editor, character dialog, or confirmation dialog owns Escape. A nested surface closes first; one keypress must not close both layers.
- Implement the visible status selector with the ARIA tabs pattern: one selected tab, roving tab stop, Left/Right/Home/End navigation, and a labelled task-list panel. The compact layout must not depend on TDesign's current pointer-only scroll arrow.
- Keep type filters as native buttons and expose the active filter with `aria-pressed`; names include the localized type and visible count. Do not include provider, model, prompt, URL, task ID, or error body in filter names.
- Give existing icon-only actions localized operation names directly on their controls. Hover tips remain supplementary. Selection checkboxes are associated with the visible row context; select-all is associated with the visible selected/total summary.
- Render a native button only for previews that already invoke `onPreviewOpen`; non-actionable placeholders remain non-interactive. Render error details as a named keyboard control without copying raw error content into its accessible name. Error-content safety remains owned by the existing sanitization changes.
- Expose one determinate `progressbar` per processing task using the clamped current value and localized status. Visual duplicate bars are hidden from assistive technology. Announce terminal lifecycle changes politely and atomically, but do not place percentage animation or every poll update in a live region.
- At compact widths, wrap the type controls and search/action group into available rows rather than shrinking or translating actions outside the drawer. Use at least 44×44 CSS px interactive boxes for compact header, type, task, and navigation actions while keeping desktop density unchanged.
- Move application-owned visible copy and accessible names into the existing typed `zh`/`en` translation source. User-authored prompt/title, provider/model names, URLs, IDs, raw errors, task/result data, cache keys, and persisted records are never translated or rewritten.

## Invariants

- Filter membership, counts, search matching, selection set, callbacks, confirmation requirements, cancel/retry/delete/insert/download/edit/regenerate behavior, and archive pagination remain unchanged.
- Task status ownership stays in the task service/RxJS/Jotai chain. The UI does not create a second state machine or persistence writer.
- Nested preview/editor/dialog Escape behavior takes precedence over the outer queue; background remains usable because the queue is non-modal.
- No task/result/error payload is added to analytics, logs, storage, accessible action names, or DOM attributes beyond content already intentionally rendered.
- Desktop/tablet drawer width persistence, pin behavior, toolbar docking, current theme tokens, z-index, cache-warning logic, and media rendering remain unchanged.

## Alternatives Considered

- Treat HoverTip text as the accessible name: rejected by the current rendered accessibility tree.
- Keep focus on the trigger and rely on Tab: rejected because current drawer controls precede the trigger in document order; the next focus targets belong to the AI input.
- Add a modal focus trap/backdrop: rejected because the current queue is intentionally non-modal and users can continue working on the canvas.
- Enable the shared Escape handler unconditionally: rejected because queue-owned nested dialogs/viewers could close together with the drawer.
- Hide or shorten existing controls at 320 px: rejected because it would remove or obscure current capability. Wrapping preserves operations.
- Shrink controls below their current sizes: rejected because it worsens touch operation and conflicts with the project's 44×44 compact convention.
- Translate task records or provider/result content: rejected because it changes user data and durable semantics instead of interface copy.

## Risks / Trade-offs

- Focus timing can race lazy mount/close animation. Tests must use the existing mount/transition boundary and restore focus only after close state commits.
- Nested portals may consume Escape outside the task drawer DOM. Ownership must use queue state, not only `event.target.closest()`.
- Live regions can become noisy for many concurrent tasks. Only terminal/status transitions are live; percentage changes remain queryable progressbar state.
- Two-row compact controls increase the filter section height and reduce list viewport height. 320×568 visual and scroll tests must prove all controls and list content remain reachable.
- Long English labels can widen actions. Compact screenshots and overflow measurements must cover English as well as Chinese.
- `ToolButton` is shared with active settings-toolbar work. The implementation must rebase the optional ARIA passthrough without changing submenu keyboard ownership.
- `TaskItem` is also touched by lyrics/cancellation/error changes. Semantic wrappers and names must not change action availability or error content.

## Verification And Rollback

- Component tests: disclosure state/control relationship; named non-modal surface; open/close/nested Escape/focus restoration; tab roving; type-filter pressed state; checkbox associations; every action name; preview/details keyboard activation; progress values; terminal announcement count; zh/en copy and privacy sentinels.
- Browser checks: 1280×720, 768×1024, 390×844, 320×568, and 568×320; Chinese/English; light/dark; pointer and keyboard; 100% and 200% zoom; compact target rectangles; slow/loading, empty, success, processing, failed, cancelled, retry, archived, long text, broken media, and nested overlays.
- Geometry acceptance at 320 px: every visible action rectangle is inside `x=0..320`, filter section `scrollWidth <= clientWidth` unless an explicitly keyboard-operable tab scroller owns overflow, and no action is clipped.
- Same-state before/after screenshots document intentional compact spacing only; desktop/tablet negative controls must show no unintended geometry/color delta.
- Run focused tests/lint/typecheck, then full typecheck/tests/cycles/build/size/startup and available smoke/feature/visual/responsive E2E against the recorded baseline. No speed/memory/bundle claim is made without a separate five-sample measurement.
- Rollback removes task-specific ARIA/focus handlers, localization keys/usages, compact rules, and tests. It does not delete, migrate, or rewrite task/user data.
