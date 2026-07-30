## 1. Evidence And Approval

- [x] 1.1 Trace WinBox and canvas external iframe creation, lifecycle handlers, stacking, sandbox and permission attributes.
- [x] 1.2 Browser-check Banana Prompt and Pose Library reachability without form, copy, download, account, permission, or credential interaction.
- [x] 1.3 Record the desktop blank/loading and loaded states plus exact iframe/window geometry.
- [x] 1.4 Separate external lifecycle feedback from outer WinBox viewport/accessibility and iframe permission policy.
- [ ] 1.5 Obtain user approval for loading/slow/error/retry semantics and the 10-second slow threshold.

## 2. Failing Tests And Implementation (Approval Required)

- [ ] 2.1 Add WinBox external iframe initial/load/error/slow/retry/unmount/multi-instance tests.
- [ ] 2.2 Add canvas iframe visible-layer, load/error/slow/retry/cleanup and interaction-overlay tests.
- [ ] 2.3 Implement per-instance lifecycle state/timer/attempt isolation in the WinBox external branch.
- [ ] 2.4 Move canvas lifecycle feedback above the iframe and add the same honest slow/retry behavior.
- [ ] 2.5 Add localized status/alert/retry semantics, focus treatment, reduced-motion behavior, and compact touch sizing.
- [ ] 2.6 Preserve sandbox/allow, URL preflight, one-request success, successful content mounting, geometry, persistence, and analytics invariants.

## 3. Verification

- [ ] 3.1 Run focused ToolWinBoxManager and ToolGenerator lifecycle tests with fake timers and exact counts/exit codes.
- [ ] 3.2 Browser-check synthetic delayed/success/error fixtures and reachable Banana/Pose states without interacting with external content.
- [ ] 3.3 Capture same-state desktop/tablet/mobile, light/dark, Chinese/English, 100%/200%, keyboard/focus and reduced-motion evidence.
- [ ] 3.4 Record load-signal timing only as raw diagnostic data unless at least five controlled samples support a performance conclusion.
- [ ] 3.5 Run Drawnix/full typecheck and lint, full tests/cycles/build/size/startup, and available smoke/feature/visual/responsive E2E against baseline.
- [ ] 3.6 Run OpenSpec strict validation; while unavailable, record exit 127 and complete manual structure/name/conflict validation.

