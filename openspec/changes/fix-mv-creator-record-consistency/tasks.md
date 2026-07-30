## 1. Evidence And Approval

- [x] 1.1 Trace all reachable MV record writers and task synchronization consumers.
- [x] 1.2 Run a controlled concurrent mutation diagnostic against the real MV storage module.
- [x] 1.3 Trace task-storage initialization, restoration events, and MV reconciliation.
- [x] 1.4 Confirm batch semantics, schemas, keys, retention, routing, cache, and export remain outside the change.
- [ ] 1.5 Obtain user approval for mutation ordering, restored-task reconciliation, and persistence feedback.

## 2. Failing Tests

- [ ] 2.1 Add concurrent update/update, task-result/edit, subject/edit, add/delete, and failure-then-success tests.
- [ ] 2.2 Add task-storage-ready reconciliation tests with multiple tasks, a non-MV first task, and simultaneous live completion.
- [ ] 2.3 Add component autosave/history/batch persistence rejection and later-success feedback tests.

## 3. Implementation

- [ ] 3.1 Add an MV-owned mutation queue without changing the stored representation.
- [ ] 3.2 Reuse one approved task-storage-ready signal for a filtered MV reconciliation pass.
- [ ] 3.3 Add MV task-ID singleflight across local, shared, and restored synchronization.
- [ ] 3.4 Add safe visible persistence feedback and recovery.

## 4. Verification

- [ ] 4.1 Run MV storage, task sync, Analyze, Script, Generate, History, and shared workflow focused tests.
- [ ] 4.2 Measure five runs for 1/10/50 accepted mutations at 0/10/50 records and report correctness plus latency distributions.
- [ ] 4.3 Recheck multiple windows, completion during editing, refresh, failure/retry, deletion, favorites, subject selection, reset, and privacy-safe feedback.
- [ ] 4.4 Run Drawnix/full typecheck, test, cycles, build, size, startup, and available E2E checks against baseline.
- [ ] 4.5 Run OpenSpec strict validation; while the CLI is unavailable, record the blocker and complete manual structure/conflict validation.

