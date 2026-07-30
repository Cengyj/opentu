## 1. Evidence and approval

- [x] 1.1 Trace native/duplex/version-state producers, dedupe state, deferred mount, sole consumer, task guard and confirmation path in both directions
- [x] 1.2 Reproduce before-mount loss and after-mount delivery with controlled version/fetch fixtures
- [x] 1.3 Confirm no current replay/snapshot owner and no storage/cache/schema change is required
- [x] 1.4 Separate prompt accessibility/localization and startup chunking into their existing independent changes
- [ ] 1.5 Obtain user approval for page-local readiness, authoritative clear/replace and race semantics

## 2. Tests first

- [ ] 2.1 Add failing early/late delivery parity and unmount/remount tests
- [ ] 2.2 Add same-version dedupe, A→B replacement, authoritative clear and stale async response tests
- [ ] 2.3 Add active-task delay/reappearance and one-confirmation/one-COMMIT_UPGRADE tests
- [ ] 2.4 Add missing-worker, natural activation, visibility retry, refresh and multi-tab tests
- [ ] 2.5 Add an entry-graph assertion that the readiness boundary does not import the full prompt/task/UI graph

## 3. Implementation

- [ ] 3.1 Add the minimal typed page-local pending-version readiness owner
- [ ] 3.2 Publish/clear/replace it from authoritative bootstrap runtime-version handling
- [ ] 3.3 Consume the current value on delayed prompt mount and subscribe cleanup-safely
- [ ] 3.4 Guard async version.json results by current revision/version
- [ ] 3.5 Preserve active-task, explicit-confirmation, waiting-worker, commit and reload behavior
- [ ] 3.6 Update FEATURE_FLOWS and narrowly relevant coding guidance

## 4. Verification

- [ ] 4.1 Run focused component/bootstrap/SW tests with exact counts, durations and exit codes
- [ ] 4.2 Run five early/late/replace/task/missing-worker/multi-tab iterations and retain raw results
- [ ] 4.3 Run typecheck, focused lint, full tests, cycles, build:web, size and verify:startup against baseline
- [ ] 4.4 Measure at least five normal-startup and delayed-mount samples before/after; report raw values, median, range and bytes
- [ ] 4.5 Rewalk update-ready → prompt → confirm → commit → activate → reload plus natural activation and refresh paths
