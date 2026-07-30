## ADDED Requirements

### Requirement: Music Analyzer Records Shall Preserve Accepted Mutations

The system SHALL commit mutations accepted for the `music-analyzer:records` key in accepted order so an older whole-record-array operation cannot overwrite a later accepted non-conflicting edit.

#### Scenario: Independent writers update one Music Analyzer record

- **GIVEN** two Music Analyzer windows, task consumers, autosave handlers, or history actions accept non-conflicting mutations for the same record
- **WHEN** their asynchronous storage operations overlap
- **THEN** the durable record SHALL contain every successfully accepted mutation in accepted order
- **AND** normalization, starred retention, the 50-record cap, and source snapshot shape SHALL remain unchanged

### Requirement: Music Analyzer Shall Reconcile Tasks After Storage Readiness

The system SHALL reconcile every relevant terminal Music Analyzer task after persisted task storage becomes ready, using the application-owned readiness boundary and idempotent task identity.

#### Scenario: Restored Music Analyzer task is not the representative event

- **GIVEN** task storage restores multiple tasks and the generic refresh event represents a different task
- **WHEN** restored task storage becomes ready
- **THEN** every relevant completed Music Analyzer task SHALL be checked for record projection
- **AND** live and restored consumers SHALL NOT apply the same task result twice
- **AND** an unrelated record the user is editing SHALL remain selected

### Requirement: Music Analyzer Shall Report Record Persistence Failure

The system SHALL keep the current in-memory edit available and visibly report when a Music Analyzer record mutation is not durably saved.

#### Scenario: A record mutation write rejects and a later retry succeeds

- **GIVEN** an accepted Music Analyzer edit, task projection, favorite, or delete reaches durable storage
- **WHEN** the write rejects
- **THEN** the tool SHALL show a safe unsaved-state message without exposing prompt, lyrics, filename, media URL, task ID, provider body, credential, or stack
- **AND** SHALL retain the current editable state
- **AND** a later successful accepted write SHALL clear only the relevant stale warning
