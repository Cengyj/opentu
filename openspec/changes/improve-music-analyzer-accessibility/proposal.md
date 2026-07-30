# Change: Make Music Analyzer Content Keyboard And Screen-Reader Operable

## Why

The reachable Music Analyzer exposes English accessible names `history` and `starred` in the Chinese UI, and the history back action is only `←`. The current creation mode is expressed only by an `active` CSS class. Error/progress messages render as generic `div` elements with no live-region semantics.

Reference-audio mode renders a pointer `div` dropzone and a hidden file input with no label, ID, or keyboard trigger. History records are pointer-only generic `div` rows with nested favorite/expand/delete controls. Live DOM inspection confirmed the upload input has a 0×0 rect and no name/label, while the dropzone has no role or tab stop. The visible history/favorite buttons measured 40×32 CSS px at desktop, below the 44×44 compact touch target used by the project's existing responsive requirements.

The shared `ComboInput` used by Music Brief is already covered by `improve-video-workflow-form-accessibility`; this change adds the Music Analyzer caller/acceptance contract and must reuse one implementation. The outer WinBox dialog/title/focus and viewport fitting remain owned by the two F-15 changes.

Names, keyboard activation, live announcements, state semantics, and touch hit areas are user-observable and require approval.

## What Changes

- Supply localized accessible names for Music Analyzer history, favorites, history back, favorite-row, and icon actions through the shared workflow navigation contract.
- Expose scratch/reference mode and other existing toggle-like selections with programmatic selected/pressed state.
- Make the existing upload action keyboard-operable and named while preserving click, drag/drop, accepted file types, preview, clear, and analysis behavior.
- Make history record selection button-equivalent with Enter/Space while nested favorite/expand/delete/task actions remain independent.
- Announce errors as alerts and non-urgent progress/success as status without repeating every unchanged render.
- Reuse the approved shared editable-combobox behavior for Music Brief and add Music-specific caller tests.
- Keep compact primary navigation/action hit areas at least 44×44 CSS px without redesigning desktop layout.

## Impact

- Affected specs: `audio-generation`
- Affected code: Music Analyzer pages/styles/tests, shared WorkflowNavBar optional labels, shared ComboInput caller tests/localization
- Related changes: `improve-tool-window-accessibility` owns the outer dialog/title controls/focus/Escape; `fix-tool-window-viewport-transition` owns the clipped mobile window; `improve-video-workflow-form-accessibility` owns the one shared ComboInput implementation
- Preserved data/API semantics: no task, record, cache, provider, model preference, canvas insertion, analytics, or visible product capability change
- Rollback: remove Music caller labels/state/keyboard/live-region/touch styles and tests; shared optional props remain backward compatible, with no data cleanup

## Evidence

- Runtime accessibility snapshot: main actions expose `history` and `starred`; history back exposes `←`.
- Runtime DOM: no `[aria-live]`, `role=status`, or `role=alert` exists in the open tool.
- `CreatePage.tsx:692-732` implements the upload action as pointer `div` plus hidden unlabeled input.
- `WorkflowNavBar.tsx:32-79` hard-codes the English icon names and symbol-only back action.
- `HistoryPage.tsx:203-255` makes each record a pointer-only generic row with nested interactive controls.
- `CreatePage.tsx:843-850`, `LyricsPage.tsx:455-497`, and `GeneratePage.tsx:596` render changing feedback without announcement semantics.
- Raw geometry/DOM and screenshots: `docs/evidence/f20-music-analyzer/metrics.json` and sibling PNG files.

