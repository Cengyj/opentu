## 1. Evidence And Approval

- [x] 1.1 Trace every reachable comic record writer and task synchronization consumer.
- [x] 1.2 Run a controlled concurrent mutation diagnostic against the real comic storage module.
- [x] 1.3 Trace task-storage initialization, restoration events, and comic reconciliation.
- [x] 1.4 Confirm schemas, keys, retention, providers, generation, cache, and export semantics remain unchanged.
- [ ] 1.5 Obtain user approval for mutation ordering, restored-task reconciliation, and persistence feedback.

## 2. Reproduction Tests (Approval Required)

- [ ] 2.1 Add concurrent update/update, task-result/edit, add/delete, and failure-then-success tests.
- [ ] 2.2 Add storage-ready reconciliation tests with multiple tasks, a non-comic first task, and simultaneous live completion.
- [ ] 2.3 Add component persistence-rejection and later-success feedback tests.

## 3. Implementation (Approval Required)

- [ ] 3.1 Add a comic-owned mutation queue without changing the stored representation.
- [ ] 3.2 Reuse one approved task-storage-ready signal for a filtered comic reconciliation pass.
- [ ] 3.3 Preserve task-ID singleflight, image-variant deduplication, and unrelated current-record selection.
- [ ] 3.4 Add safe visible persistence feedback and recovery.

## 4. Verification

- [ ] 4.1 Run comic storage, task sync, component, history, and shared workflow focused tests.
- [ ] 4.2 Measure five runs for 1/10/50 accepted mutations at 0/10/50 stored records and report correctness plus latency distributions.
- [ ] 4.3 Recheck multiple windows, completion during editing, refresh, failure/retry, deletion, favorites, and privacy-safe feedback.
- [ ] 4.4 Run Drawnix/full typecheck, test, cycles, build, size, startup, and available E2E checks against baseline.
- [ ] 4.5 Run OpenSpec strict validation; while the CLI is unavailable, record the blocker and complete manual structure/conflict validation.

