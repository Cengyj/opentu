# Change: Improve media preview accessibility

## Why

The reachable full-screen media preview is visually modal, but its root has no dialog semantics, initial focus, focus containment, or focus restoration. Several icon-only actions and every thumbnail selector also lack an accessible name or current/slot state, while mobile controls shrink to 26–28 px and motion has no reduced-motion override.

## What Changes

- Expose the full-screen viewer as a labelled modal dialog and manage focus for open, keyboard traversal, Escape close, and return to the invoking control.
- Give every icon-only action and thumbnail selector a localized accessible name and expose toggle/current/slot state where applicable.
- Keep interactive targets usable on touch viewports without changing media rendering or editing results.
- Respect reduced-motion preferences for viewer, toolbar, thumbnail, and prompt transitions.
- Reuse the shared `HoverTip` / `HoverCard` layer from `refactor-hover-tip-unification`; do not add another tooltip implementation.

## Impact

- Affected specs: `media-preview`
- Affected code: `packages/drawnix/src/components/shared/media-preview/*`, media preview callers that provide the return-focus target, i18n resources, targeted accessibility and responsive tests.
- Related active change: `refactor-hover-tip-unification` overlaps the same component directory but owns visual hover feedback, not dialog, focus, accessible-name, or touch-target semantics.
