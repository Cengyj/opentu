## 1. Evidence and Approval

- [x] 1.1 Trace automatic terminal-task archival from the 100-task retention threshold to the persisted `archived` flag.
- [x] 1.2 Trace prompt-history reads and prove the service accepts the reader's active-only default.
- [x] 1.3 Trace backup export/import and confirm archived task records survive while the prompt-history read remains unable to reach them.
- [x] 1.4 Confirm that the change does not alter task execution, active task views, schemas, backup format, deletion, overrides, pinning, caching, or provider routing.
- [ ] 1.5 Obtain user approval for the user-visible archived-history restoration.

## 2. Implementation (approval required)

- [ ] 2.1 Add a failing service regression that requires `includeArchived: true` for prompt-history task-summary reads.
- [ ] 2.2 Opt the prompt-history service into archived lightweight summaries without changing the reader's global default.
- [ ] 2.3 Add reader coverage for active-only and include-archived terminal statuses.
- [ ] 2.4 Add mixed active/archived aggregation and backup-restore recovery coverage.

## 3. Verification

- [ ] 3.1 Run prompt history, prompt storage, task reader, and backup/restore focused tests; record command, exit code, and statistics.
- [ ] 3.2 Run Drawnix typecheck and focused lint, then compare full-repository checks with the recorded baseline.
- [ ] 3.3 Measure at least five cold and five warm loads for 100, 1,000, and the largest practical archived-history fixture; record raw values, median, range, and reader batch count.
- [ ] 3.4 Recheck filter, search, pin, edit, delete, preview, refresh, backup restore, active task views, and privacy telemetry paths.
- [ ] 3.5 Run OpenSpec strict validation; while the CLI is unavailable, record the tool blocker and complete a manual format/conflict audit.

