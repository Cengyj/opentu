# Change: Keep Open Tool Windows Inside the Current Viewport

## Why

Tool windows are sized for the viewport only when `ToolWinBoxManager` renders their numeric width and height. A controlled desktop-to-mobile transition shows that an already-open non-maximized tool window does not retain that guarantee: the responsive manager requests a compact size, but `WinBoxWindow` reapplies its default `minWidth=400`, WinBox clamps the requested width back to 400 px, and no path repositions the window. The close control can therefore move completely outside the viewport.

In one in-app Chromium run at the current source, the Prompt History tool opened at `1280×720` with geometry `x=80, y=20, 1120×680`. After changing the same live page to `390×844`, its DOM window ended at `right=505.89` and its close control ended at `right=493.89`; after changing to `320×568`, the window remained `x=80, width=400` and the close control occupied `x=438..468`, entirely outside the 320 px viewport. Returning to `1280×720` left the window at `400×508` instead of restoring the pre-transition `1120×680` geometry. A direct cold open at `320×568` was the control sample and fit at `x=8, y=30, 304×508`.

The behavior change after a viewport transition is user-observable and changes responsive window recovery semantics, so implementation requires approval.

F-20 provides an additional registered internal-tool sample. At `1280×720`, the 520×700 Music Analyzer window occupied `x=124..644, y=162..862`, so its bottom 142 CSS px were outside the viewport. At `390×844`, a close/reopen in the same live mobile viewport produced `x=124..524`, only 266 CSS px visible; the close control occupied `x=482..512`, entirely outside the viewport. The document exposed no horizontal recovery path. At `768×1024` the same 520×700 rectangle fit, which isolates the failure to the compact constraint rather than the Music Analyzer content width.

F-22 adds a distinct auto-maximized tool-window sample that the original non-maximized wording did not own. The registered Model Benchmark asks for `1280×860` and its launcher passes `autoMaximize:true`. At a `1280×720` viewport, the rendered WinBox remained `0,0,1280×860`; its workbench root ended at `y=860`, while body/document scroll height stayed 720 and the main/history containers had no additional scroll range for the missing 140 CSS px. The tool is maximized, so this is not covered by the non-maximized branch or the generation-dialog-only maximized change.

## What Changes

- Opt tool windows into a viewport constraint that keeps visible non-minimized/non-split tool windows and their title-bar controls inside the current viewport, with separate branches for ordinary and maximized tool state.
- Allow the effective minimum window size to shrink below the desktop minimum only when the available compact viewport is smaller.
- Treat automatic viewport clamping as layout adaptation rather than a user resize, so it does not overwrite the user's pre-transition window geometry; restore that geometry when the viewport can contain it again.
- If the user manually moves or resizes a constrained compact window, adopt that user action instead of later restoring a stale pre-transition rectangle.
- Keep direct cold opens, manual drag/resize limits, minimized/maximized/split behavior, multi-instance state, tool content mounting, task execution, iframe sandboxing, persistence, and non-tool WinBox consumers unchanged.
- For a tool window already marked maximized or opened with auto-maximize, derive its rectangle from the current viewport instead of retaining manifest dimensions larger than that viewport; preserve the maximized state rather than converting it to a user resize.
- Add focused wrapper/manager tests and responsive browser coverage for desktop-to-mobile, mobile-to-desktop, and mobile orientation transitions.

## Impact

- Affected specs: `toolbox-plugin-runtime`
- Affected code: `packages/drawnix/src/components/toolbox-drawer/ToolWinBoxManager.tsx`, `packages/drawnix/src/components/winbox/WinBoxWindow.tsx`, focused tests, and responsive E2E coverage
- Shared-file conflict: `fix-generation-dialog-maximized-viewport-resize` also proposes a change in `WinBoxWindow.tsx`, but only for visible maximized generation dialogs; this change is opt-in for tool windows and must keep tool maximized/non-maximized branches independent from generation-dialog semantics
- Preserved data/API semantics: no tool definition schema, localForage record, localStorage pin preference, canvas element, task record, cache key, external request, or public model/provider contract changes
- Rollback: remove the opt-in viewport constraint and its tests; no migration or user-data cleanup is required

## Evidence

- `packages/drawnix/src/components/toolbox-drawer/ToolWinBoxManager.tsx:36-40,107-128` listens to viewport state and computes compact tool-window dimensions as viewport width minus 16 px and height minus 60 px.
- `packages/drawnix/src/components/toolbox-drawer/ToolWinBoxManager.tsx:362-393` passes those dimensions to the shared `WinBoxWindow`, but does not pass a compact minimum or a viewport-transition policy.
- `packages/drawnix/src/components/winbox/WinBoxWindow.tsx:148-179` defaults every caller to `minWidth=400` and `minHeight=300`.
- `packages/drawnix/src/components/winbox/WinBoxWindow.tsx:1210-1235` reapplies those minima before resizing when numeric width/height props change and does not move an out-of-bounds window.
- `packages/drawnix/src/components/winbox/WinBoxWindow.tsx:740-795` constrains only explicit WinBox `onmove` callbacks; a viewport change that leaves the existing position untouched does not enter this path.
- `packages/drawnix/src/hooks/useDeviceType.ts:118-152` confirms that the manager rerenders after `resize` and `orientationchange`; the failure is downstream of viewport detection.
- Runtime screenshots: `docs/evidence/f15-toolbox/viewport-transition-390x844.png`, `docs/evidence/f15-toolbox/viewport-transition-320x568.png`, and the cold-open control `docs/evidence/f15-toolbox/compact-window-320x568.png`.
- Additional caller evidence: `docs/evidence/f20-music-analyzer/desktop-1280x720.png`, `tablet-768x1024.png`, `mobile-390x844.png`, and raw rectangles in `metrics.json`.
- Auto-maximized caller evidence: `docs/evidence/f22-model-benchmark/workbench-empty-desktop-1280x720.png` and `metrics.json` record viewport 1280×720, WinBox 1280×860, root bottom 860, body/document height 720, and no internal 140 px recovery range.
