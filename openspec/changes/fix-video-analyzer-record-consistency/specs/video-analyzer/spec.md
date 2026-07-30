## ADDED Requirements

### Requirement: Video analyzer record mutations preserve accepted order

The system SHALL preserve video-analyzer record mutations accepted in one application runtime in deterministic order so that an older asynchronous load-modify-save operation cannot overwrite a later accepted record addition, edit, task result, favorite state, or deletion.

#### Scenario: Two completed analyses create records concurrently

- **GIVEN** two video-analyzer windows have distinct completed analysis tasks
- **WHEN** both task results are reconciled before either record write has completed
- **THEN** both analysis records SHALL remain in persisted history subject to the existing retention rule
- **AND** replaying either task SHALL NOT create a duplicate record

#### Scenario: Script fields are saved concurrently

- **GIVEN** a record has an autosave and another shot, character, or task-result patch in flight
- **WHEN** both mutations are accepted in one runtime
- **THEN** the later persisted record SHALL contain both non-conflicting changes
- **AND** an older write SHALL NOT restore a stale field value

### Requirement: Restored completed tasks are reconciled after task storage is ready

The system SHALL reconcile every relevant completed video-analyzer task after persisted task storage becomes ready, including tasks that were not represented by the task queue's generic restoration event.

#### Scenario: The tool mounts before task restoration completes

- **GIVEN** the video-analyzer task-sync consumer mounts while the in-memory task map is empty or incomplete
- **AND** persisted storage contains one or more completed video-analyzer tasks
- **WHEN** task restoration completes
- **THEN** each relevant completed task SHALL be reconciled idempotently into its corresponding analysis record
- **AND** a non-video task restored first SHALL NOT hide later video-analyzer tasks
- **AND** recovery SHALL NOT replace an unrelated current record selected by the user

### Requirement: Video analyzer persistence failure is visible

The system SHALL report a safe visible failure when an accepted video-analyzer edit or task-result update cannot be persisted and SHALL keep the current in-memory work available for a later save attempt.

#### Scenario: Script autosave fails and later succeeds

- **WHEN** a script, character, parameter, or generated-result record write rejects
- **THEN** the tool SHALL display a persistence failure without exposing prompt content, cached media, credentials, or the full stored record
- **AND** the current edit SHALL remain available in the open tool
- **AND** a later successful save SHALL clear the persistence warning without clearing unrelated task errors

