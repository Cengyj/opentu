## ADDED Requirements

### Requirement: Model Benchmark Storage Shall Preserve Accepted State

The system SHALL hydrate and persist the independent model-benchmark store through one ordered consistency boundary so a late read or older whole-state write cannot remove a successfully accepted benchmark mutation.

#### Scenario: User acts while benchmark storage is loading

- **GIVEN** the persisted benchmark store has not finished loading
- **WHEN** the user creates, removes, rates, ranks, or starts a benchmark session
- **THEN** the mutation SHALL resolve against the initialized authoritative state rather than a provisional empty store
- **AND** a late hydration result SHALL NOT overwrite an accepted mutation

#### Scenario: Multiple accepted benchmark writes overlap

- **GIVEN** multiple benchmark mutations are accepted in one application runtime
- **WHEN** their underlying whole-state writes would otherwise complete out of order
- **THEN** durable state SHALL reflect the accepted mutation order
- **AND** an older completion SHALL NOT regress a newer accepted snapshot

#### Scenario: Benchmark storage read or write fails

- **WHEN** benchmark storage cannot be read or an accepted mutation cannot be written
- **THEN** the system SHALL NOT overwrite unread data with a provisional empty snapshot
- **AND** SHALL retain the current editable in-memory state and show a safe unsaved-state message
- **AND** the message SHALL NOT expose prompts, previews, URLs, provider bodies, credentials, or stacks
