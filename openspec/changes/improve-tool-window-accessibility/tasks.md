## 1. Evidence and Approval

- [x] 1.1 Inspect one open tool WinBox root and every visible title-bar control for role, name, tab stop, focus, and Escape behavior.
- [x] 1.2 Inspect a named launcher button and its right-click menu for trigger reachability, focus, roles, and tab stops.
- [x] 1.3 Trace tool open/restore/close/minimize, WinBox DOM creation, active-window ordering, launcher actions, and existing menu primitives.
- [x] 1.4 Confirm that toolbox-card and nested prompt-dialog accessibility are covered by separate pending changes.
- [x] 1.5 Confirm the same unnamed, unfocusable WinBox title controls on the registered Music Analyzer caller.
- [ ] 1.6 Obtain user approval for dialog, focus, Escape, title-control, and launcher-menu behavior.

## 2. Implementation (Approval Required)

- [ ] 2.1 Add failing tests for the named tool dialog and localized visible-control semantics.
- [ ] 2.2 Add failing tests for focus entry/restoration, Enter/Space action parity, active-window Escape, nested-surface precedence, and cleanup.
- [ ] 2.3 Add opt-in root/control accessibility behavior in `WinBoxWindow` and pass localized F-15 labels from `ToolWinBoxManager`.
- [ ] 2.4 Add failing launcher tests for right click, Shift+F10, Context Menu key, menu roles/navigation/actions, and focus restoration.
- [ ] 2.5 Reuse project menu primitives for the launcher context actions without changing option availability or persistence semantics.
- [ ] 2.6 Keep raw URLs, permissions, prompts, credentials, and internal IDs out of accessible names and analytics.

## 3. Verification

- [ ] 3.1 Run focused WinBox/manager/launcher tests with exact file/case counts and exit codes.
- [ ] 3.2 Verify Chinese and English names, one/two instances, internal/iframe tools, open/minimize/restore/close, and all context actions.
- [ ] 3.3 Verify keyboard order, focus visibility, Escape precedence, and pointer parity at desktop/tablet/mobile viewports.
- [ ] 3.4 Capture same-state before/after screenshots and exact title-bar/menu geometry; record any visual delta.
- [ ] 3.5 Run Drawnix typecheck/lint and full typecheck/test/cycles/build/size/startup against the baseline.
- [ ] 3.6 Run available toolbox smoke/feature/visual/responsive Playwright flows and classify the configured-browser blocker separately.
- [x] 3.7 Run OpenSpec strict validation; while the CLI is unavailable, record exit 127 and complete a manual format/name/conflict audit.
