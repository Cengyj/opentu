## 1. Evidence And Approval

- [x] 1.1 Trace every toolbar whole-record writer, provider projection, reachable caller, drag emission point, persistence boundary, and refresh reader.
- [x] 1.2 Run a controlled deferred-write diagnostic and prove current/durable/refresh divergence under reverse completion.
- [x] 1.3 Separate overlapping ordering from `ensure-toolbar-config-write-consistency`, accessibility, cross-tab, schema, and global storage ownership.
- [ ] 1.4 Obtain user approval for domain-local accepted-order sequencing and its dependency on the sequential durable-outcome change.

## 2. Failing Tests And Implementation (Approval Required)

- [ ] 2.1 Add failing service/provider tests for two/three overlapping successes and earlier/middle/latest rejection.
- [ ] 2.2 Queue semantic toolbar operations and derive each candidate from the last durable configuration.
- [ ] 2.3 Serialize this domain's writes, settle each operation independently, and continue the queue after failure.
- [ ] 2.4 Adapt context-menu, More-panel, and drag callers to operation-specific pending/outcome handling without duplicate feedback.
- [ ] 2.5 Preserve storage key/schema/version, migrations, button IDs, defaults, and single-operation behavior.

## 3. Verification

- [ ] 3.1 Run focused service/hook/context-menu/More/drag overlap, failure, retry, and refresh tests with exact counts.
- [ ] 3.2 Verify two rapid existing actions and two drag drops in a browser without reading storage directly; refresh must project the final successful intent.
- [ ] 3.3 Verify earlier/middle/latest failure does not poison later actions or leak serialized configuration in feedback/logging.
- [ ] 3.4 Measure five single-operation and five two-operation burst latencies before/after in the same environment.
- [ ] 3.5 Run edited-file lint, Drawnix/full typecheck, full tests, cycles, build, size, startup, and available E2E against baseline.
- [x] 3.6 Attempt strict OpenSpec validation; if the CLI remains unavailable, record exit 127 and complete manual structure/scenario/owner checks without claiming strict validation.
