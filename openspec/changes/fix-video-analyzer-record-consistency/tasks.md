## 1. Evidence and Approval

- [x] 1.1 Trace all reachable video-analyzer record writers and task synchronization consumers.
- [x] 1.2 Run controlled concurrent patch and concurrent add diagnostics against the current record-storage algorithm.
- [x] 1.3 Trace task-storage initialization, memory restoration, emitted events, and workflow-task reconciliation.
- [x] 1.4 Confirm record/task schemas, storage keys, retention, provider, cache, and batch semantics remain unchanged.
- [ ] 1.5 Obtain user approval for mutation ordering, restored-task reconciliation, and visible save-failure semantics.

## 2. Implementation (approval required)

- [ ] 2.1 Add failing concurrent add/update/delete and task-sync/edit tests.
- [ ] 2.2 Add failing task-storage-ready reconciliation tests with multiple restored tasks and simultaneous live events.
- [ ] 2.3 Add failing Script/Generate persistence rejection and later-success recovery tests.
- [ ] 2.4 Implement the video-analyzer mutation queue without changing the stored representation.
- [ ] 2.5 Implement one coordinated storage-ready reconciliation pass and preserve task-ID idempotency/current selection.
- [ ] 2.6 Add safe visible persistence feedback and recovery.

## 3. Verification

- [ ] 3.1 Run video-analyzer storage, task sync, Analyze, Script, Generate, history, and shared workflow focused tests.
- [ ] 3.2 Run focused lint, Drawnix typecheck, full typecheck/test/cycles/build/size/startup, and compare with baseline.
- [ ] 3.3 Measure 5 runs for 1/10/50 concurrent mutations at 0/10/50 stored records and report zero lost mutations plus latency distributions.
- [ ] 3.4 Recheck multiple windows, completion during editing, refresh restoration, failure then retry, history cap, deletion, favorites, and privacy-safe feedback.
- [ ] 3.5 Run OpenSpec strict validation; while the CLI is unavailable, record the blocker and complete a manual structure/conflict audit.

