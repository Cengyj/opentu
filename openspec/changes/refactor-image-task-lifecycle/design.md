# Design: Single-owner image task lifecycle

## Context

The current image flow combines two incompatible completion models:

1. The caller creates a durable task and starts tracking it.
2. An adapter route invokes the provider and can write task completion itself.
3. The caller polls IndexedDB to observe the result.
4. A nullable read means either "row is absent" or "storage failed", so polling can continue until the generic timeout even after the provider returned a valid artifact.

The same shared path accepts Gemini inline data, GPT base64 JSON, direct URLs, multiple images, and remote asynchronous jobs. The lifecycle fault therefore crosses providers and UI surfaces. FramePanel and ComicCreator independently call the same generic task-completion poller after creating image tasks, so fixing only the top-level generation service would leave production pollers behind. Browser tabs add a second concurrency domain: an in-process promise queue cannot serialize decisions made in another tab or worker.

`aitu-app` is currently opened explicitly at database version 1 by v1.0.1. Raising the database version for this change would make a rolled-back v1.0.1 bundle call `open(name, 1)` against a newer database and receive `VersionError`. The first lifecycle release therefore has to use additive values inside the existing `tasks` row and prove every conversion/synchronization boundary retains them.

## Goals and Non-Goals

Goals:

- Establish exactly one owner for task-backed image lifecycle transitions.
- Return synchronous provider results without using IndexedDB polling as an in-process response channel.
- Make storage absence, storage failure, provider failure, cancellation, interruption, and timeout distinguishable.
- Prevent duplicate provider submission and stale-attempt completion across retries, reloads, tabs, and workers.
- Separate irreversible provider-submit authority from renewable asynchronous query ownership.
- Preserve recoverable asynchronous jobs and existing terminal history through migration.
- Remain safely openable by v1.0.1 after rollback without a database-version downgrade.
- Preserve lifecycle/attempt facts through reader, writer, memory, backup, import, and cloud-sync round trips.
- Make all provider result shapes pass through one tested normalization and materialization boundary.
- Prove parity across all production image entry points, not only one model or screen.

Non-goals:

- Change provider selection, model capability discovery, prompts, pricing, or image quality.
- Replace the global task concurrency policy, Service Worker transport, workflow engine, or startup-loading architecture.
- Add an IndexedDB object store/index or raise `aitu-app` above version 1 in the first release.
- Require direct, non-task utility callers to create visible queue records.
- Store proposal-time credentials, base64 payloads, generated images, or production request bodies.
- Guarantee automatic recovery after a provider accepted a request but supplied neither an idempotency mechanism nor a recoverable remote identifier.

## Invariants

- The coordinator/facade is the only component permitted to transition a task-backed image attempt.
- An adapter performs provider I/O and returns a typed outcome; it never writes task storage or UI/application state.
- Before the durable create transaction commits, the provider request count is exactly zero.
- Every mutable write is scoped by `taskId`, `attemptId`, expected `revision`, and allowed predecessor state.
- The read, predicate check, and write for a transition occur in one IndexedDB `readwrite` transaction.
- One attempt may consume at most one durable `dispatchToken`; neither wall-clock expiry nor polling-lease takeover recreates submit authority for that attempt.
- A dispatch reservation that expires before its token is consumed proves provider request count zero and may be replaced; a consumed token can only complete, reconcile, or become terminal.
- A retry always creates a new `attemptId`; it never reopens a terminal attempt.
- A terminal attempt never returns to an active state and one terminal result never overwrites another.
- Progress, result, error, dispatch, lease, and remote-query events from an old attempt are rejected.
- IndexedDB is durable state and recovery evidence, not a response bus for synchronous provider calls.
- The renewable lease authorizes only `query` of an already-persisted remote job; it never authorizes `submit`.
- The unique synchronous response matching the current attempt and consumed dispatch token may CAS completion without a live polling lease, unless a superseding attempt or terminal decision already committed.
- A possibly dispatched provider request is never automatically resubmitted unless idempotency or authoritative provider reconciliation proves that doing so is safe.

## Lifecycle Model

Each task contains stable user-facing identity. Each execution contains an immutable `attemptId` and monotonic lifecycle `revision`. The first release stores one optional value on the existing task row:

```text
imageLifecycle = {
  version: 1,
  revision,
  currentAttemptId,
  attempts: [
    {
      attemptId,
      state,
      route,
      dispatch: { ownerId, sessionId, token, reservationDeadline, operationDeadline, consumedAt?, acknowledgedAt? },
      remote: { remoteId, route }?,
      pollingLease: { ownerId, leaseRevision, expiresAt }?,
      progress?,
      terminal?
    }
  ]
}
```

Field names may be refined during approved implementation, but the versioned value MUST represent these logical facts:

- task identity and task kind
- attempt identity and lifecycle state
- normalized provider/model route needed for recovery
- dispatch state: `not-started`, `reserved`, `dispatching`, or `acknowledged`, plus one-shot dispatch owner/session, token, reservation deadline, provider-operation decision deadline, and consumption time
- provider idempotency key when supported
- remote job identity when acknowledged asynchronously
- renewable query-only polling lease owner, expiry, and lease revision
- progress and terminal result/error/cancellation/interruption facts
- schema version and legacy migration marker

The active lifecycle is `queued` to `processing`. Terminal outcomes are `completed`, `failed`, `cancelled`, or `interrupted`, preserving the repository's existing `completed` success spelling. A retry creates a new queued attempt linked to the prior terminal attempt for history; it does not mutate that history.

The existing outer task fields remain a compatibility projection of the current attempt. `queued` projects to `pending`; submitting or querying projects to `processing`; `completed`, `failed`, and `cancelled` retain their existing outer spellings. Internal `interrupted` projects to outer `status='failed'` with stable `error.code='IMAGE_ATTEMPT_INTERRUPTED'`. The current acknowledged asynchronous identity projects to the existing `remoteId` and `invocationRoute` fields. Old readers can therefore render and safely retry history without learning a new outer status.

## First-Release Storage Compatibility

The first release MUST leave `APP_DB_NAME='aitu-app'`, `DB_VERSION=1`, and the existing object stores/indexes unchanged. It adds no `onupgradeneeded` work. Lifecycle initialization and legacy conversion are lazy, idempotent row transformations performed by the coordinator's normal single-row CAS transaction.

This is a data-shape version, not an IndexedDB schema version. A v1.0.1 rollback can still open database version 1 and ignores the unknown optional `imageLifecycle` property. Rollback compatibility is proven with the built v1.0.1 open behavior, not inferred from TypeScript assignability. Any future object store/index or IndexedDB version bump requires a separate migration proposal with old-client coordination.

All lifecycle mutations start from the raw stored row and preserve unrelated/unknown fields. An unsupported future `imageLifecycle.version` is preserved opaquely and is not executed. Losing or silently defaulting the field at a conversion boundary is a correctness failure because it could erase consumed dispatch authority.

### Atomic transition protocol

For every transition, the coordinator opens one `readwrite` transaction on the existing `tasks` store, loads the current raw row, verifies the expected attempt, revision, predecessor state, and operation-specific authority, writes the next state with `revision + 1`, and commits. A failed predicate returns a typed conflict and performs no partial write.

Provider network I/O MUST NOT occur inside the IndexedDB transaction. The coordinator first atomically reserves a unique dispatch token with a short reservation deadline and a provider-operation decision deadline derived from the selected route's transport timeout. Immediately before network submission, the token holder CAS-consumes that reservation (`reserved` to `dispatching`). Only a still-current, unexpired, unconsumed reservation may be consumed. Once consumption commits, that attempt can never mint another dispatch token, regardless of timer throttling, owner loss, deadline passage, or polling-lease expiry.

If a reservation deadline expires before consumption, the stored absence of `consumedAt` proves no provider request was authorized and a contender may atomically replace it. The unavoidable crash window after consumption but before network submission is handled as ambiguous dispatch; safety chooses no automatic replay.

A synchronous provider response carries the consumed `dispatchToken` back to the coordinator. On CAS conflict, the coordinator may reread and retry the terminal CAS only while `currentAttemptId` and token still match, the dispatch remains the unique consumed dispatch, and no terminal/superseding decision exists. Passage of the reservation or operation deadline and any polling-lease state are insufficient by themselves to reject the response: the lifecycle timeout/interruption transition must win a terminal CAS first. Background throttling alone cannot discard a valid unique response. A cancellation, timeout/interruption decision, or new retry attempt that commits first fences the response out.

### Ambiguous dispatch

The provider idempotency key, when supported, is derived from stable task and attempt identity and is reused only for safe reconciliation of that same attempt. If execution is lost after dispatch-token consumption but before an acknowledgement/result is stored:

- an authoritative remote lookup or provider idempotency contract MAY resume the same attempt;
- a stored `remoteId` and valid route MAY resume provider polling after lease acquisition;
- otherwise the attempt becomes `interrupted` with a user-visible retry action and MUST NOT be submitted again automatically.

This trades automatic replay for protection against duplicate billing and duplicate artifacts when provider acceptance is unknowable.

## Adapter and Artifact Contracts

The adapter boundary is lifecycle-pure: adapters may perform provider network I/O and provider-specific parsing, but static dependency rules forbid imports of the task reader/writer, coordinator internals, task queue/application stores, React/UI state, or lifecycle event emitters.

Every image adapter exposes typed `submit`. An adapter that can return a remote job also exposes a separate typed `query`:

- `submit` returns synchronous success with one or more normalized artifact descriptors, asynchronous acceptance with a stable remote identifier and poll route, typed provider failure, or cancellation/abort acknowledgement;
- `query` accepts only a previously acknowledged `remoteId` plus normalized route and returns pending progress, canonical completion artifacts, typed remote failure, or cancellation;
- `query` MUST NOT call a provider submission endpoint, synthesize a new remote job, or fall back to `submit`.

The shared artifact materializer converts provider payload variants into the application's canonical artifact representation. It MUST cover Gemini `inlineData` and `inline_data`, GPT `b64_json`, direct URLs, ordered multi-image payloads, and URLs returned by asynchronous polling. Provider-specific parsing remains inside an adapter parser, but durable state and UI consumers receive only the canonical type.

A direct non-task caller MAY invoke the same adapter facade and receive the canonical result without creating a durable task. It MUST NOT call the task lifecycle writer. Any caller that exposes queue state, recovery, retry, background execution, or task progress is task-backed and MUST use the coordinator.

## Synchronous and Asynchronous Completion

For synchronous providers, the coordinator consumes dispatch authority, awaits adapter `submit`, materializes its artifacts, atomically writes terminal success using the matching attempt and dispatch token, and returns the same canonical result directly to the initiating caller. The caller does not poll IndexedDB to receive that result. A background-delayed response retains this token-scoped completion right until the attempt is superseded or terminally decided.

For genuinely asynchronous providers, adapter `submit` returns acceptance. Before any `query`, the coordinator atomically verifies the current attempt and dispatch token and stores `remoteId`, normalized recovery route, `acknowledgedAt`, outer compatibility fields, and the next revision in the existing task row. Query call count MUST remain zero until that transaction completes.

After acknowledgement commit, a renewable polling-lease owner calls adapter `query`. Each query result is normalized and guarded by attempt, revision, `remoteId`, and current polling-lease authority before durable progress or completion. IndexedDB supports reload and query ownership transfer, while only the provider is queried for remote progress. A query owner can be replaced after lease expiry; replacement can query the same remote job but can never invoke `submit` for that attempt.

## Storage Read and Recovery Semantics

Task reads return a strict discriminated result:

- `found`: includes the record and revision;
- `missing`: the transaction succeeded and no row exists;
- `storage-error`: the transaction failed and includes a sanitized diagnostic category.

After durable task creation has committed, `missing` is an invariant violation. The active operation MUST converge immediately to an explicit task-state error; it MUST NOT continue a fifteen-minute polling loop.

`storage-error` uses a separate finite storage-recovery budget with bounded backoff and observability. It does not consume provider retry allowance and cannot trigger another provider submission. Budget exhaustion produces an explicit recoverable storage failure instead of pretending the task is merely absent.

## Dispatch Authority and Polling Ownership

Provider submission and remote-job querying have different safety properties and MUST NOT share one renewable lease.

Dispatch authority is one-shot durable state. Reservation, both deadline facts, token consumption, acknowledgement, and terminal resolution use atomic compare-and-swap. Expiration of the reservation before consumption permits replacement because the provider request count is provably zero. The operation deadline indicates when the lifecycle may attempt a timeout/interruption decision; it does not itself write terminal state. After consumption, no deadline, timer, or owner change can reset dispatch to `not-started`; only the matching response, tested reconciliation, or a terminal CAS may resolve it.

Polling ownership is a renewable lease acquired only after `remoteId` and route have committed. Its owner identity distinguishes tabs/workers and its expiry uses a bounded duration. A contender may take over `query` only after proving lease expiry. Losing the polling lease stops further query calls and rejects late query writes, but it does not invalidate a separately token-matched synchronous submit response and never creates dispatch permission.

While a consumed synchronous dispatch is in flight, its local executor/session publishes liveness keyed by task, attempt, dispatch token, and session. This heartbeat is a read-only ownership projection for task safety and version-upgrade classification; it is not a lease, cannot be transferred, and grants no submit or result-write authority. Missing/expired heartbeat does not reset dispatch, reject the unique token-matched response, or prove the request is stale. Only a guarded terminal/superseding lifecycle transition resolves that uncertainty.

The recommended approval defaults are centralized named configuration: a 30-second dispatch reservation deadline; a persisted operation deadline derived from and never shorter than the selected provider transport timeout; local submit heartbeat every 15 seconds with a 90-second freshness window plus immediate start/progress/visibility-resume signals; and a 120-second polling-lease TTL renewed no later than every 30 seconds while querying. Page/worker code revalidates immediately after visibility/resume, before consuming dispatch, before each query, and before each query-derived write. Tests use a fake clock and delayed events at 15, 30, 60, 89, 91, 119, and 121 seconds, including a response after deadline passage but before a terminal decision. Changing values requires measurement and contract-test updates, not scattered constants.

Queue admission limits remain owned by `enforce-task-queue-concurrency-limit`. Dispatch authority answers whether this attempt may submit once; the polling lease answers who queries an acknowledged remote job. Transport events remain hints: every receiver revalidates the relevant durable authority before acting.

The coordinator exposes a read-only `TaskExecutionOwnershipSnapshot` containing current task/attempt/revision, consumed dispatch plus matching session-heartbeat freshness, acknowledged remote identity plus query lease, recovery eligibility, terminal decision, and typed read outcome. It contains no prompt, artifact, credentials, or provider payload. Consumers such as version-upgrade convergence cannot mutate lifecycle state through this projection.

## Legacy Migration

Migration is deterministic and idempotent:

- Existing terminal image tasks retain their exact terminal state, history, artifacts, and timestamps.
- An active legacy image task with a valid provider route and `remoteId` becomes recoverable and may resume provider polling after acquiring a lease.
- A legacy `processing` image task without `remoteId` MUST NOT cause a new provider submission; its internal current attempt becomes `interrupted`, while outer compatibility fields become `status='failed'` and `error.code='IMAGE_ATTEMPT_INTERRUPTED'` with a clear retry action.
- Malformed or unsupported legacy routes use the same explicit internal-interrupted/outer-failed projection rather than silently disappearing.
- Non-image tasks are unchanged by this migration.

The migration runs lazily inside an existing-row transaction before the new executor claims legacy work; it does not open an upgrade transaction or create a store/index. Rollback readers see only existing outer statuses. The outer failed/error projection MUST prevent v1.0.1 from interpreting an interrupted row as active dispatch permission.

### Backup, import, and cloud provenance

Terminal attempt history and all supported version-1 lifecycle fields round-trip through backup and paged cloud formats. Imported active authority is data, not local execution permission. Backup import and cloud restore retain the source snapshot for audit, then perform an explicit normalization: a remote-synced row remains `syncedFromRemote` and cannot execute; an imported active row is either query-only recoverable through a valid `remoteId`/route under approved local recovery or becomes internal interrupted/outer failed. Imported dispatch tokens are never consumed locally to call `submit`.

Unknown future lifecycle versions are retained opaquely where the enclosing format supports them and classified non-executable. Conversion must never silently erase a known consumed token and then reinterpret the task as undispatched.

## Lifecycle Field Preservation Matrix

The optional versioned field MUST be represented and preserved at every whole-task boundary:

- persisted `SWTask` and the canonical in-memory `Task` type;
- `task-storage-reader.ts` raw row type and `convertSWTaskToTask`;
- `task-storage-writer.ts`, task-queue `convertToSWTask`, `saveTask`, `saveTaskPreservingParams`, and merge/update paths;
- task-queue storage-to-memory synchronization and restore/retry snapshots;
- raw backup export sanitization, `normalizeTaskRecord`, backup import, merge, and replace modes;
- GitHub paged sync `CompactTask`, `compactTask`, `compactToTask`, sync-version/change detection, page upload/download, and `syncedFromRemote` normalization;
- any Service Worker/page capability DTO that carries a complete task.

Round-trip tests compare lifecycle `version`, revision, current attempt, every attempt ID/state, dispatch token/consumption fact, remote identity/route, polling-lease history, and terminal facts. Runtime-only owner freshness may be deliberately revoked on import, but that normalization must be explicit and tested; accidental omission is not migration.

## Entry-Point Convergence

The implementation inventory and acceptance suite MUST include:

- single-image generation;
- batch/multi-image generation;
- AI input and MCP queue generation;
- workflow image nodes;
- PPT image generation;
- FramePanel PPT generation, including replacement of `FramePanel.tsx`'s `waitForTaskCompletion` call with the coordinator execution handle/result;
- Comic page/variant generation, including replacement of `ComicCreator.tsx`'s per-task `waitForTaskCompletion` calls while preserving partial multi-image success and cancellation;
- plugin image generation;
- Service Worker capability handlers;
- retry, reload recovery, cancellation, lease transfer, and legacy recovery.

Every task-backed path must be proven to cross the same facade. An initiating caller awaits the coordinator's execution handle/result; a detached/reloaded observer subscribes to the coordinator's typed durable projection. Neither path uses generic IndexedDB completion polling. Static dependency checks and contract tests SHALL prevent future entry points and adapters from importing lifecycle write internals in a way that creates a second owner.

## Observability

Structured diagnostics SHALL include task kind, attempt/revision, lifecycle transition, sanitized provider route identity, lease event, read outcome, recovery-budget outcome, and terminal category. They MUST exclude credentials, authorization headers, raw base64, image bytes, prompts unless separately approved, and provider payload bodies.

Metrics SHALL distinguish provider latency from storage recovery time and UI delivery latency. Timeout metrics alone are insufficient because they conceal a provider success followed by a local-state failure.

## Provider Success with Persistence Failure

The recommended approval default is artifact-first but durability-truthful. Once the adapter and materializer have produced valid canonical artifacts, the initiating live context returns/displays them even if the bounded terminal-write recovery budget is later exhausted. The UI exits the generating state and clearly reports that the image was generated but task history could not be saved, offers immediate download/export, and warns that reload may lose the unsaved result. It MUST NOT claim durable task success or invoke the provider again.

The coordinator continues only its finite storage recovery attempts. If persistence later commits, the warning clears from the matching attempt. A context that has no deliverable live client retains the same no-resubmission rule and records sanitized recovery diagnostics; it cannot invent a successful durable row.

## Risks and Mitigations

- Additive row-shape and migration complexity: keep IndexedDB version 1/store layout unchanged, use idempotent fixtures for every legacy class, and retain rollback-readable outer fields.
- Background throttling expires a timer during synchronous submit: never derive submit authority from the polling lease; accept the unique token-matched response while the attempt is still current and undecided.
- Duplicate submission at a crash boundary: reserve dispatch durably, use provider idempotency where available, and interrupt rather than guess when acceptance is ambiguous.
- Conversion or cloud compaction drops a consumed token: add exhaustive field-preservation tests and treat unknown/missing lifecycle on a coordinator-created row as an invariant failure, never as undispatched permission.
- An async adapter queries before recovery facts commit: split `submit`/`query` and assert query count zero until the `remoteId` transaction completes.
- A missed entry point retains old behavior: maintain a complete call-site inventory plus static import and integration tests.
- Provider shape drift: isolate shape parsing behind adapter contract tests and keep the canonical artifact type stable.
- Storage outage masks a successful call: return the canonical result to the initiating synchronous caller while surfacing durable persistence failure according to the approved UX; never label it as still generating.

## Rollout and Rollback

Roll out behind versioned in-row `imageLifecycle`. First ship types/converters capable of lossless pass-through while leaving `aitu-app` at version 1, then enable lazy row migration and the single-owner executor, migrate FramePanel/Comic pollers, and only then remove legacy write paths after telemetry confirms zero usage. Canary tests must cover two tabs, worker/page handoff, background-throttled synchronous response, async acknowledgement-before-query, each result representation, backup/cloud round trips, v1.0.1 open-after-write, and provider success followed by forced storage failure.

Rollback disables new claiming and loads v1.0.1-compatible outer task projections without deleting versioned attempt history. Because database version/store/index never changed, v1.0.1 can open `aitu-app` version 1 without `VersionError`. Active ambiguous/interrupted attempts project as failed and rollback never grants permission to resubmit them automatically. Any future destructive cleanup or IndexedDB schema upgrade requires a separate approved change.

## Recommended Approval Defaults

- Dispatch: approve a 30-second unconsumed reservation deadline, a persisted operation deadline no shorter than the selected provider transport timeout, and 15-second/90-second local executor heartbeat target/freshness for classification only; once consumed, the token is one-shot and never recreated for the same attempt. A matching synchronous response remains CAS-eligible after deadline, heartbeat, or lease expiry until superseded or terminally decided.
- Polling: approve the centralized 120-second query-only lease TTL, 30-second renewal target, resume revalidation, and fake-clock boundary suite described above.
- Storage recovery: approve four total terminal-write attempts within 15 seconds using bounded jittered backoff; exhaustion returns the explicit artifact-plus-durability-warning state and never consumes provider retries.
- Ambiguous dispatch: default every provider to "no proven idempotency". An adapter may opt in only with a provider-specific contract test proving stable-key replay or authoritative remote lookup.
- Artifact delivery: show already materialized artifacts to the initiating live client with an explicit unsaved-history warning and immediate export action; do not claim durable success.
- Legacy active rows without `remoteId`: mark interrupted and require a user-created new attempt; never auto-submit.
- Storage layout: approve `imageLifecycle.version=1` inside the existing task row with no `aitu-app` version bump, new store, or new index in the first release; internal interrupted projects as outer failed plus `IMAGE_ATTEMPT_INTERRUPTED`.
