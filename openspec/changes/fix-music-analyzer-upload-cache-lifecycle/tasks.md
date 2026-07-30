## 1. Evidence And Approval

- [x] 1.1 Trace upload selection through cache write, task creation, executor read, record projection, retry, record prune/delete, and task removal.
- [x] 1.2 Prove the existing 20 MB rejection occurs after the full cache write.
- [x] 1.3 Prove pre-task failure has no record-owned cleanup and immediate terminal cleanup would break task retry.
- [ ] 1.4 Obtain user approval for preflight and last-owner cleanup semantics.

## 2. Failing Tests And Implementation (Approval Required)

- [ ] 2.1 Add failure-injection tests for oversize, cache/task-create failure, retry ownership, transfer, deletion orders, shared reference, missing cache, and cleanup rejection.
- [ ] 2.2 Centralize the Music Analyzer 20 MB limit and reject before cache write.
- [ ] 2.3 Add page-owned cleanup when no task is accepted.
- [ ] 2.4 Add idempotent last-owner cleanup for explicit task/record deletion or pruning without changing retryable terminal-state retention.
- [ ] 2.5 Keep cache URLs, task params, record source snapshots, and retention schemas unchanged.

## 3. Verification

- [ ] 3.1 Run focused Create/cache/storage/task delete/retry tests with exact counts and exit codes.
- [ ] 3.2 Run five samples at the declared file sizes and report cache time, delete time, retained bytes, median, and range.
- [ ] 3.3 Browser-check size boundaries, slow cache, rejection, failure/cancel/retry/delete, refresh/offline, and two windows.
- [ ] 3.4 Run Drawnix/full typecheck and lint, full test/cycles/build/size/startup, and available E2E against baseline.
- [x] 3.5 Run OpenSpec strict validation; while unavailable, record exit 127 and complete manual format/name/conflict validation.
