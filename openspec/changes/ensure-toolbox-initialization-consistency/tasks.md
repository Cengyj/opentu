## 1. Evidence and Approval

- [x] 1.1 Trace custom-tool initialization, mutation, drawer, launcher, and GitHub sync callers in both directions; exclude the uncalled `syncPaged()` branch.
- [x] 1.2 Reproduce late-read mutation overwrite with a controlled deferred localForage diagnostic.
- [x] 1.3 Confirm `useToolFromUrl` has no production caller, exclude its fixed-delay behavior from the existing-feature change, and remove the uncalled hook as a no-behavior cleanup.
- [x] 1.4 Confirm storage keys/schema, manifests, pins, iframe permissions, and analytics schemas do not need to change.
- [ ] 1.5 Obtain user approval for readiness, failure, and mutation-order behavior.

## 2. Implementation (approval required)

- [ ] 2.1 Add failing service tests for single initialization, delayed reads, mutation ordering, and read failure without overwrite.
- [ ] 2.2 Add failing consumer tests for drawer completion refresh.
- [ ] 2.3 Add failing launcher tests for readiness ordering and failure isolation.
- [ ] 2.4 Implement the shared custom-catalog readiness result and guard all persisted mutations.
- [ ] 2.5 Replace provisional reads in the reachable drawer and launcher paths.
- [ ] 2.6 Preserve existing keys, version/schema, tool definitions, pin state, analytics fields, and built-in immediate availability.

## 3. Verification

- [ ] 3.1 Run focused toolbox service/drawer/launcher/window tests and record exact counts.
- [ ] 3.2 Run focused ESLint and Drawnix typecheck.
- [ ] 3.3 Verify cold/slow/read-failure toolbox and pinned custom-launcher behavior in the application browser.
- [ ] 3.4 Run available toolbox smoke/feature/visual/responsive Playwright tests and classify browser/tool blockers separately.
- [ ] 3.5 Compare full typecheck, unit tests, cycles, build, size, startup, and lint with the recorded baseline.
- [ ] 3.6 Run OpenSpec strict validation; while the CLI is unavailable, record the blocker and complete a manual format/conflict audit.
