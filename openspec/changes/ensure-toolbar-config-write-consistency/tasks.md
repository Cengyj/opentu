## 1. Evidence And Approval

- [x] 1.1 Trace context-menu, More-panel, and drag mutations through the hook, service owner, IndexedDB write, React projection, and refresh.
- [x] 1.2 Verify remove/reset success across two refreshes and prove the current write rejection is caught without caller feedback.
- [x] 1.3 Separate accessibility/visual ownership and assign the subsequently confirmed rapid-write race to `preserve-toolbar-config-mutation-order`.
- [ ] 1.4 Obtain user approval for awaitable durable mutation and rollback/retry feedback semantics.

## 2. Failing Tests And Implementation (Approval Required)

- [ ] 2.1 Add failing service/hook tests for remove/show/reorder/reset rejection, unchanged committed state, safe error outcome, and retry.
- [ ] 2.2 Make user-initiated toolbar mutations prepare and await a candidate commit before publishing it.
- [ ] 2.3 Adapt context-menu, More-panel, and drag callers to pending/failure/retry outcomes without floating promises or duplicate feedback.
- [ ] 2.4 Preserve the key, schema, version, migration, button IDs, order/visibility rules, and default configuration.

## 3. Verification

- [ ] 3.1 Run focused toolbar service/hook/context-menu/More/drag tests with exact counts and exit codes.
- [x] 3.2 Run a controlled overlapping-write diagnostic; reverse completion reproduced current/durable/refresh divergence, so create the separate evidence-backed `preserve-toolbar-config-mutation-order` change.
- [ ] 3.3 Verify success, injected failure, retry, and refresh in Chinese/English and desktop/tablet/mobile; measure five sequential mutation latencies before/after.
- [ ] 3.4 Run targeted lint, Drawnix/full typecheck, full tests, cycles, build, size, startup, and available E2E against baseline.
- [x] 3.5 Attempt strict OpenSpec validation; CLI is unavailable (exit 127), so complete manual structure, scenario, and requirement-name conflict checks without claiming strict validation.
