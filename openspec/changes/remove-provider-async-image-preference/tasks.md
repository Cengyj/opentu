## 1. Investigation And Specification

- [x] 1.1 Trace the switch through UI drafts, settings normalization, routing snapshots, binding inference, planning, adapters, transport, TaskQueue, retry, and recovery.
- [x] 1.2 Separate the removable profile-wide override from legitimate model/discovery-driven asynchronous image execution.
- [ ] 1.3 Validate this change with strict OpenSpec validation. (Blocked: `openspec validate ... --strict` exits 127 and `pnpm exec openspec ... --strict` exits 254 because the CLI is unavailable.)

## 2. Settings And Routing Cleanup

- [x] 2.1 Remove the switch UI, profile field, normalization, and routing snapshot property.
- [x] 2.2 Restore model/discovery-scoped asynchronous binding inference and remove planner dependence on profile state.
- [x] 2.3 Remove permanent legacy-binding reconstruction; recover only from a complete task binding snapshot and fail incomplete state before transport.
- [x] 2.4 Update conflicting active OpenSpec/accessibility references without changing their unrelated scope.

## 3. Tests

- [x] 3.1 Prove legacy stored properties are ignored and omitted after a normalized write.
- [x] 3.2 Prove the settings source no longer renders or writes the experimental control.
- [x] 3.3 Prove ordinary, known-async, discovered-async, specialized, auto, and manual routing behavior, plus snapshot-only recovery and fail-closed incomplete legacy state.
- [x] 3.4 Run adapter, transport, TaskQueue, retry, recovery, discovery, and non-image regression suites.

## 4. Verification

- [x] 4.1 Run focused Vitest suites.
- [x] 4.2 Run Drawnix typecheck, lint baseline comparison, cycle detection, and `git diff --check`.
- [x] 4.3 Review the final diff and confirm protected user changes remain untouched.
