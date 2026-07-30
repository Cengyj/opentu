## 1. Evidence and approval

- [x] 1.1 Trace update notice/dialog state, i18n owner, task guard and confirmation callback in both directions
- [x] 1.2 Record English visible copy and current status/dialog semantics with controlled fixtures
- [x] 1.3 Confirm version/changelog are release data and no storage/SW/task change is required
- [x] 1.4 Separate notification replay, startup mount and unproven compact/z-index claims
- [ ] 1.5 Obtain user approval for localization, bounded status, modal focus/Escape/return and reduced motion

## 2. Tests first

- [ ] 2.1 Add failing zh/en notice/button/header and live-language-switch tests
- [ ] 2.2 Add failing bounded status/non-live changelog/no-duplicate-announcement tests
- [ ] 2.3 Add failing dialog role/name/modal/open-focus/Escape/focus-return tests
- [ ] 2.4 Add exact close/update callback-count and no-Enter-auto-commit tests
- [ ] 2.5 Add active-task, no-changelog, fetch-failure and sentinel release-data regression tests
- [ ] 2.6 Add reduced-motion tests

## 3. Implementation

- [ ] 3.1 Add scoped typed zh/en update-interface keys
- [ ] 3.2 Consume current language without refetching or changing local state ownership
- [ ] 3.3 Add one concise bounded readiness status
- [ ] 3.4 Replace/adapt the changelog surface with the project-owned accessible modal contract
- [ ] 3.5 Preserve exact update/close/task callbacks and release values
- [ ] 3.6 Add reduced-motion handling without changing visibility timing

## 4. Verification

- [ ] 4.1 Run focused i18n/component tests with exact counts/durations/exits
- [ ] 4.2 Run keyboard/focus/status semantic checks in zh/en with long mixed release notes
- [ ] 4.3 Capture same-state 1280/768/390/320 and reduced-motion before/after screenshots without claiming unrelated layout fixes
- [ ] 4.4 Run focused lint, Drawnix/full typecheck, full tests, cycles, build:web, size and verify:startup
- [ ] 4.5 Rewalk update ready, no changelog, fetch failure, active task, dialog close and explicit update actions
