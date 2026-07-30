## ADDED Requirements

### Requirement: Model Task Execution SHALL Use A Shared Concurrency Boundary

The system SHALL apply the configured AI generation concurrency limit to normal task creation, retry, and recovery before invoking a model or provider executor.

#### Scenario: More tasks are submitted than the limit

- **GIVEN** the configured model-task concurrency limit is 20
- **WHEN** 21 otherwise executable generation tasks are submitted before any completes
- **THEN** no more than 20 model/provider executions SHALL be in flight
- **AND** the remaining task SHALL stay observable as queued until a permit is released

#### Scenario: A queued task is cancelled

- **GIVEN** a task is waiting for an execution permit
- **WHEN** the user cancels or deletes that queued task
- **THEN** the system SHALL remove it from the waiting set
- **AND** SHALL NOT invoke its model/provider executor

#### Scenario: An execution releases its permit

- **WHEN** a running task completes, fails, is cancelled, or exits through an exception
- **THEN** its permit SHALL be released exactly once
- **AND** the next eligible queued task SHALL be allowed to start
