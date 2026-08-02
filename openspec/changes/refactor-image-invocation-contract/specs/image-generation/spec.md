## ADDED Requirements

### Requirement: Canonical Image Invocation Contract

The system SHALL normalize every production image request into one internal contract before resolving operation, provider routing, adapter, endpoint, capabilities, or results.

#### Scenario: Historical request aliases are accepted

- **WHEN** an image request contains supported top-level, nested, camelCase, or persisted snake_case aliases
- **THEN** one normalization boundary SHALL produce the same canonical fields
- **AND** those aliases SHALL NOT be reinterpreted downstream

#### Scenario: Image edit intent is resolved once

- **WHEN** a normalized request contains a usable reference image, uploaded image, mask, `image_to_image`, or `image_edit` mode
- **THEN** the operation intent SHALL be `edit`
- **AND** every queue, direct, MCP, workflow, retry, and recovery path SHALL consume that result

#### Scenario: Text-only request is generation

- **WHEN** a normalized request contains no edit signal
- **THEN** the operation intent SHALL be `generation`
- **AND** no adapter SHALL independently change it

#### Scenario: Executor receives a canonical image request

- **WHEN** a queue-backed or direct caller hands image work to the executor
- **THEN** the executor DTO SHALL carry the normalized request and one invocation snapshot or already-resolved invocation
- **AND** SHALL NOT duplicate prompt, model, reference image, size, quality, or compatibility fields beside that request

#### Scenario: Task metadata crosses the canonical boundary

- **WHEN** an image request contains asset metadata or prompt-lineage metadata in a supported camelCase or persisted snake_case form
- **THEN** the normalization boundary SHALL retain a readonly canonical value
- **AND** the adapter request and provider serializer SHALL receive neither metadata field

### Requirement: One Immutable Image Plan Per Execution

The system SHALL resolve an image execution into one immutable invocation plan and SHALL use its binding for all downstream decisions.

#### Scenario: Settings change after planning

- **WHEN** provider settings or the runtime catalog change after an image invocation is resolved
- **THEN** the current execution SHALL retain its original profile, model, operation, binding, schema, adapter, submit path, and poll path

#### Scenario: Caller already resolved the invocation

- **WHEN** an entry point normalizes and resolves an image invocation before handing it to an executor
- **THEN** the executor SHALL use that same resolved invocation
- **AND** SHALL NOT normalize, plan, or resolve an adapter again for the same execution attempt

#### Scenario: Task recovery uses durable binding

- **WHEN** a submitted image task resumes after refresh
- **THEN** the system SHALL hydrate the submitted binding snapshot
- **AND** SHALL read credentials only from the same current provider profile
- **AND** SHALL query the persisted remote ID without submitting again

#### Scenario: Required recovery state is missing

- **WHEN** a processing asynchronous image task lacks its remote ID or executable binding snapshot
- **THEN** recovery SHALL fail explicitly
- **AND** SHALL send zero submit requests

### Requirement: Binding-Scoped Image Capabilities

The system SHALL resolve and validate image capabilities for the selected profile, model, operation, and binding before provider transport.

#### Scenario: Explicit binding capability exists

- **WHEN** binding or discovered endpoint metadata declares image capabilities
- **THEN** those capabilities SHALL control parameter display and validation ahead of static model configuration

#### Scenario: Requested parameter is unsupported

- **WHEN** a request uses an operation, mask, reference count, size, aspect ratio, resolution, quality, background, output format, compression, or count excluded by the selected binding capabilities
- **THEN** the invocation SHALL return a structured unsupported-parameter error
- **AND** SHALL send zero provider requests

#### Scenario: Provider-specific parameter is request-schema scoped

- **WHEN** a canonical image request contains a provider-specific parameter
- **THEN** the selected binding's request schema SHALL explicitly allow that key, type, and constrained value through a serializer capability
- **AND** an unknown key, wrong-schema key, or invalid value SHALL fail capability validation before adapter or transport execution

#### Scenario: Capability is unknown

- **WHEN** no binding-scoped or compatible static capability evidence exists
- **THEN** the system SHALL apply a conservative policy
- **AND** SHALL NOT infer support from an unscoped model name

#### Scenario: Parameter UI resolves the selected binding

- **WHEN** an image parameter surface has the selected model, complete `ModelRef`, and generation/edit intent
- **THEN** it SHALL display and retain canonical parameters only when the same provider-scoped binding capability contract proves support
- **AND** it SHALL prune unsupported selected values before submission through the shared capability boundary

#### Scenario: Parameter UI cannot resolve a provider-scoped plan

- **WHEN** `ModelRef` is absent or mismatched, or binding planning is unavailable or ambiguous
- **THEN** the parameter surface SHALL use a conservative unresolved state
- **AND** SHALL NOT restore unproved canonical controls from a bare model ID

### Requirement: Unified Image Artifacts

The system SHALL normalize each supported provider image response into one ordered array of validated image artifacts before caching or consumption.

#### Scenario: Provider returns supported encodings

- **WHEN** a provider returns OpenAI base64 JSON, Gemini `inlineData` or `inline_data`, a URL, multiple URLs, or an existing data URL
- **THEN** the adapter boundary SHALL produce ordered artifacts with correct MIME information
- **AND** queue and direct execution SHALL produce equivalent image ordering and values

#### Scenario: Provider result is invalid

- **WHEN** a response is empty, contains invalid base64, or uses an unsupported MIME type
- **THEN** execution SHALL fail with a structured result-format error
- **AND** SHALL NOT mark the task completed or insert an image

#### Scenario: Cache must precede completion

- **WHEN** a queue-backed image invocation succeeds
- **THEN** every artifact SHALL be durably cached before the task reaches `completed`
- **AND** multiple images SHALL not be lost, duplicated, or reordered

#### Scenario: Duplicate artifacts share one persistence operation

- **WHEN** a provider result repeats the same artifact source
- **THEN** the cache boundary SHALL materialize that unique source once
- **AND** image caching SHALL use bounded concurrency while preserving first-seen order

#### Scenario: Compact task sync preserves canonical artifacts

- **WHEN** a completed image task is serialized to and restored from GitHub compact task sync
- **THEN** its optional `imageArtifacts` field SHALL preserve artifact order and per-artifact metadata
- **AND** an older compact record without that field SHALL remain readable through the single legacy `url`/`urls` boundary without migration

#### Scenario: Asynchronous provider returns multiple result fields

- **WHEN** a completed asynchronous image response contains singular `url` or `video_url`, plural `urls`, or `data` entries
- **THEN** the response-schema parser SHALL normalize every unique supported source into ordered artifacts
- **AND** duplicate sources SHALL appear exactly once without reordering entries already present in provider arrays

### Requirement: Abortable and Recoverable Image Execution

The system SHALL preserve one cancellation signal across image preprocessing, provider transport, polling, caching, and terminal persistence.

#### Scenario: Request is cancelled before submit

- **WHEN** cancellation occurs before image submission
- **THEN** the system SHALL send zero provider requests
- **AND** SHALL not cache, complete, or insert an image

#### Scenario: Request is cancelled during polling

- **WHEN** cancellation occurs while an asynchronous image task is polling
- **THEN** the active request or wait SHALL stop
- **AND** no subsequent query or completed write SHALL occur

#### Scenario: Remote ID is submitted

- **WHEN** an asynchronous provider returns a remote ID
- **THEN** its durable persistence callback SHALL complete before the first query begins

#### Scenario: Remote ID persistence is rejected

- **WHEN** the attempt guard rejects a remote-ID persistence callback
- **THEN** execution SHALL fail before the first query
- **AND** SHALL NOT create a second paid submission or poll an unowned attempt

#### Scenario: Initial and resumed polling use the same contract

- **WHEN** an asynchronous image invocation polls immediately after submit or resumes polling after refresh
- **THEN** both paths SHALL use one binding-driven poll implementation and response-schema parser
- **AND** resumed polling SHALL query the persisted remote ID without submitting again

#### Scenario: Specialized asynchronous bindings poll

- **WHEN** an MJ or Flux submission returns a remote ID
- **THEN** its subsequent queries, waits, cancellation, response parser, and timeout SHALL use the shared binding-driven poller
- **AND** the adapter SHALL NOT own another poll loop

#### Scenario: Recovery commits through the image outcome contract

- **WHEN** query-only recovery completes or fails for the captured image attempt
- **THEN** the guarded terminal writer SHALL return an `ImageExecutionOutcome` that TaskQueue applies once
- **AND** a stale attempt outcome SHALL NOT overwrite a cancellation, retry, or newer terminal row

### Requirement: Bounded Image Invocation Work

The system SHALL execute reference preparation and artifact persistence with deterministic bounds and invocation-scoped de-duplication.

#### Scenario: References repeat within one invocation

- **WHEN** the same reference or mask source appears more than once
- **THEN** the source SHALL be downloaded, decoded, compressed, and converted at most once for that invocation
- **AND** the adapter SHALL receive results in the canonical request order

#### Scenario: Reference preparation is cancelled

- **WHEN** the invocation signal aborts during bounded reference preparation
- **THEN** active work SHALL observe the signal
- **AND** no not-yet-started materialization or provider submit SHALL begin

### Requirement: Observable Image Performance Contract

The system SHALL expose deterministic image invocation counters and numeric stage timings that do not participate in business decisions.

#### Scenario: One direct or task-backed invocation executes

- **WHEN** one logical image invocation completes or fails
- **THEN** its observability snapshot SHALL distinguish normalization, planning, capability validation, reference preparation, submit, poll, response parsing, artifact caching, and terminal persistence where those stages occur
- **AND** counters SHALL prove at most one planner and adapter resolution, at most one submit per attempt, one response parse per provider response, and one cache operation per unique artifact
- **AND** the snapshot SHALL contain no credentials, prompt, media bytes, Base64, provider response body, or signed URL

#### Scenario: Current-session queue task already owns polling

- **GIVEN** a TaskQueue image submission was created or explicitly retried in the current page session
- **WHEN** that task persists and emits its asynchronous remote ID
- **THEN** the recovery observer SHALL NOT start a second poller or timeout owner
- **AND** the existing queue execution SHALL remain the sole submit, poll, timeout, and cancellation owner

#### Scenario: Prior-session task enters query-only recovery

- **GIVEN** an image task was restored after page refresh with a remote ID and complete executable binding snapshot
- **WHEN** no current-session queue execution owns that task
- **THEN** the recovery path SHALL capture its attempt and routing identity and continue query only
- **AND** cancellation, retry, remote-ID replacement, or binding replacement SHALL prevent the old poll result from committing

#### Scenario: No factual numeric progress exists

- **WHEN** neither task persistence nor the provider reports a numeric image-generation percentage
- **THEN** the UI SHALL render indeterminate progress with any known execution phase
- **AND** SHALL NOT synthesize a wall-clock percentage

### Requirement: Converged Production Image Entries

The system SHALL preserve complete image routing identity and use the canonical request, operation, plan, adapter, transport, and artifact boundaries across every audited production image entry.

#### Scenario: Queue-backed entry generates an image

- **WHEN** the single-image dialog, batch generation, AI Input/Agent, MCP queue, or plugin queue creates image work
- **THEN** the selected `ModelRef` and resolved operation/binding identity SHALL reach the shared TaskQueue execution boundary
- **AND** no entry SHALL independently select a protocol, adapter, submit path, or poll path

#### Scenario: Direct entry generates an image

- **WHEN** MCP direct mode, workflow main-thread execution, chat-drawer generation, or model benchmark invokes image execution directly
- **THEN** it SHALL share normalization, planning, capability validation, adapter execution, and artifact normalization with the queue path
- **AND** direct execution SHALL retain its existing no-implicit-task and no-implicit-canvas-insertion semantics

#### Scenario: Composed image consumer receives results

- **WHEN** PPT/FramePanel, Comic, canvas, inspiration-board, task, asset, history, download, or retry/recovery code consumes image execution
- **THEN** it SHALL consume normalized artifacts or the single external result projection
- **AND** SHALL NOT parse provider-native responses or reselect prior routing decisions

#### Scenario: Provider returns multiple artifacts for task count

- **WHEN** task-backed `count=N` retains its existing independent-task expansion and a provider response contains multiple ordered artifacts
- **THEN** the response artifacts SHALL remain ordered within that task
- **AND** count expansion SHALL NOT duplicate or discard provider-returned artifacts

#### Scenario: Audited Photo Wall executor has no production caller

- **GIVEN** the legacy `services/photo-wall/GridImageService` generation, processing, and insertion chain has no production caller
- **WHEN** production image entries converge on the canonical invocation contract
- **THEN** that parallel direct image executor and its redundant board wiring SHALL be removed
- **AND** live MCP Photo Wall tools, canvas operations, grid splitting, and layout behavior SHALL remain available
