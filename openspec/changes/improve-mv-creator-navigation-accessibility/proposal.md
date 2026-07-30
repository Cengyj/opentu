# Change: Make MV Creator Navigation And Selectable Rows Accessible

## Why

The reachable MV workflow navigation exposes literal English names `history` and `starred` while the Chinese UI is active, and its history back action exposes only the symbol `←`. In a controlled Chromium sample, these were the actual accessible names.

The Analyze page renders completed music clips as generic `div` elements with pointer `onClick`, and History renders records the same way. Neither row has a button/link role, tab stop, or Enter/Space handler. Native audio controls and row action buttons are nested inside these pointer rows, so keyboard activation and event precedence need an explicit contract.

Localized names and keyboard-equivalent row activation change user-observable behavior, so implementation requires approval.

## What Changes

- Give the MV caller localized accessible names for history, favorites, and history-back navigation while preserving visible icons, counts, callbacks, and layout.
- Make selectable music-clip and history-record rows focusable and activatable with Enter/Space exactly once.
- Keep nested audio playback, expand, favorite, delete, and confirm actions independent so activating them does not also select the parent row.
- Preserve music discovery, clip identity, record selection, task grouping, storage, generation, routing, analytics payloads, and visible layout.

## Impact

- Affected specs: `video-mv-workflow-parity`
- Affected code: MV Analyze/History call sites, optional shared `WorkflowNavBar` localized-name props, focused tests
- Related changes:
  - `improve-video-workflow-form-accessibility` owns MV form fields and shared editable combos, not workflow navigation or selectable rows.
  - `improve-tool-window-accessibility` owns the outer WinBox dialog/title/focus/Escape lifecycle.
  - `improve-comic-creator-responsive-accessibility` proposes compatible optional shared navigation-name props for F-16; implementations must reuse one contract rather than add competing props.
- Preserved data/API semantics: no record/task/cache/provider/schema/migration or visible-layout change

## Evidence

- Browser: current Vite source, in-app Chromium, Chinese light theme, `1280×720`, DPR 1.
- Runtime accessible names: history action `history`, favorite action `starred`, history back action `←`; raw evidence in `docs/evidence/f18-mv-creator/metrics.json`.
- `packages/drawnix/src/components/shared/workflow/WorkflowNavBar.tsx:32-79` supplies the literal names.
- `packages/drawnix/src/components/mv-creator/pages/AnalyzePage.tsx:423-449` renders music clip rows as generic pointer-only containers with nested audio controls.
- `packages/drawnix/src/components/mv-creator/pages/HistoryPage.tsx:162-260` renders selectable record rows as generic pointer-only containers with nested favorite, expand, and delete buttons.

