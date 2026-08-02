# Change: Refactor image task lifecycle ownership

## Why

Image generation currently has more than one lifecycle owner. A task-backed caller creates and tracks a task, an adapter route can execute the provider and complete the same task, and the original caller then polls IndexedDB to rediscover the result it already initiated. The storage reader also collapses both a missing record and an IndexedDB failure to `null`, while the poller treats `null` as a reason to keep waiting. This verified control flow allows a successfully returned Gemini inline image, GPT base64 image, URL image, or other provider result to remain "generating" until the generic timeout.

This is a provider-independent architecture defect. Adding another model-specific completion patch would preserve duplicate ownership, cross-tab races, stale-attempt writes, and ambiguous recovery. A single durable lifecycle contract is required before further image providers or entry points are added.

## What Changes

- Introduce one provider- and model-independent image task coordinator as the sole owner of durable task state transitions.
- Make provider adapters expose lifecycle-pure typed `submit` and, for remote jobs, `query` operations; adapters MUST NOT mutate task storage, application memory state, or UI state.
- Route every task-backed image generation entry point through the coordinator/facade while allowing genuinely direct, non-task callers to reuse the same adapter result-normalization boundary.
- Persist a durable task attempt before any provider request, then guard every transition with `taskId`, `attemptId`, and monotonic `revision` compare-and-swap in one IndexedDB `readwrite` transaction.
- Separate synchronous provider completion from genuinely asynchronous provider polling. Synchronous results return directly to the coordinator; only remote asynchronous jobs poll the provider.
- Replace nullable task reads with `found`, `missing`, and `storage-error` outcomes and give storage recovery its own finite budget.
- Separate one-shot durable dispatch authority (`dispatchToken`, reservation deadline, and provider-operation decision deadline) from the renewable cross-tab polling lease. Polling-lease expiry MUST NOT authorize another provider submission.
- Allow the one synchronous response matching the current `attemptId` and consumed `dispatchToken` to CAS its result even after background throttling makes a timer/lease appear expired, unless the attempt was superseded or a terminal decision already won.
- Reject late progress, result, and error writes from superseded attempts, and make all terminal states irreversible.
- Define safe crash and retry semantics, including ambiguous dispatch handling that never silently resubmits a possibly billed provider request.
- Store versioned `imageLifecycle` and attempt history additively inside the existing `aitu-app/tasks` row in the first release, without raising database version 1 or adding an object store/index that would make a v1.0.1 rollback fail with `VersionError`.
- Migrate legacy image tasks according to their terminal state, remote identity, and recoverable route instead of blindly replaying `processing` rows; project internal `interrupted` as legacy outer `status=failed` with a stable error code.
- Commit an asynchronous submit acknowledgement (`remoteId` plus recovery route) before the first adapter `query`, so recovery can query but never resubmit.
- Use one artifact materializer for Gemini `inlineData`/`inline_data`, GPT `b64_json`, URL results, multi-image results, and asynchronously returned URLs.
- Remove the explicit IndexedDB completion pollers in FramePanel and ComicCreator as part of entry-point convergence, rather than leaving those consumers on the old response channel.
- Preserve `imageLifecycle` fields through task reader/writer conversions, in-memory task projection, backup export/import, and paged cloud synchronization.
- Add contract and integration coverage for every known image entry point, retry/recovery path, multi-tab ownership path, rollback/import path, and supported result representation.

## Impact

- Affected specs: image-task-lifecycle (new)
- Affected code: image generation facade/service, provider adapter contracts and fallback routes, task writer/reader/converters/poller, existing IndexedDB task-row data, retry/recovery orchestration, Service Worker capability handling, FramePanel, ComicCreator, backup import/export, GitHub paged task sync, and image-generation entry points across Drawnix
- User-visible result: a successfully normalized image reaches a terminal success without waiting for an unrelated IndexedDB polling timeout; unrecoverable storage and ownership failures become explicit, bounded errors
- Provider scope: Gemini, GPT image models, URL-returning providers, asynchronous remote-job providers, plugins, and future providers using the shared contract
- Data impact: additive versioned `imageLifecycle` data inside each existing task row; database version remains 1 and no store/index is added in the first release; existing terminal history is preserved
- Operational impact: rollout requires migration telemetry and rollback compatibility; implementation is blocked pending approval

## Verified Evidence

- `packages/drawnix/src/services/media-executor/task-polling.ts:76-81` continues polling when no task record is returned.
- `packages/drawnix/src/services/task-storage-reader.ts:794-800` converts an IndexedDB read failure into the same nullable outcome used for a missing record.
- `packages/drawnix/src/services/media-generation/image-generation-service.ts:119-191` creates/tracks a task, invokes adapter execution, and then polls IndexedDB for completion.
- `packages/drawnix/src/services/media-executor/fallback-adapter-routes.ts:144-200` executes the adapter and then reaches adapter-route-owned durable completion (`completeTask` at lines 195-200).
- `packages/drawnix/src/components/project-drawer/FramePanel.tsx:3123-3149` waits for task completion through the same generic IndexedDB poller after creating a PPT image task.
- `packages/drawnix/src/components/comic-creator/ComicCreator.tsx:1742-1767` polls every generated page-image task through `waitForTaskCompletion` before consuming variants.
- `packages/drawnix/src/services/app-database.ts:13-45` defines `aitu-app` database version 1 and opens it with that explicit version, so a first-release database-version bump would make rollback code opening version 1 fail.
- `packages/drawnix/src/services/task-storage-reader.ts:187-223` and `packages/drawnix/src/services/task-queue-service.ts:450-467` explicitly enumerate fields while converting stored and in-memory tasks, so a new lifecycle field is otherwise dropped.
- `packages/drawnix/src/services/backup-restore/backup-export-service.ts:317-337` exports raw task rows, while `backup-import-service.ts:669-708,784-804` normalizes/imports them; both must preserve the versioned lifecycle value while applying explicit import authority rules.
- `packages/drawnix/src/services/github-sync/task-sync-service.ts:51-118,527-580` and `github-sync/types.ts:284-320` compact and expand an explicit task field set, so paged cloud sync needs a versioned lifecycle field and change-detection coverage.
- The task writer's process-local serialization queue does not coordinate separate browser tabs, and its read/decision/write sequence is not one cross-tab atomic compare-and-swap transaction.
- The duplicated path is shared infrastructure, so the failure is not confined to `gpt-image-2` or `gemini-3.1-flash-image-preview`.

## Online Verification Boundary

Fresh Chromium against the deployed 1.0.1 bundle produced the following task-correlated evidence:

- Task `2110e269-df8f-4e3b-91a3-f62323d674c9` submitted `gemini-3.1-flash-image-preview` through the legacy For profile to `/v1/images/generations`. The provider returned HTTP 500 `convert_request_failed` (`only imagen models are supported`); memory and IndexedDB both converged to `failed` in under one second.
- Task `2e4efc61-e891-4d6d-9499-c9246ac90861` submitted `gpt-image-2`. The provider returned HTTP 403 `insufficient_user_quota`; memory and IndexedDB both converged to `failed` in under one second.
- Task `d1aba0bd-30e8-4b7a-9210-236117350bd3` used an explicitly saved `gemini-compatible` profile and sent `/v1beta/models/gemini-3.1-flash-image-preview:generateContent`. No response headers arrived during the 180-second observation window, and memory plus IndexedDB remained `processing/submitting`. The browser context then closed, so this proves only a provider response-head stall of at least 180 seconds, not a provider terminal outcome.
- A previously authorized key listed no image models and task `cfde0a8e-e5b5-4a6f-95bc-e3e6c58d4662` received HTTP 503 `model_not_found` for `gpt-image-2`; memory and IndexedDB converged to `failed` in under one second.

None of the authorized live credentials produced an HTTP 200 image/base64 response, so these provider calls do **not** reproduce the reported "200 base64 followed by stuck UI" condition and are not presented as if they did.

A separate controlled provider-response fixture kept the deployed 1.0.1 bundle, normal image UI, task creation, IndexedDB, Cache Storage, anchor, post-processing, and canvas insertion unchanged, and intercepted only the actual `/v1/images/generations` response with a valid 70-byte PNG in `b64_json`. For task `0d1fccb9-c1d8-479f-b238-ab9d2ff71820`, the response arrived at +505 ms, memory reached `completed` at +522 ms, IndexedDB was `completed`, the anchor entered `developing` at +536 ms, direct insertion completed at +5.553 s, and the anchor disappeared at +7.176 s. The cached PNG hash matched the decoded fixture and `insertedToCanvas=true`.

That controlled result proves the deployed 1.0.1 `b64_json` success path can converge end to end. It does not remove the independently verified nullable-read/polling/owner-split defect, and it does not prove which defect occurred in a different existing browser profile without that profile's same-task snapshots.

No credential, provider response body, generated base64 payload, or user image is retained in this proposal.

## Coordination

This change owns image-task lifecycle state, attempt identity, storage read semantics, leases, and provider-result delivery. It MUST coordinate without modifying the independent scopes of:

- `enforce-task-queue-concurrency-limit` for global queue admission and concurrency policy
- `fix-task-queue-external-cancellation` for externally initiated cancellation semantics
- `fix-main-thread-workflow-recovery-sync` for workflow recovery synchronization
- `refactor-sw-duplex-comm` for transport mechanics between page and Service Worker
- `refactor-startup-shell-loading` for startup graph and deferred-loading budgets
- `harden-version-upgrade-convergence` as a read-only consumer of current attempt, consumed-dispatch/session-heartbeat, remote-query lease, recovery, and terminal facts

Where those changes need lifecycle facts, they SHALL consume this coordinator's typed public state rather than create another writer.

## Approval Gate

Implementation MUST NOT begin until the user approves the lifecycle ownership boundary, version-1 in-row data model, legacy/rollback/import projection rules, one-shot dispatch authority, renewable polling lease, ambiguous-dispatch behavior, and full-entry-point acceptance matrix.
