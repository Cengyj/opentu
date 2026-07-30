## 1. Evidence And Approval

- [x] 1.1 Trace application-menu entries through Drawnix deferred mounting into backup/restore and cloud-sync UI owners.
- [x] 1.2 Trace backup progress/result, cloud-sync context/status, credential presentation, disclosure, confirmation, close, and focus paths in both directions.
- [x] 1.3 Run controlled component diagnostics for English copy, dialog/tab/file/progress semantics, fields, disclosures, switch, icon actions, and password type without real storage/network data.
- [x] 1.4 Reproduce reachable disconnected dialogs in production Chromium at 1280×720 and capture before screenshots/focus/accessibility evidence.
- [x] 1.5 Separate current-board restore, GitHub record semantics, Token encryption policy, shared settings/menu, shared dialog, and unmeasured compact geometry owners.
- [ ] 1.6 Obtain user approval for F-03 modal/focus/keyboard/live-state/i18n/password-presentation behavior.

## 2. Failing Tests And Backup/Restore Implementation (Approval Required)

- [ ] 2.1 Add failing tests for named modal root, initial focus, Escape/cancel close, nested confirmation precedence, and invoker/launcher focus return.
- [ ] 2.2 Wire the existing dialog heading/description to the modal without changing container or close semantics.
- [ ] 2.3 Add failing tab tests for roles, selected/panel relationships, Left/Right/Home/End, disabled processing state, and pointer parity.
- [ ] 2.4 Implement the labelled tab contract while preserving current tab content and option state.
- [ ] 2.5 Add failing exact-count tests for ZIP selection by pointer, Enter, and Space plus replace-confirm cancellation.
- [ ] 2.6 Give the existing `.zip` file input one native activation owner and preserve accept/reset/import behavior.
- [ ] 2.7 Add failing progress/result tests for determinate value, concise live message, success, partial success, warnings, and errors.
- [ ] 2.8 Add scoped progress/status/alert semantics without changing service callbacks or toast outcomes.

## 3. Failing Tests And Cloud-Sync Implementation (Approval Required)

- [ ] 3.1 Add failing tests for named/modal root, native named close, initial/return focus, Escape, and nested confirm precedence.
- [ ] 3.2 Add an F-03-scoped semantic/focus shell without changing the shared TDesign dialog default.
- [ ] 3.3 Add failing tests for Token/custom-password labels, auto-sync switch, show/hide state, delete/refresh actions, and no credential text in names/placeholders/status/logs.
- [ ] 3.4 Add explicit labels and mask custom-password entry/storage display by default while preserving save/clear/storage values.
- [ ] 3.5 Add failing Gist/recycle disclosure tests for Enter/Space, expanded/controls, loading, empty, current, and one load per activation.
- [ ] 3.6 Implement native disclosure controls and name icon-only actions without changing list/service behavior.
- [ ] 3.7 Add failing live-state tests for connection error, syncing, Gist/recycle loading, destructive-action busy state, and terminal results.
- [ ] 3.8 Add concise status/alert semantics while preserving current sync calls, confirmations, and messages.

## 4. Localization And Preservation (Approval Required)

- [ ] 4.1 Inventory application-authored F-03 literals across BackupRestoreDialog, SyncSettings, TokenGuide, RecycleBin, and F-03 confirmations/messages.
- [ ] 4.2 Add typed Chinese/English keys and consume them in the F-03 owner components.
- [ ] 4.3 Test Chinese/English initial render and live switch for normal/loading/empty/error/partial/confirmation states.
- [ ] 4.4 Test byte preservation for board/file/user/Gist/provider/imported values and prove credentials never enter translated/logged output.
- [ ] 4.5 Prove backup options/service arguments, import mode/file, sync pull/push/config/delete/restore arguments, analytics names, and all persisted formats remain unchanged.

## 5. Verification

- [ ] 5.1 Run focused component/service tests with exact file/test counts, exits, and callback-count assertions.
- [ ] 5.2 Run F-03 backup/GitHub regression tests and compare exact results with the 5-file/36-test baseline.
- [ ] 5.3 Run focused ESLint and Drawnix typecheck, then full typecheck/tests/cycles/build/size/startup checks against baseline.
- [ ] 5.4 Run available smoke/feature/visual/responsive Playwright tests; classify missing browser binaries as environment failure.
- [ ] 5.5 Verify desktop/tablet/mobile, Chinese/English, keyboard/pointer/touch, focus, 100%/high-DPI, reduced motion, long values, slow/loading/error/partial states, and no destructive external calls.
- [ ] 5.6 Capture matched before/after screenshots and report objective geometry/overflow/focus differences; make no performance claim without five-sample before/after measurement.
- [x] 5.7 Attempt strict OpenSpec validation; the CLI is unavailable (exit 127), so perform manual structure/scenario/requirement-name/conflict checks without claiming strict validation.
