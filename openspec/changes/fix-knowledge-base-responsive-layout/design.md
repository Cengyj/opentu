# Design: Knowledge-base compact layout

## Ownership and conflicts

The outer path is knowledge-base manifest → `toolWindowService` → `ToolWinBoxManager` → opt-in `WinBoxWindow` constraint. The inner path is `KnowledgeBaseContent` → tree/editor/right-panel panes. The generic window constraint remains owned by `fix-tool-window-viewport-transition`; this change only opts in the knowledge-base caller and owns the inner compact state.

If the shared primitive is not yet approved, inner component work may be tested in a bounded container but must not ship alone as a claim that the tool fits the viewport. No global WinBox rule is permitted.

## Decisions

- Derive compact mode from the knowledge-base container width with `ResizeObserver`, not only global device labels, because users can manually resize the tool on desktop.
- Reuse the existing tree, editor, related, and extraction subtrees. Compact pane changes alter visibility/layout, not keys or mounted identity, so editor drafts, scroll, selection, and async requests remain owned by their current components.
- Default to the tree when no note is selected. Selecting a real or virtual note activates the editor pane. Provide named Back/Notes and Details actions with deterministic focus return; Escape closes only a transient compact pane/menu according to the existing tool-window hierarchy and does not close the note unexpectedly.
- Present related/extraction as the existing details pane in compact mode. Returning to editor preserves the selected right-sidebar tab.
- Ignore saved desktop sidebar widths while compact, but retain them unchanged in localStorage and restore them when the container expands. Compact layout changes must not invoke desktop resize persistence handlers.
- Keep the desktop three-column layout, resizers, collapse control, default widths, and visual tokens unchanged above the approved breakpoint.

## Alternatives rejected

- Horizontal scrolling across the 982 px layout: primary edit actions remain undiscoverable and keyboard/touch navigation is inefficient.
- Permanently hide both sidebars on mobile: users cannot choose another note or reach related/extraction.
- Shrink all three panes into 390 px: the editor and tree become unusably narrow and touch targets/text overflow cannot be satisfied.
- Remount the editor on every pane switch: risks draft, Milkdown, media, and focus loss.
- Apply responsive behavior to every WinBox: conflicts with independent tool/dialog semantics and existing pending changes.

## Accessibility, visual, and performance verification

- Compact navigation controls have semantic names, visible focus, keyboard activation, at least 44×44 CSS px touch targets, and theme-token colors. Pane state is conveyed with existing heading/tab/button semantics rather than color alone.
- Verify initial, empty, loading, success, save failure/retry, no-match search, long title/body, missing media, read-only Skill, and details states at 320×568, 390×844, 844×390, tablet, and desktop in light/dark themes.
- Record viewport, WinBox/control, container/pane/action DOMRects, scroll widths, active pane, selected note, editor mounted identity, desktop saved widths, focus target, and screenshots before/after at identical fixtures.
- Measure at least five cold opens and live transitions before/after, reporting event-to-stable-layout latency, React mount identity, resize event count, median/range, and any interaction cost. No speed claim is allowed without measurements.
- Run focused component/wrapper tests, Drawnix/full typecheck, full tests, cycles, build, size, startup, and available responsive/visual flows.

## Rollback

Remove the knowledge-base viewport opt-in, container observer, compact pane state/controls/styles, and tests. Desktop saved widths were never overwritten by automatic layout, so no preference migration is required.
