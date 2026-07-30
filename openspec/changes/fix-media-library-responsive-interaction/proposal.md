# Change: Keep the media library operable on narrow viewports

## Why

The reachable media-library window keeps a hard `minWidth` of 800 px while the component already switches to a mobile layout at 768 px. In an in-app Chromium run at the current source, light theme, 100% zoom, and a `390×844` viewport, a direct open produced a WinBox rectangle of `left=29, right=829, width=800`; the viewport right edge was 390 px. The upload action occupied `left=781..817`, entirely outside the viewport. The window title controls and the right side of the grid were visibly clipped in `docs/evidence/f13-media-library/mobile-overflow-390x844.jpg`.

The component also renders a bottom `Drawer` for mobile details, but no reachable code sets `showMobileInspector` to `true`. A controlled image fixture showed the desktop inspector actions, then showed no drawer, download, delete, or subject action after switching the same page to `390×844` and selecting the same asset. The selection handler says a details button should open that drawer, but no such action is rendered.

Both changes are user-observable responsive and interaction semantics, so implementation requires approval.

## What Changes

- Opt the media-library WinBox into a viewport constraint that keeps its title controls and content rectangle inside supported narrow viewports on cold open, resize, and orientation change.
- Keep the existing 85% desktop geometry and 800×500 desktop minimum when the viewport can contain them; reduce only the effective compact minimum and fit the window within a small viewport budget.
- Keep the existing mobile grid selection behavior and expose an explicit, accessible details action for the selected asset; activating it opens the already-rendered bottom inspector drawer.
- Preserve selection mode, batch selection, upload, filtering, preview, inspector actions, mounted content, asset records, Cache API keys, board data, and desktop inspector behavior.
- Add deterministic window/interaction tests and responsive browser evidence at desktop, tablet, portrait mobile, and landscape mobile sizes.

## Impact

- Affected specs: `media-library`
- Affected code: `packages/drawnix/src/components/media-library/MediaLibraryModal.tsx`, `MediaLibraryModal.scss`, the media grid/card action boundary, `WinBoxWindow.tsx` only if the shared opt-in constraint is reused, focused tests, and responsive E2E coverage
- Shared-file conflict: `fix-tool-window-viewport-transition` proposes the same kind of opt-in wrapper primitive for toolbox windows, but its behavior is enabled only by `ToolWinBoxManager`. This change separately opts in the media library and does not broaden the toolbox requirement. If both are approved, the generic wrapper primitive must be implemented once while each caller keeps an independent opt-in and regression suite.
- Non-conflicts: `improve-media-preview-accessibility` and `improve-media-editor-save-recovery` cover the full-screen media viewer/editor, not the media-library WinBox, grid, or inspector drawer.
- Preserved data/API semantics: no asset/task schema, localForage record, Cache API key, board element, provider request, filter persistence format, or analytics schema changes
- Rollback: remove the media-library viewport opt-in/details action and their tests; no migration, cache deletion, or user-data cleanup is required

## Evidence

- `packages/drawnix/src/components/media-library/MediaLibraryModal.tsx:343-363` passes `width="85%"`, `height="85%"`, `minWidth={800}`, and `minHeight={500}` to the shared WinBox.
- `packages/drawnix/src/components/media-library/MediaLibraryModal.tsx:96-106` changes to mobile layout at 768 px but does not change the WinBox constraints.
- `packages/drawnix/src/components/media-library/MediaLibraryModal.tsx:53,108-121,416-443` owns the mobile drawer state and close path; repository search finds no `setShowMobileInspector(true)` writer.
- `packages/drawnix/src/components/winbox/WinBoxWindow.tsx:1210-1235` can resize numeric dimensions and minima but does not reposition an out-of-bounds media-library window.
- Runtime geometry at `390×844`: window `29..829×64..781`; upload action `781..817×122..158`; `document.documentElement.scrollWidth=390`.
- Runtime screenshot: `docs/evidence/f13-media-library/mobile-overflow-390x844.jpg`.
