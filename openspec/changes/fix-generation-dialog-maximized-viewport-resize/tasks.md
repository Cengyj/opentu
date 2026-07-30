## 1. Evidence and Approval

- [x] 1.1 Reproduce the image-dialog viewport mismatch after a landscape-to-portrait transition and retain raw geometry, interaction, and screenshot evidence.
- [x] 1.2 Reproduce the same shared path for the video dialog and verify that a direct portrait open is the non-regressed control.
- [x] 1.3 Trace viewport events, compact-layout state, generation-dialog props, the shared WinBox wrapper, and the upstream WinBox resize behavior.
- [x] 1.4 Confirm that the proposed boundary does not change task execution, persistence, caching, provider routing, or non-maximized window semantics.
- [ ] 1.5 Obtain user approval for the user-visible responsive behavior change.

## 2. Implementation (approval required)

- [ ] 2.1 Add a scoped, cleaned-up viewport listener that recomputes visible maximized generation-window geometry without remounting dialog content.
- [ ] 2.2 Keep non-maximized, minimized, split, hidden, and destroyed windows on their existing paths.
- [ ] 2.3 Preserve form state, task state, focus behavior, scrolling, and mobile panel selection across the resize.

## 3. Verification

- [ ] 3.1 Add a failing-then-passing unit or integration test for maximized geometry after a viewport resize, including listener cleanup.
- [ ] 3.2 Cover image and video generation dialogs at `844×390 → 390×844` and `390×844 → 844×390`.
- [ ] 3.3 Verify direct desktop, tablet, and mobile opens plus non-maximized desktop resize behavior.
- [ ] 3.4 Capture same-state before/after screenshots and record viewport, WinBox, tab-intersection, and scroll-width measurements.
- [ ] 3.5 Run focused tests, typecheck, lint, full-repository checks, build, startup verification, size budgets, and responsive Playwright tests when the configured Chromium is available.
- [ ] 3.6 Run OpenSpec strict validation; while the CLI is unavailable, record the tool blocker and complete a manual format/conflict audit.

