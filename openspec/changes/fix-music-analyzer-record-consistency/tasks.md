## 1. Evidence And Approval

- [x] 1.1 Trace every Music Analyzer record writer, shared storage helper, task-sync consumer, and cleanup callback.
- [x] 1.2 Run a controlled real-helper diagnostic proving a concurrent non-conflicting patch is lost.
- [x] 1.3 Trace deferred task restoration and prove that the single representative event cannot reconcile every restored Music Analyzer task.
- [x] 1.4 Separate the global readiness owner from the Music Analyzer domain consumer and check related active changes.
- [ ] 1.5 Obtain user approval for mutation ordering, restored-task reconciliation, and visible save-failure semantics.

## 2. Failing Tests And Implementation (Approval Required)

- [ ] 2.1 Add update/update, add/add, task/edit, favorite/delete, failure-recovery, and prune/cleanup red tests.
- [ ] 2.2 Add Music Analyzer-key mutation ordering without changing the shared record schema or unrelated keys.
- [ ] 2.3 Add unrelated-first restored-map, live+restore overlap, and current-selection preservation red tests.
- [ ] 2.4 Consume the single shared task-storage-ready signal and reconcile filtered Music Analyzer tasks idempotently.
- [ ] 2.5 Add sequence-safe, privacy-safe persistence feedback for page, task-sync, favorite, and delete writes.

## 3. Verification

- [ ] 3.1 Run focused storage/task-sync/page tests with exact file/case counts and exit codes.
- [ ] 3.2 Measure five runs of the declared mutation matrix and report median/range/queue depth with zero lost mutations.
- [ ] 3.3 Browser-check one/two windows, autosave, task result, favorite/delete, rejection/retry, refresh, offline, and current-record stability.
- [ ] 3.4 Run Drawnix/full typecheck and lint, full test/cycles/build/size/startup, and available E2E against baseline.
- [x] 3.5 Run OpenSpec strict validation; while the CLI is unavailable, record exit 127 and complete manual format/name/conflict validation.
