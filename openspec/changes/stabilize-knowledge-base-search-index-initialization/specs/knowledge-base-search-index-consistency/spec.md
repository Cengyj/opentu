## ADDED Requirements

### Requirement: Knowledge-base index readiness shall have one operation owner

The system SHALL allow at most one shared knowledge-base index build or synchronization operation to mutate an engine instance at a time, and overlapping consumers SHALL await that same operation.

#### Scenario: Searches overlap before the first index is ready

- **GIVEN** the shared knowledge-base search engine has not completed its initial index
- **WHEN** two or more existing search, related-note, or MCP consumers request index readiness concurrently
- **THEN** one initial build SHALL read the current metadata, directories and note content
- **AND** every overlapping consumer SHALL await that build without starting another build

#### Scenario: Consumers overlap while synchronizing a warm index

- **GIVEN** the shared index is ready and durable notes have been added, updated or deleted
- **WHEN** existing consumers request readiness concurrently
- **THEN** one incremental synchronization SHALL apply the current durable versions
- **AND** overlapping consumers SHALL NOT append, replace or remove the same index version more than once because of the overlap

#### Scenario: Different existing entry types overlap

- **GIVEN** UI search, related notes and the registered `search_notes` MCP tool use the same engine instance
- **WHEN** any combination of those entries requests readiness during one active index operation
- **THEN** they SHALL share that operation
- **AND** each entry SHALL continue its own existing query, related-note or MCP result projection after readiness

### Requirement: Index-operation failure shall settle consistently and remain retryable

The system SHALL propagate one active index operation's settlement to all of its current waiters, SHALL release ownership after settlement, and SHALL allow a later request to retry or synchronize.

#### Scenario: Shared initial build fails

- **GIVEN** multiple consumers await one initial index build
- **WHEN** a storage read rejects
- **THEN** every current waiter SHALL receive that build failure
- **AND** the engine SHALL NOT report that failed build as ready

#### Scenario: Request arrives after failure

- **GIVEN** the previous shared build or synchronization has rejected and released ownership
- **WHEN** a later consumer requests index readiness
- **THEN** the engine SHALL start one new operation using the current durable state
- **AND** a successful retry SHALL make results available without a page reload

#### Scenario: Request arrives after success

- **GIVEN** one shared operation has completed successfully and released ownership
- **WHEN** a later consumer requests readiness after notes have changed
- **THEN** the engine SHALL run the existing incremental synchronization rules
- **AND** SHALL NOT permanently reuse a settled Promise as a stale index snapshot

### Requirement: Concurrency correction shall preserve search and storage contracts

The system SHALL preserve existing query and durable-data contracts while preventing overlap-created duplicate index rows and results.

#### Scenario: Durable note identifiers are unique

- **GIVEN** the current durable metadata contains one record for each note identifier
- **WHEN** overlapping readiness callers complete and produce results
- **THEN** the in-memory index SHALL contain one current document per durable note identifier
- **AND** search or MCP results SHALL NOT contain duplicate identifiers created by overlapping index work

#### Scenario: Existing query behavior is evaluated

- **WHEN** search or related-note computation begins after shared index readiness
- **THEN** current tokenization, TF-IDF weights, similarity calculations, filters, limits, snippets and directory metadata SHALL remain unchanged
- **AND** UI latest-query ownership, related-note fallback and MCP basic-search fallback SHALL retain their separate existing boundaries

#### Scenario: Durable formats are inspected

- **WHEN** the concurrency correction is applied or rolled back
- **THEN** no note, directory, tag, content, backup, GitHub sync, cache, task or migration record format SHALL change
- **AND** no user-data cleanup or index migration SHALL be required

