## 1. Evidence and Approval

- [x] 1.1 Trace task creation, adapter execution, adapter-side completion, task polling, and nullable storage reads in both directions
- [x] 1.2 Confirm the duplicated lifecycle path is shared by Gemini, GPT, URL, multi-image, and asynchronous image result handling rather than owned by one model
- [x] 1.3 Confirm the process-local writer queue cannot provide cross-tab atomic ownership and that current read/write decisions are not one IndexedDB compare-and-swap transaction
- [x] 1.4 Inventory coordination boundaries with queue concurrency, external cancellation, workflow recovery, SW duplex transport, and startup loading changes
- [x] 1.5 Audit `aitu-app` version-1 open behavior and confirm a database-version bump would break v1.0.1 rollback with `VersionError`
- [x] 1.6 Trace FramePanel and ComicCreator's direct `waitForTaskCompletion` usage plus task reader/writer, backup/import, and paged cloud-sync conversion boundaries
- [x] 1.7 Separate one-shot dispatch authority from renewable query-only polling ownership and document the background-throttled synchronous-response rule
- [x] 1.8 Run fresh deployed-bundle provider tests and a controlled normal-UI `b64_json` success fixture, retaining the boundary between live-provider failures/stall and proven frontend success convergence
- [ ] 1.9 Obtain user approval for the single-owner boundary, version-1 in-row layout, migration/projection, dispatch, polling, field-fidelity, and entry-point semantics

## 2. Tests First

- [ ] 2.1 Add failing lifecycle-pure adapter contract/static-import tests for typed `submit`/`query`, no task/UI/store mutation, and Gemini `inlineData`/`inline_data`, GPT `b64_json`, URL, multi-image, and async URL normalization
- [ ] 2.2 Add failing synchronous-flow tests proving direct result delivery without IndexedDB completion polling and accepting the unique current attempt/dispatch-token response after 121-second background delay
- [ ] 2.3 Add failing fencing tests proving the same delayed response is rejected after retry supersession, cancellation, failure, timeout/interruption, or another terminal decision
- [ ] 2.4 Add failing async tests proving `submit` and `query` are separate, `remoteId`/route commits before first query, query count is zero before commit, and `query` cannot call a submit endpoint
- [ ] 2.5 Add failing atomic dispatch tests for reservation/operation deadlines, reservation replacement before consumption, one token consumption, crash after consumption, session-heartbeat freshness/expiry, polling-lease expiry/takeover, and zero resubmission after consumed authority
- [ ] 2.6 Add failing transition tests for concurrent tabs, stale query/progress/error, retry attempt replacement, immutable history, and irreversible terminal states
- [ ] 2.7 Add failing read-outcome tests for `found`, post-create `missing`, transient `storage-error`, storage-budget exhaustion, and separation from provider retry budgets
- [ ] 2.8 Add failing version-1 row tests proving no DB version/store/index change, lazy idempotent `imageLifecycle.version=1` initialization, unknown-version preservation, and successful v1.0.1 `open('aitu-app', 1)` after new writes
- [ ] 2.9 Add failing legacy fixtures for unchanged terminal history, query-only remote recovery, missing-remote/malformed active interruption, outer `failed` plus `IMAGE_ATTEMPT_INTERRUPTED`, and unrelated non-image tasks
- [ ] 2.10 Add failing lossless round-trip tests across raw SWTask, `convertSWTaskToTask`, `convertToSWTask`, writer merge/save-preserving-params, memory sync/restore, backup export/import merge/replace, and cloud `CompactTask` upload/download
- [ ] 2.11 Add failing import-provenance tests proving remote/imported authority is preserved for audit but cannot submit, and only valid acknowledged remote jobs may become query-only recoverable
- [ ] 2.12 Add failing integration tests for single, batch, AI input/MCP queue, workflow, PPT, plugin, SW capability, retry, cancellation, and recovery entry points
- [ ] 2.13 Add focused FramePanel and ComicCreator tests proving their generic IndexedDB pollers are removed while PPT cancellation, Comic partial multi-image success, ordering, and cancellation remain correct

## 3. Implementation (Approval Required)

- [ ] 3.1 After explicit approval, define versioned in-row lifecycle/attempt types, canonical artifacts, typed reads, transition conflicts, dispatch/query outcomes, and sanitized diagnostics
- [ ] 3.2 After explicit approval, add `imageLifecycle.version=1` to the existing task row and canonical task types without changing database version 1, stores, or indexes
- [ ] 3.3 After explicit approval, implement the coordinator/facade and single-transaction task/attempt/revision compare-and-swap as the only task-backed image lifecycle writer
- [ ] 3.4 After explicit approval, implement one-shot dispatch reservation/token/reservation-and-operation-deadlines/consumption, non-authorizing local executor/session heartbeat projection, and renewable query-only polling leases as distinct concepts
- [ ] 3.5 After explicit approval, split adapters into lifecycle-pure typed `submit`/`query`, remove adapter-side task completion, and prohibit query-to-submit fallback
- [ ] 3.6 After explicit approval, implement synchronous token-matched direct completion and background-delay fencing without IndexedDB completion polling
- [ ] 3.7 After explicit approval, commit async `remoteId`/route acknowledgement before acquiring a polling lease or issuing the first query
- [ ] 3.8 After explicit approval, implement bounded storage recovery and immediate post-create missing-record convergence
- [ ] 3.9 After explicit approval, preserve lifecycle fields through task reader/writer converters, task queue memory/persistence, complete-task DTOs, backup/import, and paged cloud sync
- [ ] 3.10 After explicit approval, migrate every task-backed entry point, explicitly replacing FramePanel and ComicCreator `waitForTaskCompletion` calls with coordinator handles/results
- [ ] 3.11 After explicit approval, add structured lifecycle observability with credential, prompt, base64, byte, and provider-payload redaction
- [ ] 3.12 After explicit approval, update architecture, data-format, rollback, backup/sync, and feature-flow documentation with ownership and extension rules

## 4. Migration

- [ ] 4.1 Add lazy idempotent existing-row migration and fixtures while leaving `aitu-app` at version 1 with its current stores/indexes
- [ ] 4.2 Preserve legacy terminal tasks exactly and recover only active image tasks with a valid route and `remoteId` through query-only ownership
- [ ] 4.3 Convert legacy `processing` image tasks without valid remote recovery to internal interrupted plus outer `failed`/`IMAGE_ATTEMPT_INTERRUPTED`, with no provider submission
- [ ] 4.4 Preserve imported/synced lifecycle snapshots while revoking foreign execution authority and preventing remote/imported dispatch-token consumption
- [ ] 4.5 Prove backup merge/replace and cloud conflict/download paths retain supported lifecycle fields and never turn omission into undispatched authority
- [ ] 4.6 Prove the built v1.0.1 reader opens the post-change version-1 database without `VersionError`, sees compatible outer statuses, and never auto-submits interrupted work
- [ ] 4.7 Canary pass-through converters, lazy migration, single owner, FramePanel/Comic convergence, and legacy-writer removal as separate rollback-gated stages

## 5. Verification

- [ ] 5.1 Run all adapter contract, lifecycle state-machine, dispatch/polling ownership, IndexedDB fault-injection, migration, serialization, and entry-point tests with exact counts and exit codes
- [ ] 5.2 Run browser tests using at least Gemini inline data, GPT base64 JSON, direct URL, multi-image, and asynchronous remote-job fixtures
- [ ] 5.3 Run repeated two-tab/background-throttling tests and prove one provider submission per attempt, heartbeat expiry without authority transfer, delayed matching synchronous completion, query-only lease takeover, and rejection after supersession/terminal decision
- [ ] 5.4 Force provider success followed by missing/storage-error conditions and prove the UI never remains generating until the generic timeout
- [ ] 5.5 Prove async first-query count remains zero until the remote acknowledgement transaction commits and every query path is statically unable to submit
- [ ] 5.6 Round-trip current/terminal/multi-attempt fixtures through reader-writer, backup import/export, and paged cloud sync and compare every lifecycle field
- [ ] 5.7 Run the v1.0.1 rollback-open fixture and verify database version remains 1 with no added store/index
- [ ] 5.8 Run focused typecheck, lint, unit/integration suites, cycle checks, production build, and deployment smoke tests
- [ ] 5.9 Audit logs and telemetry to prove no key, authorization value, raw base64, image bytes, or provider body is emitted
- [x] 5.10 Record that the `openspec` CLI is currently unavailable (`command not found`) and complete strict manual structure/format review
- [ ] 5.11 When the CLI environment is restored, run `openspec validate refactor-image-task-lifecycle --strict` and resolve every finding before approval
