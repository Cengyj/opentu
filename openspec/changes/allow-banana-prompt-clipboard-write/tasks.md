## 1. Evidence And Approval

- [x] 1.1 Trace Banana Prompt from its reachable manifest and toolbox entry through tool-window state to the final WinBox iframe.
- [x] 1.2 Inspect the current public Banana document and bundle, recording status, byte count, hashes, copy control flow, and fallback/rejection behavior.
- [x] 1.3 Run five isolated cross-origin Chromium policy samples with no Clipboard API call or system clipboard access.
- [x] 1.4 Confirm that credential handling, loading recovery, canvas permissions, sandbox tokens, other built-ins, and custom tools have separate owners or remain out of scope.
- [ ] 1.5 Obtain user approval for the Banana-only, write-only WinBox permission boundary.

## 2. Failing Tests And Implementation (Approval Required)

- [ ] 2.1 Add manifest tests proving Banana declares exactly `clipboard-write` and the other built-in external tools do not.
- [ ] 2.2 Add WinBox renderer tests proving undeclared URL tools omit `allow` and declared values are projected exactly.
- [ ] 2.3 Add a negative assertion that this change introduces no `clipboard-read` token in the WinBox path.
- [ ] 2.4 Add the optional typed WinBox feature-permission field to the tool definition.
- [ ] 2.5 Declare `clipboard-write` only on the Banana Prompt manifest.
- [ ] 2.6 Project a non-empty declaration to the external WinBox iframe while preserving `src`, `title`, dimensions, and sandbox.
- [ ] 2.7 Update F-21 feature-flow/security documentation with the manifest permission boundary and canvas non-goal.

## 3. Verification

- [ ] 3.1 Run focused manifest and ToolWinBoxManager tests with exact file/test counts and exit codes.
- [ ] 3.2 Run five post-change local cross-origin policy samples without invoking Clipboard APIs or reading/writing the system clipboard.
- [ ] 3.3 Browser-check Banana open, copy with a non-sensitive prompt, minimize, restore, close, and reopen in an isolated profile; record browser permission/user-activation outcomes separately from parent policy.
- [ ] 3.4 Verify Chat-MJ, Pose Library, and an undeclared custom URL still have no WinBox `allow` attribute and unchanged sandbox/request behavior.
- [ ] 3.5 Verify canvas Banana insertion/render/refresh still has its pre-existing policy and serialized board data is unchanged.
- [ ] 3.6 Run Drawnix typecheck and targeted lint, then full typecheck/tests/cycles/build/size/startup and available smoke/feature/visual/responsive E2E against baseline.
- [ ] 3.7 Run OpenSpec strict validation; while the CLI is unavailable, record exit 127 and manually verify structure, scenarios, requirement uniqueness, and owner conflicts.

