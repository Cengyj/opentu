## ADDED Requirements

### Requirement: Comic record mutations preserve accepted order

The system SHALL preserve comic record mutations accepted in one application runtime in deterministic order so that an older asynchronous load-modify-save operation cannot overwrite a later accepted project addition, edit, task result, favorite state, or deletion.

#### Scenario: Two non-conflicting project edits overlap

- **GIVEN** a comic record has two non-conflicting mutations accepted from task synchronization, editing, history actions, or distinct tool windows
- **WHEN** both durable writes overlap
- **THEN** the later persisted record SHALL contain both mutations
- **AND** an older whole-array write SHALL NOT restore stale field or page state

### Requirement: Restored terminal comic tasks are reconciled after storage is ready

The system SHALL reconcile every relevant terminal comic task after persisted task storage becomes ready, including tasks not represented by the task queue's generic restoration event.

#### Scenario: Comic tool mounts before task restoration

- **GIVEN** the comic task-sync consumer mounts while the in-memory task map is empty or incomplete
- **AND** persisted storage contains one or more terminal comic tasks
- **WHEN** task restoration becomes ready
- **THEN** every relevant terminal comic task SHALL be reconciled idempotently into its matching project record
- **AND** a non-comic first restored task SHALL NOT hide later comic tasks
- **AND** recovery SHALL NOT replace an unrelated record selected by the user

### Requirement: Comic persistence failure is visible and recoverable

The system SHALL report a safe visible failure when an accepted comic edit, history action, or automatic task-result update cannot be persisted and SHALL keep the current in-memory work available for a later save attempt.

#### Scenario: An edit save fails and a later mutation succeeds

- **WHEN** an accepted record mutation rejects during persistence
- **THEN** the tool SHALL display a durability failure without exposing prompt content, cached media, credentials, or the full stored record
- **AND** the current in-memory edit SHALL remain available
- **AND** a later successful save SHALL clear the persistence warning without clearing unrelated task errors

