## ADDED Requirements

### Requirement: MV record mutations preserve accepted order

The system SHALL preserve every accepted MV record mutation in application-runtime order so an older load-modify-save operation cannot overwrite a later non-conflicting edit, subject selection, task result, favorite, deletion, reset, or batch result.

#### Scenario: Two non-conflicting MV edits overlap

- **GIVEN** an MV record is not starred and has its current source label
- **WHEN** the user accepts a favorite mutation and a source-label mutation before either durable write finishes
- **THEN** the stored record SHALL contain both the favorite state and the new source label
- **AND** the record key, shape, 50-record retention rule, media references, and selected-record semantics SHALL remain unchanged

### Requirement: Restored terminal MV tasks are reconciled after storage is ready

The system SHALL reconcile every relevant terminal MV storyboard, rewrite, and music task after persisted task storage becomes ready, including tasks not represented by the task queue's generic restoration event.

#### Scenario: MV tool mounts before task restoration

- **GIVEN** the MV tool mounts while the in-memory task map is empty
- **AND** persisted restoration later adds multiple terminal tasks whose first task is unrelated to MV
- **WHEN** task storage reports ready
- **THEN** every relevant MV task SHALL be checked once for idempotent record projection
- **AND** a simultaneous live event for the same task SHALL NOT duplicate a version, clip, or record mutation
- **AND** reconciliation SHALL NOT select an unrelated record

### Requirement: MV persistence failure is visible and recoverable

The system SHALL retain accepted in-memory MV edits when a durable record write fails, SHALL expose a safe unsaved state, and SHALL clear only that persistence warning after a later accepted write succeeds.

#### Scenario: An MV edit save fails and a later mutation succeeds

- **GIVEN** a user edits a brief, shot, character, subject reference, favorite, reset, or generated result
- **WHEN** the corresponding durable write rejects
- **THEN** the current in-memory work SHALL remain available
- **AND** the user SHALL see a persistence failure message that contains no prompt, lyrics, knowledge content, credential, full record, or media payload
- **WHEN** a later accepted mutation persists successfully
- **THEN** only the persistence warning SHALL clear
- **AND** task/generation errors SHALL retain their independent state
