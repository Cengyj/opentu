# Change: Improve PPT Editor Accessibility

## Why

The reachable PPT panel and slideshow contain icon-only controls that appear as unnamed buttons in the current Chromium accessibility tree. The custom width/height inputs both expose the same generic input name, and slideshow controls can become visually transparent while remaining keyboard-focusable. Visual hover tips and adjacent `W`/`H` text do not establish programmatic names.

Adding names, selected-state semantics, and focus-visible control behavior changes assistive-technology-observable behavior and requires approval.

## What Changes

- Give existing PPT view, add, play, export, arrange, outline, and per-page icon actions localized accessible names reflecting current state/action.
- Programmatically label custom Frame width and height inputs and the custom-size add action.
- Name slideshow tools, pen colors, stroke styles, stroke widths, previous/next navigation, and exit guidance; expose current tool/option selection.
- Keep slideshow controls visible while keyboard focus is within them so a focused action is never visually hidden by the inactivity timer.
- Preserve visible geometry, pointer callbacks, shortcuts, deck data, generation, export, transitions, and storage behavior.

## Impact

- Affected specs: `ppt-editing`
- Affected code: `FramePanel.tsx`, `AddFrameDialog.tsx`, `FrameSlideshow.tsx`, localization values/props as needed, focused accessibility tests
- Visual/data impact: no intended resting-state geometry, theme, board, cache, task, PPT metadata, or migration change
- Rollback: remove names/state/focus-visibility handling and their tests; persisted decks remain untouched

## Evidence

- `packages/drawnix/src/components/project-drawer/FramePanel.tsx:3583-3680` uses `HoverTip` around icon-only TDesign buttons without button names or selected-state semantics.
- `packages/drawnix/src/components/project-drawer/AddFrameDialog.tsx:185-229` renders visual `W`/`H` spans without label association; both inputs expose the same generic placeholder-derived name.
- `packages/drawnix/src/components/project-drawer/FrameSlideshow.tsx:788-939` renders tool, color, style, width, and navigation buttons without accessible names or selected-state attributes.
- The slideshow control bar uses opacity for inactivity visibility, so focusability and visible focus can diverge.
- Controlled Chromium DOM/accessibility inspection at 1280×720 confirmed empty names for the PPT panel icon buttons; no external service or credential was used.

## Approval

Implementation is blocked until the user approves localized/state-aware control names, selected-state semantics, and keyboard-focus visibility behavior.
