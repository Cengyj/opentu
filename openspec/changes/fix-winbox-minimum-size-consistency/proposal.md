# Change: Fix WinBox minimum-size and restore consistency

## Why

The shared `WinBoxWindow` accepts percentage dimensions together with minimum dimensions, but the current third-party/wrapper handoff can keep two different normal sizes for one window. WinBox stores the raw percentage result before applying the minimum; a later wrapper effect can enlarge only the rendered rectangle while the instance retains the smaller value. Maximize/restore then returns to that retained under-minimum size. Lazy first load and already-cached construction also execute the wrapper constraint effect differently.

Current production Chromium at 1280×720 reproduced this across existing user functions:

- Settings declares `height="88%"` and `minHeight={680}`. Three clean open/maximize/restore cycles produced `634→634`, `680→634`, and `680→634` CSS px. Cold and subsequent opens therefore differ, and a restored hot-open window loses 46 px.
- AI image generation declares `height="60%"` and `minHeight={500}`. It opened at 500 px and restored from maximize at 432 px.
- AI video generation declares `height="60%"` and `minHeight={600}`. It opened at 600 px and restored at 432 px. Its initial top remained calculated for 432 px (`y=144`), so the 600 px rendered rectangle ended at `y=744`, 24 px below the 720 px viewport.

These dimensions contradict the existing `minHeight` prop contract and normal maximize/restore behavior. Fixing a shared geometry boundary changes visible loading and restore behavior across multiple existing surfaces, so it requires an independent approval before implementation.

## What Changes

- Normalize the shared WinBox instance's stored normal dimensions and rendered rectangle to the same effective current minimum/maximum constraints immediately after construction, regardless of lazy-load cache state.
- Reapply caller-requested initial placement against the effective normalized dimensions so existing centered windows center their final rectangle rather than the raw under-minimum percentage.
- Keep maximize/restore at the same normalized normal rectangle until the user or an existing caller intentionally changes it.
- Apply the same normalization when current wrapper dimension/minimum props change, without overriding split mode or an intentional user/caller size.
- Preserve caller-declared percentages/minimums, current viewport maximum behavior, user resizing, split/restore, keep-alive, auto-maximize, pointer callbacks, content state, and all feature/data operations.
- Do not patch third-party source or fold feature-specific responsive behavior into this change.

## Impact

- Affected specs: `winbox-size-constraints` (new delta capability)
- Affected code: `packages/drawnix/src/components/winbox/WinBoxWindow.tsx`, a small pure constraint-normalization helper if tests justify it, focused shared-wrapper tests, and existing Settings/image/video browser verification
- Confirmed callers: F-26 Settings, F-08 AI image generation, and F-08 AI video generation at 1280×720
- Current negative/adjacent boundaries:
  - Media Library's 85% height is above its 500 px minimum at this measured viewport; its compact/viewport behavior remains `fix-media-library-responsive-interaction`.
  - Numeric toolbox and Prompt Optimize dimensions do not enter the measured percentage-below-minimum path; tool viewport transitions remain `fix-tool-window-viewport-transition`.
  - `fix-generation-dialog-maximized-viewport-resize` retains viewport resize/orientation behavior while already maximized; this change owns only one current-viewport normal-size constraint and maximize/restore consistency.
  - `improve-settings-surface-accessibility` and `improve-tool-window-accessibility` retain semantics/focus/title controls, not geometry.
- Data/network impact: none; no board, settings, provider, task, cache, storage, analytics, API, or migration format changes
- Rollback: remove the shared normalization and focused tests; prior inconsistent geometry returns, with no stored-data or cache recovery

## Evidence

- `packages/drawnix/src/components/winbox/WinBoxWindow.tsx:60-139,148-184` exposes `width`, `height`, `minWidth`, and `minHeight` as the shared wrapper contract.
- `WinBoxWindow.tsx:212-213,520-525,548-550` starts with `winboxLoaded=false` on the first dynamic load. The later constraint effect does not depend on `winboxLoaded` or readiness, so its first returned execution is not rerun when construction becomes possible.
- `WinBoxWindow.tsx:607-624,933-940` constructs WinBox from percentage/minimum props and immediately saves WinBox's raw normal `width/height`.
- `WinBoxWindow.tsx:1210-1235` later sets `minwidth/minheight` and calls `resize(nextWidth,nextHeight)`, but when the percentage result is below the minimum it does not synchronize the instance to the effective clamped local output.
- Read-only third-party source explains the state split: `node_modules/winbox/src/js/winbox.js:229-257` stores non-autosize percentage height without minimum clamping; `:1265-1284` stores the requested under-minimum height before clamping only its local rendered `h`; `:1071-1089` restore calls no-argument `resize()`, which reuses the stored under-minimum height. No third-party file will be modified.
- Settings caller: `settings-dialog.tsx:3176-3202` (`88%`, minimum 1080×680, centered).
- Generation callers: `ttd-dialog.tsx:724-785,840-855` (image `80%×60%`, minimum 800×500; video `70%×60%`, minimum 800×600; centered).
- Production raw rectangles and environment are recorded in `docs/evidence/f26-settings-toolbar/metrics.json` and diagnostics. No provider credential/request, task submission, setting mutation, or browser-storage read was used.

## Approval

Implementation is blocked until the user approves shared cold/warm initial-size normalization, effective centered placement, and maximize/restore consistency for existing WinBox callers.
