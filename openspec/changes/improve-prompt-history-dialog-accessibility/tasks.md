## 1. Evidence and Approval

- [x] 1.1 Trace create/edit open and close paths and the current overlay/form markup.
- [x] 1.2 Capture desktop browser evidence for retained background focus, missing dialog/modal semantics, and ineffective Escape.
- [x] 1.3 Capture the 390×844 layout and confirm the form visually fits, isolating the defect to accessibility behavior.
- [x] 1.4 Confirm that the change does not alter persistence, task history, backup, filtering, analytics, caching, or generation semantics.
- [ ] 1.5 Obtain user approval for the user-visible keyboard and screen-reader behavior change.

## 2. Implementation (approval required)

- [ ] 2.1 Add failing component tests for accessible dialog naming/modal state, initial focus, Escape, focus cycling, and focus restoration.
- [ ] 2.2 Add scoped refs and lifecycle handling for the invoker and dialog focus boundary.
- [ ] 2.3 Add dialog semantics and a stable accessible title association without changing the visual hierarchy.
- [ ] 2.4 Preserve every existing pointer, validation, Cancel, Save, and read-only edit path.

## 3. Verification

- [ ] 3.1 Run focused prompt-history component/service/storage tests and record command, exit code, and statistics.
- [ ] 3.2 Run focused lint, Drawnix typecheck, and compare full-repository checks with the recorded baseline.
- [ ] 3.3 Repeat desktop/mobile, light/dark, Tab/Shift+Tab, Escape, pointer dismissal, validation, and focus-return browser flows with before/after screenshots.
- [ ] 3.4 Record five same-environment dialog open/close samples and confirm no material interaction regression; do not claim an improvement without data.
- [ ] 3.5 Run OpenSpec strict validation; while the CLI is unavailable, record the tool blocker and complete a manual format/conflict audit.

