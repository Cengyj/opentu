## ADDED Requirements

### Requirement: Audio Playlist Mutations Shall Converge To One Durable Outcome

The system SHALL apply playlist mutations accepted by one app runtime in a deterministic order and SHALL keep playlist metadata, membership, user feedback, and restored UI aligned with the same durable outcome.

#### Scenario: Concurrent playlist mutations use the latest committed state

- **WHEN** multiple create, rename, add, remove, favorite, or cleanup calls overlap in one app runtime
- **THEN** each mutation SHALL evaluate against the latest preceding committed playlist state
- **AND** distinct accepted membership changes SHALL NOT be lost through whole-array replacement
- **AND** concurrent name checks SHALL NOT persist duplicate custom playlist names

#### Scenario: A two-store mutation cannot commit completely

- **GIVEN** a playlist mutation has a durable prepared recovery record
- **WHEN** either metadata, membership, or commitment persistence fails
- **THEN** the operation SHALL NOT be reported as successful
- **AND** durable recovery SHALL converge the operation to its before state unless commitment was durably recorded
- **AND** no media URL, prompt, credential, provider body, or raw private payload SHALL be added to recovery feedback

#### Scenario: Initialization finds an interrupted playlist operation

- **WHEN** playlist initialization finds a prepared or committed recovery record
- **THEN** prepared work SHALL converge idempotently to its before state
- **AND** committed work SHALL converge idempotently to its after state
- **AND** playlist reads and favorites initialization SHALL wait for that recovery outcome

#### Scenario: Older reload finishes after a newer playlist snapshot

- **GIVEN** a newer playlist reload has already become the current UI projection
- **WHEN** an older reload finishes later
- **THEN** the older result SHALL NOT replace the newer playlist metadata or membership projection
- **AND** success feedback SHALL be emitted only for the durably completed owning mutation
