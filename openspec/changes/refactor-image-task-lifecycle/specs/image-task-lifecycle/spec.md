## ADDED Requirements

### Requirement: Single lifecycle owner

The system SHALL use one provider- and model-independent coordinator as the sole owner of durable lifecycle transitions for every task-backed image generation attempt. Provider adapters MUST expose typed normalized `submit` and, where applicable, `query` outcomes and MUST NOT write task storage, application memory state, or UI state.

#### Scenario: Synchronous adapter returns an image

- **WHEN** a task-backed image adapter returns a normalized synchronous image result
- **THEN** the coordinator SHALL persist the guarded terminal transition
- **AND** the initiating caller SHALL receive the canonical result directly
- **AND** the adapter SHALL perform no task or UI state mutation

#### Scenario: A new task-backed entry point is added

- **WHEN** an image entry point exposes queue state, progress, retry, background execution, or recovery
- **THEN** it SHALL execute through the shared coordinator/facade
- **AND** it SHALL NOT introduce another lifecycle writer

#### Scenario: A direct non-task caller generates an image

- **WHEN** a caller explicitly does not expose task state, retry, background execution, or recovery
- **THEN** it MAY call the shared adapter facade without creating a task
- **AND** it SHALL reuse the same normalized adapter and artifact contracts

#### Scenario: Adapter crosses a lifecycle boundary

- **WHEN** static dependency validation analyzes an image adapter
- **THEN** the adapter SHALL have no import path to task readers/writers, coordinator internals, task/application stores, or UI lifecycle state
- **AND** provider network I/O SHALL return only the typed adapter outcome

### Requirement: Durable creation precedes provider dispatch

The system SHALL commit durable task and attempt identity before invoking a provider. The number of provider requests before that create transaction commits MUST be zero.

#### Scenario: Durable task creation fails

- **WHEN** IndexedDB cannot commit the initial image task attempt
- **THEN** the system SHALL return an explicit storage creation failure
- **AND** it SHALL send zero requests to the provider

#### Scenario: Durable task creation succeeds

- **WHEN** the initial task and attempt transaction commits
- **THEN** the coordinator MAY atomically reserve one dispatch token, reservation deadline, and provider-operation decision deadline for that attempt
- **AND** only the owner that CAS-consumes the current unexpired token MAY invoke provider `submit`

#### Scenario: Dispatch reservation expires before consumption

- **GIVEN** the current reservation has no committed consumption fact
- **WHEN** its reservation deadline expires
- **THEN** the coordinator MAY atomically replace it with a new dispatch token
- **AND** provider request count for the expired token SHALL remain zero

### Requirement: Attempt-scoped atomic transitions

Every mutable image task transition SHALL verify `taskId`, `attemptId`, expected monotonic `revision`, allowed predecessor state, and its operation-specific dispatch token or polling authority in one IndexedDB `readwrite` transaction on the existing task row. A retry MUST create a new attempt identity.

#### Scenario: Two contexts write the same revision

- **WHEN** two tabs or workers try to transition the same attempt from the same revision
- **THEN** exactly one compare-and-swap SHALL commit
- **AND** the losing transition SHALL return a typed conflict without a partial write

#### Scenario: A previous attempt completes after retry

- **WHEN** progress, result, error, or cancellation from an older attempt arrives after a retry created a new attempt
- **THEN** the system SHALL reject the stale event
- **AND** the current attempt and visible result SHALL remain unchanged

### Requirement: Irreversible terminal outcomes

An image attempt in `completed`, `failed`, `cancelled`, or `interrupted` state MUST NOT return to an active state or be overwritten by a different terminal outcome.

#### Scenario: Late error follows success

- **WHEN** an attempt has committed `completed` and a late error arrives
- **THEN** the late error SHALL be rejected
- **AND** the successful artifacts SHALL remain authoritative

#### Scenario: User retries a terminal attempt

- **WHEN** a user retries a failed, cancelled, or interrupted attempt
- **THEN** the system SHALL create a new queued attempt with a new `attemptId`
- **AND** it SHALL preserve the prior terminal attempt as history

### Requirement: Explicit synchronous and asynchronous paths

The system SHALL return synchronous `submit` results directly through the coordinator and SHALL use adapter `query` only for genuinely asynchronous acknowledged remote jobs. IndexedDB MUST NOT be used as an in-process completion response channel.

#### Scenario: Provider responds with inline or URL artifacts

- **WHEN** a provider synchronously returns all image artifacts
- **THEN** the coordinator SHALL normalize, CAS-persist, and return those artifacts using the matching attempt and consumed dispatch token
- **AND** it SHALL NOT poll IndexedDB for completion

#### Scenario: Provider acknowledges a remote job

- **WHEN** a provider returns a stable remote identifier and valid poll route
- **THEN** the coordinator SHALL CAS-persist that acknowledgement and its outer compatibility projection before any query
- **AND** the current polling-lease owner SHALL query the provider rather than poll IndexedDB for a remote result
- **AND** IndexedDB SHALL remain the durable recovery and ownership source

### Requirement: Asynchronous adapters separate submit from query

Every asynchronous image adapter SHALL expose distinct typed `submit` and `query` operations. `query` MUST accept an already-persisted `remoteId` and route and MUST NOT submit, synthesize, or fall back to creating a provider job.

#### Scenario: Submit accepts a remote job

- **WHEN** adapter `submit` returns an asynchronous acknowledgement
- **THEN** the coordinator SHALL commit `remoteId`, route, acknowledgement, attempt, dispatch token, revision, and outer compatibility fields in one transaction
- **AND** adapter query call count SHALL remain zero until that transaction completes

#### Scenario: First remote query runs

- **GIVEN** the acknowledgement transaction committed successfully
- **WHEN** a current polling owner acquires the query-only lease
- **THEN** adapter `query` MAY request progress for that persisted `remoteId`
- **AND** it SHALL NOT invoke any submit endpoint

#### Scenario: Acknowledgement persistence fails

- **WHEN** the provider returned `remoteId` but its acknowledgement transaction did not commit
- **THEN** the system SHALL issue zero query calls and zero automatic resubmissions
- **AND** it SHALL use storage recovery or ambiguous-dispatch handling for the same attempt

### Requirement: Typed task read outcomes

Every image lifecycle read SHALL distinguish `found`, `missing`, and `storage-error`. The system MUST NOT encode storage failure as a missing record or a nullable success value.

#### Scenario: Created task is unexpectedly missing

- **WHEN** a read transaction succeeds but finds no row after durable creation was confirmed
- **THEN** the operation SHALL converge immediately to an explicit invariant error
- **AND** it SHALL NOT continue polling until the generic image timeout

#### Scenario: IndexedDB read fails transiently

- **WHEN** a task read returns `storage-error`
- **THEN** the coordinator SHALL use a separate finite storage-recovery budget with bounded backoff
- **AND** it SHALL NOT consume provider retries or dispatch another provider request

#### Scenario: Storage recovery budget is exhausted

- **WHEN** the finite storage-recovery budget is exhausted
- **THEN** the system SHALL expose an explicit recoverable storage failure
- **AND** the UI SHALL NOT continue to display an unbounded generating state

#### Scenario: Artifacts exist but terminal persistence is exhausted

- **GIVEN** the adapter and materializer returned valid canonical artifacts
- **WHEN** the bounded terminal-write recovery budget is exhausted
- **THEN** the initiating live UI SHALL display the artifacts and exit the generating state
- **AND** it SHALL explicitly warn that task history was not saved and reload may lose the result
- **AND** it SHALL offer immediate download or export
- **AND** it MUST NOT claim durable success or submit another provider request

### Requirement: One-shot dispatch authority

The system SHALL represent provider submission with one durable dispatch reservation, token, reservation deadline, provider-operation decision deadline, and consumption fact per attempt. A consumed dispatch token MUST NOT be recreated or treated as available because an owner, deadline, timer, tab, worker, or polling lease expired.

#### Scenario: Unconsumed reservation expires

- **GIVEN** a dispatch reservation expired without a committed consumption fact
- **WHEN** a contender verifies the current attempt and revision in one transaction
- **THEN** it MAY replace the reservation with a new token and deadline
- **AND** no provider request SHALL have been authorized by the expired token

#### Scenario: Consumed dispatch loses its owner

- **GIVEN** the current attempt committed consumption of its dispatch token
- **WHEN** the submitting tab is throttled, closes, or loses any polling lease
- **THEN** no context SHALL submit that attempt again
- **AND** the consumed token SHALL remain the attempt's unique dispatch identity

#### Scenario: Dispatch heartbeat becomes stale

- **GIVEN** a local executor/session heartbeat was correlated to the current consumed dispatch token
- **WHEN** browser throttling or suspension makes that heartbeat stale
- **THEN** the heartbeat SHALL cease to prove live ownership but SHALL grant no new submit authority
- **AND** it SHALL NOT invalidate the unique token-matched response or classify the attempt terminal

#### Scenario: Matching synchronous response arrives after background delay

- **GIVEN** a synchronous provider response carries the current attempt's consumed dispatch token
- **AND** the attempt has not been superseded or terminally decided
- **WHEN** the response arrives after a dispatch deadline, heartbeat freshness window, or polling-lease expiry but before any terminal decision committed
- **THEN** the coordinator SHALL reread and CAS the normalized completion against the current attempt, token, revision, and allowed state
- **AND** deadline, heartbeat, timer, or lease expiry alone SHALL NOT reject the unique response

#### Scenario: Matching response arrives after a terminal decision

- **GIVEN** cancellation, failure, timeout/interruption, completion, or a retry attempt already committed
- **WHEN** a response for the previous consumed dispatch token arrives
- **THEN** the coordinator SHALL reject it
- **AND** the current attempt/history SHALL remain unchanged

### Requirement: Renewable lease is query-only

The system SHALL maintain a renewable polling lease only for querying an asynchronously acknowledged remote job. Polling-lease acquisition, renewal, release, and expired takeover MUST use atomic compare-and-swap and MUST NOT grant provider-submit authority.

#### Scenario: A second tab observes a live polling lease

- **WHEN** another tab observes an unexpired lease for the current persisted `remoteId`
- **THEN** it SHALL not query that remote job
- **AND** it SHALL not invoke provider `submit`
- **AND** it MAY observe durable progress until query ownership changes

#### Scenario: A query owner loses its lease

- **WHEN** an executor fails to renew or atomically loses the polling lease
- **THEN** it SHALL stop new query calls and query-derived writes
- **AND** lease loss SHALL NOT create a new dispatch token or invalidate an eligible token-matched synchronous submit response

#### Scenario: A polling lease expires after owner loss

- **WHEN** the stored polling lease is proven expired after `remoteId` and route were committed
- **THEN** one contender MAY atomically acquire query ownership
- **AND** it SHALL query only that persisted remote job without invoking submit

### Requirement: Safe ambiguous-dispatch recovery

The system MUST NOT automatically resubmit an image attempt whose provider acceptance is ambiguous. It MAY resume the same attempt only through a tested provider idempotency contract, authoritative reconciliation, or a persisted remote identifier and valid route.

#### Scenario: Executor stops after dispatch-token consumption without acknowledgement

- **WHEN** an attempt has a consumed dispatch token but no result, `remoteId`, or authoritative reconciliation path and a terminal recovery decision is approved
- **THEN** recovery SHALL mark the internal attempt interrupted with an explicit retry action
- **AND** its outer compatibility projection SHALL be `status='failed'` with `error.code='IMAGE_ATTEMPT_INTERRUPTED'`
- **AND** recovery SHALL NOT issue another provider request for that attempt

#### Scenario: Provider supports idempotent reconciliation

- **WHEN** a provider's tested contract accepts the persisted idempotency key or can authoritatively locate the same remote operation
- **THEN** recovery MAY reconcile that same attempt
- **AND** it SHALL NOT create a second logical attempt or artifact set

### Requirement: Shared artifact materialization

The system SHALL materialize every supported provider result through one canonical artifact boundary that supports Gemini `inlineData` and `inline_data`, GPT `b64_json`, direct URLs, ordered multi-image results, and URLs returned by asynchronous jobs.

#### Scenario: Gemini returns inline data

- **WHEN** a Gemini image response contains valid `inlineData` or `inline_data`
- **THEN** the materializer SHALL produce the canonical image artifact collection
- **AND** lifecycle completion SHALL be identical to other synchronous provider shapes

#### Scenario: GPT returns base64 JSON

- **WHEN** a GPT image response contains valid `b64_json`
- **THEN** the same materializer SHALL produce the canonical image artifact collection
- **AND** no GPT-specific task completion writer SHALL run

#### Scenario: Provider returns several image URLs

- **WHEN** a synchronous or asynchronous provider returns multiple valid image URLs
- **THEN** the materializer SHALL preserve their defined order and individual metadata
- **AND** the coordinator SHALL commit one guarded attempt result containing all artifacts

### Requirement: First release uses versioned data in the existing task row

The first lifecycle release SHALL store optional `imageLifecycle.version=1`, monotonic revision, current-attempt identity, and attempt history inside the existing `aitu-app/tasks` row. It MUST leave IndexedDB database version 1, existing object stores, and existing indexes unchanged.

#### Scenario: New lifecycle data is first created

- **WHEN** the coordinator creates or lazily migrates an image task
- **THEN** it SHALL write the versioned lifecycle value through the existing task-row transaction
- **AND** no `onupgradeneeded` schema work, store creation, index creation, or database-version increment SHALL occur

#### Scenario: v1.0.1 opens after new lifecycle writes

- **GIVEN** the new release wrote version-1 lifecycle data into existing task rows
- **WHEN** the built v1.0.1 code opens `aitu-app` with version 1 after rollback
- **THEN** the open SHALL succeed without `VersionError`
- **AND** v1.0.1 SHALL see only supported outer task statuses and fields

#### Scenario: Reader encounters a future lifecycle version

- **WHEN** a row contains an unsupported `imageLifecycle.version`
- **THEN** the system SHALL preserve that value opaquely and classify it non-executable
- **AND** it MUST NOT erase the value or infer undispatched authority

### Requirement: Lifecycle fields survive every task serialization boundary

The system SHALL preserve supported lifecycle version, revision, current attempt, attempt history, dispatch token/consumption, remote recovery, polling ownership, and terminal facts through raw storage, task conversion, memory synchronization, backup/import, and paged cloud synchronization. Intentional import-authority revocation MUST be explicit and MUST NOT be implemented as silent field loss.

#### Scenario: Stored task crosses reader and writer conversions

- **WHEN** a task row is converted by `convertSWTaskToTask`, task-queue memory state, `convertToSWTask`, normal save, merge, or parameter-preserving save
- **THEN** every supported `imageLifecycle` field and unrelated unknown row field SHALL round-trip unchanged unless a guarded lifecycle transition explicitly changes it

#### Scenario: Task is exported and re-imported from backup

- **WHEN** `tasks.json` is produced and restored in merge or replace mode
- **THEN** supported lifecycle and attempt history SHALL survive export sanitization, normalization, and import
- **AND** any active imported authority SHALL be explicitly normalized before execution rather than silently dropped

#### Scenario: Task crosses paged cloud synchronization

- **WHEN** an image task is compacted, uploaded, downloaded, expanded, conflict-selected, and restored
- **THEN** the winning full lifecycle snapshot SHALL retain all supported lifecycle fields and participate in sync change detection
- **AND** a `syncedFromRemote` snapshot SHALL not authorize local submit

#### Scenario: Imported active snapshot contains dispatch authority

- **WHEN** backup or cloud data contains an active or consumed source dispatch token
- **THEN** the system SHALL preserve the source fact for history while revoking foreign local execution authority
- **AND** it SHALL never consume that imported token to call submit
- **AND** only a valid persisted `remoteId` and route MAY enable approved query-only recovery

### Requirement: Deterministic legacy migration

The system SHALL migrate legacy image tasks deterministically without changing existing terminal history or blindly replaying active rows.

#### Scenario: Legacy image task is terminal

- **WHEN** migration encounters a terminal legacy image task
- **THEN** its terminal state, artifacts, timestamps, and history SHALL remain unchanged

#### Scenario: Legacy active task has remote recovery facts

- **WHEN** a legacy active image task has a valid route and `remoteId`
- **THEN** it MAY resume provider polling after acquiring current execution ownership
- **AND** it SHALL not submit a new provider operation

#### Scenario: Legacy processing task lacks remote identity

- **WHEN** a legacy `processing` image task has no `remoteId`
- **THEN** migration SHALL mark its internal attempt interrupted and retryable
- **AND** it SHALL project outer `status='failed'` with `error.code='IMAGE_ATTEMPT_INTERRUPTED'`
- **AND** it SHALL NOT automatically invoke the provider

### Requirement: Full image entry-point parity

All task-backed image generation entry points MUST satisfy the same lifecycle and artifact contracts, including single image, batch, AI input/MCP queue, workflow, PPT, FramePanel, Comic, plugin, Service Worker capability, retry, and recovery paths.

#### Scenario: Acceptance matrix is executed

- **WHEN** the image lifecycle change is verified for release
- **THEN** every listed entry point SHALL prove coordinator ownership and correct terminal delivery
- **AND** Gemini inline, GPT base64, URL, multi-image, asynchronous, retry, recovery, cancellation, and cross-tab fixtures SHALL pass

#### Scenario: FramePanel awaits a PPT image

- **WHEN** FramePanel creates a task-backed PPT slide image or replacement image
- **THEN** it SHALL consume the coordinator execution handle/result and preserve its cancellation semantics
- **AND** it SHALL NOT call the generic IndexedDB `waitForTaskCompletion` poller

#### Scenario: ComicCreator awaits page image variants

- **WHEN** ComicCreator creates one or more page-image tasks
- **THEN** it SHALL consume coordinator handles/results while preserving task ordering, partial multi-image success, error reporting, and cancellation
- **AND** it SHALL NOT call the generic IndexedDB `waitForTaskCompletion` poller

#### Scenario: An entry point bypasses the coordinator

- **WHEN** a task-backed image caller imports a low-level lifecycle writer or creates an adapter-side completion path
- **THEN** static boundary or contract verification SHALL fail

### Requirement: Lifecycle diagnostics protect sensitive data

The system SHALL emit enough structured lifecycle diagnostics to distinguish provider, storage, ownership, normalization, and UI-delivery failures while excluding credentials and generated image payloads.

#### Scenario: A lifecycle failure is recorded

- **WHEN** an image attempt encounters a transition, storage, dispatch, polling-lease, normalization, serialization, or provider error
- **THEN** diagnostics SHALL include sanitized task kind, attempt/revision, transition, dispatch/polling category, route identity, read outcome, and terminal category
- **AND** diagnostics SHALL exclude API keys, authorization headers, raw base64, image bytes, and provider response bodies
