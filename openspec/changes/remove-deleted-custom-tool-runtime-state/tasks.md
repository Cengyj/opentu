## 1. Evidence and Approval

- [x] 1.1 Trace custom-tool deletion through catalog, windows, toolbar, pins, and canvas representations.
- [x] 1.2 Reproduce a stale pinned launcher after successful deletion.
- [x] 1.3 Confirm board elements and storage schemas need not change.
- [ ] 1.4 Obtain user approval for window closure, pin cleanup, and transient canvas-derived windows.

## 2. Implementation (approval required)

- [ ] 2.1 Add failing service/component tests for successful delete cleanup and cancel/failure isolation.
- [ ] 2.2 Add failing multi-instance/open/minimized/pinned/launcher/localStorage tests.
- [ ] 2.3 Add failing canvas-preservation and transient non-pinnable window tests.
- [ ] 2.4 Implement tool-ID runtime cleanup and invoke it only after durable custom-tool deletion.
- [ ] 2.5 Remove deleted pin metadata/preferences and gate persistent pinning on current catalog/registry membership.
- [ ] 2.6 Preserve existing board/tool schemas, other windows, and analytics fields.

## 3. Verification

- [ ] 3.1 Run focused toolbox/window/toolbar/canvas tests, ESLint, and Drawnix typecheck.
- [ ] 3.2 Verify delete confirmation/success/failure and toolbar state in the application browser.
- [ ] 3.3 Run available toolbox smoke/feature/visual/responsive Playwright flows and classify blockers.
- [ ] 3.4 Compare full typecheck, unit tests, cycles, build, size, startup, and lint with baseline.
- [ ] 3.5 Run OpenSpec strict validation; while unavailable, record the blocker and perform manual format/conflict review.

