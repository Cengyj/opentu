## 1. Evidence and Approval

- [x] 1.1 Trace delayed startup initialization and every reachable synchronous prompt mutation entry.
- [x] 1.2 Run a controlled delayed-read diagnostic that records the current memory/persistence split.
- [x] 1.3 Trace backup collection and run a controlled delayed-write diagnostic that records stale immediate backup metadata.
- [x] 1.4 Confirm that storage keys, serialized prompt values, backup version, task execution, provider routing, filtering, analytics, and cache behavior do not need to change.
- [ ] 1.5 Obtain user approval for the storage timing and backup/import consistency change.

## 2. Implementation (approval required)

- [ ] 2.1 Add failing tests for single-flight initialization and ordered replay of add/remove/pin/edit/delete mutations.
- [ ] 2.2 Add failing tests for reversed write completion, explicit flush success/failure, immediate backup, and import/replace ordering.
- [ ] 2.3 Implement one initialization promise and deterministic pre-initialization mutation replay while preserving synchronous public APIs.
- [ ] 2.4 Serialize immutable prompt-domain snapshots and expose a typed pending-write flush boundary.
- [ ] 2.5 Await the flush in backup export/import prompt workflows and surface safe failures.

## 3. Verification

- [ ] 3.1 Run prompt storage, prompt history, AI input, chat input, prompt optimization, and backup/restore focused tests; record command, exit code, and statistics.
- [ ] 3.2 Run focused lint, Drawnix typecheck, and compare full-repository checks with the recorded baseline.
- [ ] 3.3 Measure five initialization and write samples at the specified 0/100/1,000-entry and 1/10/100-write fixtures; report raw values, median, range, and startup/UI cost.
- [ ] 3.4 Recheck refresh, reload, immediate backup, merge/replace restore, edit, pin, delete, storage failure, and privacy/error-feedback paths.
- [ ] 3.5 Run OpenSpec strict validation; while the CLI is unavailable, record the tool blocker and complete a manual format/conflict audit.

