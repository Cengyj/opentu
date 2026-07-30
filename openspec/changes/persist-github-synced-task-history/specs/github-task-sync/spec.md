## ADDED Requirements

### Requirement: Downloaded GitHub Task History SHALL Persist Locally

The system SHALL persist successfully downloaded terminal task records to the local task store before reporting them as downloaded or exposing them as restored runtime state.

#### Scenario: A remote terminal task does not exist locally

- **WHEN** GitHub task synchronization downloads the remote task
- **THEN** the complete compatible task record SHALL be written to the local IndexedDB task store
- **AND** the task SHALL remain available after a page refresh

#### Scenario: The remote task is newer

- **GIVEN** the same task ID exists locally and remotely
- **WHEN** the remote `updatedAt` is newer
- **THEN** the remote terminal record SHALL replace the older local record in storage and runtime state

#### Scenario: The local task is not older

- **GIVEN** the same task ID exists locally and remotely
- **WHEN** the local `updatedAt` is equal to or newer than the remote value
- **THEN** synchronization SHALL preserve the local record

#### Scenario: Local persistence fails

- **WHEN** a downloaded task cannot be committed to IndexedDB
- **THEN** the task SHALL NOT be counted as a successful download
- **AND** runtime state SHALL NOT claim a durable restore for that task

### Requirement: Batch Task Restore SHALL Refresh The Complete Runtime View

The system SHALL make every successfully merged task in a downloaded page observable to task-list consumers without requiring a page refresh.

#### Scenario: A page contains multiple new tasks

- **WHEN** the storage merge succeeds for multiple tasks in one page
- **THEN** the task queue runtime snapshot SHALL contain all merged tasks
- **AND** task-list consumers SHALL receive a batch refresh that represents the complete updated snapshot
