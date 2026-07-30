## ADDED Requirements

### Requirement: Task Cancellation SHALL Reach The Active Execution Owner

The system SHALL propagate a user cancellation from the task queue to the active local executor or polling owner for that task, including tasks created by a main-thread workflow.

#### Scenario: Cancel a task owned by the task queue service

- **GIVEN** a normal generation task is running
- **WHEN** the user cancels it from the task queue
- **THEN** its local request or polling signal SHALL be cancelled
- **AND** the task SHALL enter `cancelled`

#### Scenario: Cancel a task owned by a workflow execution

- **GIVEN** a workflow image or video task is running through `media-generation`
- **WHEN** the user cancels that task from the task queue
- **THEN** the registered local execution owner SHALL stop waiting for that task
- **AND** the workflow step SHALL NOT be reported as successfully completed from a late result

#### Scenario: Cancel a task owned by a dedicated task executor

- **GIVEN** a character extraction or recovery task is running outside the task queue service's private executor
- **WHEN** the user cancels that task from the task queue
- **THEN** the dedicated owner SHALL stop waiting when its API supports cancellation, or discard the late result otherwise
- **AND** SHALL NOT create a successful derived record after cancellation

#### Scenario: Cancel a Suno audio task during submit or polling

- **GIVEN** a Suno music or lyrics task is submitting, polling, or waiting for its next poll
- **WHEN** the user cancels that task from the task queue
- **THEN** the shared cancellation signal SHALL reach the active transport or polling wait
- **AND** no later audio or lyrics result SHALL complete the cancelled task

#### Scenario: Cancel a Music Analyzer dedicated chat task

- **GIVEN** a Music Analyzer analysis, lyrics rewrite, or text-lyrics task is running in its dedicated task-queue executor
- **WHEN** the user cancels that task from the task queue
- **THEN** the dedicated executor SHALL stop when its request supports cancellation, or discard the late result otherwise
- **AND** SHALL NOT finalize a successful task or write a successful Music Analyzer record from that late result

#### Scenario: Music Analyzer observes a cancelled linked task

- **GIVEN** a Music Analyzer analysis, lyrics, or music task is linked to the current record or page
- **WHEN** that task reaches `cancelled`
- **THEN** the page and history SHALL stop presenting it as waiting or processing and SHALL expose the cancelled state
- **AND** the durable task/record association needed by the existing task-panel retry SHALL remain available
- **AND** a retried successful task SHALL still project its result exactly once

### Requirement: Cancelled Tasks SHALL Reject Late Success Writeback

The system SHALL preserve a user-confirmed cancelled terminal state across memory, IndexedDB, task events, workflow state, and automatic insertion.

#### Scenario: Provider completion arrives after cancellation

- **GIVEN** a task has been cancelled locally
- **WHEN** an executor or provider callback later reports progress or completion
- **THEN** the callback SHALL NOT replace the cancelled task with a processing or completed state
- **AND** the result SHALL NOT be inserted automatically or saved as a newly completed task result

#### Scenario: The provider cannot cancel an accepted remote job

- **GIVEN** a remote provider does not expose cancellation for an accepted job
- **WHEN** the user cancels local tracking
- **THEN** the UI SHALL preserve the local cancelled state
- **AND** SHALL NOT claim that the remote provider job was revoked

#### Scenario: Cancellation arrives while generated audio is being cached

- **GIVEN** an AUDIO task passed its provider-success check and is caching audio or cover URLs
- **WHEN** the user cancels the task before completion is committed
- **THEN** the cache completion callback SHALL NOT replace `cancelled` with `completed`
- **AND** the task SHALL NOT auto-insert or project the late cached result into a Music Analyzer record
