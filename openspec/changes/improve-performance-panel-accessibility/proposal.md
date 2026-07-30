# Change: Improve performance-panel accessibility

## Why

The delayed high-memory panel renders four icon-only action buttons inside visual HoverTips and a pointer-event `div` as its move handle. A controlled current-source component render found four buttons, but none had the localized visible purpose as an accessible name; the move handle had no role and `tabIndex -1`.

Correcting keyboard and assistive-technology behavior is user-observable and requires approval.

## What Changes

- Give create-project, refresh, pin/unpin, and close actions localized programmatic names.
- Expose pin state with a standard pressed state and expose create-project busy/disabled state without changing its callback.
- Convert the existing move handle into a semantic control that supports pointer drag plus bounded arrow-key movement.
- Keep focus visible and keep all keyboard movement clamped to the same viewport bounds used by pointer movement.
- Preserve panel thresholds, polling, actions/confirmation, visuals, HoverTips, layout, z-index, and persistence format.

## Impact

- Affected specs: `performance-panel-accessibility` (new delta)
- Affected code: PerformancePanel markup/keyboard handler/styles/i18n/tests
- Related changes: hover-tip unification owns visual tooltip implementation; color-system and startup changes own tokens/lazy timing; this change does not alter them
- Data/API impact: none; component props and `drawnix_performance_panel_settings` schema remain unchanged
- Rollback: remove semantics/keyboard handling/focused tests; persisted settings remain compatible

## Evidence

- `PerformancePanel.tsx:352-452` renders the drag `div` and icon-only buttons; HoverTip content is not a button label.
- Controlled jsdom render: 1 file/2 tests passed, exit 0; four icon buttons existed, zero were queryable by `新建项目`, `刷新页面`, `常驻`, or `关闭`; drag handle had no role and `tabIndex -1`.
- The feature is reachable after delayed enable at `drawnix.tsx:677-701` and lazy render at `DrawnixDeferredFeatures.tsx:206-213`.
- Full evidence: `docs/evidence/f27-diagnostics-observability/diagnostics.md`.

## Approval

Implementation is blocked until the user approves localized action semantics and arrow-key panel movement.
