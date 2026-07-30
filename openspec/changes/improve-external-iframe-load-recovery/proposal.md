# Change: Improve External Iframe Load Recovery

## Why

The WinBox path renders external iframe tools directly with no loading, slow-load, error, or retry state. In a 1280×720 Chromium run, Banana Prompt rendered usable content within the first 3-second check, while Pose Library remained a completely blank 900×652 content area at that check and rendered usable content only after the later 10-second wait. This is one observed UX run, not a five-sample performance claim; it proves that a reachable existing tool can leave the user without state feedback for at least three seconds.

The canvas path creates “加载中...” and “加载失败” text, but the status node has `z-index: 1` while the absolute white iframe has `z-index: 10`; the iframe deterministically covers both states. Its `onerror` branch only changes that covered text and supplies no retry. Browser iframe failures are not reliably classifiable across origins, CSP, or `X-Frame-Options`, so recovery cannot depend only on `onerror`.

Adding visible progress, slow-load and retry behavior changes user-observable iframe lifecycle semantics and requires approval.

## What Changes

- Show a localized, visually and programmatically exposed loading state above external iframe content in both WinBox and canvas rendering paths.
- Replace loading with the iframe only after its load signal; show an error state when an error signal is available.
- If loading has not completed within a bounded threshold, show “still loading” guidance and an explicit retry without declaring a hard failure.
- Keep status/retry overlays above the iframe, keyboard-operable, responsive, and isolated per window/canvas instance.
- Retry the same safely resolved URL only after user activation; do not expose raw URLs, credentials, prompts, IDs, or third-party response data.
- Preserve successful iframe content, sandbox/feature permissions, tool geometry, window state, persistence, analytics schemas, and request count unless the user explicitly retries.

## Impact

- Affected specs: `toolbox-plugin-runtime`
- Affected code: ToolWinBoxManager external branch, canvas ToolGenerator iframe lifecycle, localized messages/styles, tests and documentation
- Related changes: `fix-tool-window-viewport-transition` owns outer geometry; `improve-tool-window-accessibility` owns outer dialog/title/focus; this change owns only external iframe content lifecycle feedback
- Performance claim: none; the change improves state visibility and recovery, not external network or remote rendering speed
- Rollback: remove iframe lifecycle state/timers/retry and restore direct rendering/current canvas handlers; no schema, cache, or user-data action is required

## Evidence

- Browser run, 2026-07-29, Chromium in-app Browser, 1280×720, local Vite app at port 7200, normal network/CPU: Banana Prompt loaded within the first 3-second check; Pose Library was blank at 3 seconds and usable after the later 10-second wait.
- `docs/evidence/f21-external-iframe-tools/pose-loading-blank-1280x720.png` and `pose-loaded-1280x720.png` record the two Pose states; `banana-loaded-1280x720.png` records Banana success.
- Direct headless Chromium `149.0.7827.55`, fresh isolated contexts, light/zh-CN/DPR1: Banana and Pose WinBoxes were fully inside 390×844 and 768×1024 viewports with no document overflow, but all four 3000 ms screenshots showed blank white iframe areas without Opentu lifecycle feedback. This extends the UX-state evidence and is not a speed benchmark.
- Responsive screenshots: `banana-mobile-390x844-before.png`, `pose-mobile-390x844-before.png`, `banana-tablet-768x1024-before.png`, and `pose-tablet-768x1024-before.png`; exact rectangles, file sizes and SHA-256 hashes are in `metrics.json`.
- Runtime iframe attributes: Banana `800×552`, Pose `900×652`; both used the declared sandbox and no WinBox `allow` attribute.
- `ToolWinBoxManager.tsx:399-427` provides Suspense loading only for internal React components and renders external iframes without lifecycle handlers.
- `tool.generator.ts:255-276,520-534,558-581` places the loader/error text below the white iframe and has no recovery action.
