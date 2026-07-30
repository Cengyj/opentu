## ADDED Requirements

### Requirement: Generation dialogs shall preserve actionable task-creation rejection reasons

The system SHALL preserve a safe, actionable task-creation rejection reason from the task service to the image or video generation dialog or batch-image tool instead of reducing every rejection to an undifferentiated failure value.

#### Scenario: Image task is rejected for invalid dimensions

- **GIVEN** the image generation dialog contains dimensions rejected by the existing task validation rules
- **WHEN** the user submits the image generation request
- **THEN** no task SHALL be created or executed
- **AND** the dialog SHALL identify the rejected dimension constraint in the active language
- **AND** the editable form state SHALL remain available for correction and resubmission

#### Scenario: Video task is rejected for recognized invalid parameters

- **GIVEN** the video generation dialog contains parameters rejected by the existing task validation rules
- **WHEN** the user submits the video generation request
- **THEN** no task SHALL be created or executed
- **AND** the dialog SHALL identify the recognized invalid parameter reason in the active language
- **AND** the editable form state SHALL remain available for correction and resubmission

#### Scenario: Task creation fails for an unknown reason

- **WHEN** task creation fails without a recognized safe user-facing reason
- **THEN** the active generation surface SHALL render the existing generic retry guidance
- **AND** SHALL NOT expose stack traces, credentials, request payloads, or raw provider responses

#### Scenario: All selected batch-image task creations are rejected

- **GIVEN** the batch-image tool has selected valid rows
- **WHEN** every requested task is rejected during task creation
- **THEN** no task ID SHALL be appended to those rows
- **AND** the tool SHALL report that zero tasks were accepted with a safe actionable reason when recognized
- **AND** the editable table state SHALL remain available for correction and resubmission

#### Scenario: A batch-image submission is partially accepted

- **GIVEN** one batch-image submission requests multiple tasks
- **WHEN** some task creations succeed and some are rejected
- **THEN** every successfully created task SHALL remain queued and associated with its source row exactly once
- **AND** the tool SHALL report both accepted and rejected counts
- **AND** SHALL provide a safe recognized reason or generic guidance for the rejected portion

#### Scenario: A Music Analyzer multi-submit is partially accepted

- **GIVEN** the Music Analyzer requests multiple existing Suno generation tasks
- **WHEN** one or more task creations succeed before a later creation is rejected
- **THEN** every accepted AUDIO task SHALL remain queued and SHALL be associated with the Music Analyzer record exactly once
- **AND** the tool SHALL report accepted and rejected counts
- **AND** SHALL provide a safe recognized reason or generic guidance for the rejected portion
- **AND** a late successful result from an accepted task SHALL remain consistent with that feedback and record association

### Requirement: Task-creation feedback changes shall not alter execution semantics

The system SHALL keep the existing validation rules and task execution semantics unchanged while improving rejection feedback.

#### Scenario: A valid generation request is submitted

- **WHEN** the image or video generation request passes the existing validation rules
- **THEN** task creation, routing, persistence, execution, progress, cancellation, retry, recovery, and result handling SHALL follow their existing behavior

#### Scenario: A valid batch-image request is submitted

- **WHEN** all selected batch-image tasks pass the existing validation rules
- **THEN** the accepted count, row task-ID association, queue execution, automatic canvas insertion, persistence, cancellation, retry, recovery, and result handling SHALL follow their existing behavior

#### Scenario: A valid Music Analyzer multi-submit is submitted

- **WHEN** every requested Suno task passes the existing task-creation rules
- **THEN** every task SHALL remain associated with the current record exactly once
- **AND** queue execution, automatic canvas insertion, persistence, cancellation, retry, recovery, and generated-clip projection SHALL follow their existing behavior

#### Scenario: An invalid generation request is submitted

- **WHEN** the image, video, batch-image, or Music Analyzer generation request fails the existing validation rules
- **THEN** the system SHALL NOT relax, bypass, or add validation rules as part of this feedback change
- **AND** SHALL NOT create a persisted or executable task for that rejected request
