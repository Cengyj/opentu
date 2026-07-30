## 1. Evidence and Approval

- [x] 1.1 Reproduce one live desktop tool window through `1280×720 → 390×844 → 320×568 → 1280×720` and retain raw window/control geometry.
- [x] 1.2 Verify a direct `320×568` cold open as the non-regressed control.
- [x] 1.3 Trace viewport events, manager sizing, wrapper minima/resize callbacks, WinBox geometry, and tool-window state persistence.
- [x] 1.4 Check active OpenSpec changes and isolate the non-maximized tool-window branch from `fix-generation-dialog-maximized-viewport-resize`.
- [x] 1.5 Reproduce the registered Music Analyzer at desktop, tablet, and compact mobile sizes and retain raw window/close geometry.
- [x] 1.6 Reproduce the auto-maximized Model Benchmark opening taller than a 1280×720 viewport and prove body/main/history expose no scroll range for the missing 140 CSS px.
- [ ] 1.7 Obtain user approval for ordinary and maximized tool-window viewport semantics.

## 2. Implementation (Approval Required)

- [ ] 2.1 Add failing wrapper tests for compact clamp, effective minima, repositioning, callback suppression, round-trip restoration, user interaction, and cleanup.
- [ ] 2.2 Add an opt-in, animation-frame-coalesced viewport constraint to `WinBoxWindow`.
- [ ] 2.3 Enable the option only for windows rendered by `ToolWinBoxManager`.
- [ ] 2.4 Keep hidden, minimized, maximized, split, destroyed, and non-tool WinBox consumers on their existing paths.
- [ ] 2.5 Preserve live internal/iframe content and do not add a storage field or migration.
- [ ] 2.6 Add the separate opted-in tool-maximized fit branch without changing generation-dialog or non-tool maximize semantics.

## 3. Verification

- [ ] 3.1 Run focused WinBox/manager and tool-window service tests with exact file/case counts and exit codes.
- [ ] 3.2 Verify internal and iframe tool windows, multiple instances, minimize/restore, close/reopen, split/maximize, and manual drag/resize.
- [ ] 3.3 Capture same-state before/after screenshots and geometry for desktop/mobile/orientation round trips.
- [ ] 3.4 Measure at least five viewport transitions before/after and record event-to-stable-geometry latency plus range/median.
- [ ] 3.5 Run Drawnix typecheck/lint and full typecheck/test/cycles/build/size/startup; compare every failure with the recorded baseline.
- [ ] 3.6 Run available toolbox smoke/feature/visual/responsive Playwright flows and classify the configured-browser blocker separately.
- [x] 3.7 Run OpenSpec strict validation; while the CLI is unavailable, record exit 127 and complete a manual format/name/conflict audit.
- [ ] 3.8 Verify auto-maximized Model Benchmark initial fit and viewport transitions at identical data/theme, including builder/history/result reachability.
