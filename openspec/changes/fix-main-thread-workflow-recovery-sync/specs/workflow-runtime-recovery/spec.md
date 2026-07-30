## ADDED Requirements

### Requirement: Task-Backed Workflows SHALL Recover From Persisted Task State

The system SHALL reconcile workflows created by the main-thread AI input path from persisted task snapshots after task storage is ready and SHALL NOT require a Service Worker workflow owner for that recovery.

#### Scenario: Refresh while a queued workflow task is active

- **GIVEN** a persisted WorkZone or Chat workflow contains a step linked by task ID or workflow batch metadata
- **AND** the corresponding persisted task is pending or processing
- **WHEN** the page reloads and task storage becomes ready
- **THEN** the step SHALL converge to the persisted task state
- **AND** the workflow SHALL NOT be marked lost merely because no workflow-store or Service Worker workflow record exists

#### Scenario: Refresh after a queued workflow task reached a terminal state

- **GIVEN** a persisted WorkZone or Chat workflow contains a step linked to a completed, failed, or cancelled task snapshot
- **WHEN** recovery reconciles the task snapshot
- **THEN** the step and workflow message SHALL converge to the matching terminal state
- **AND** recovery SHALL NOT submit a duplicate provider request

### Requirement: Workflow Task Events SHALL Preserve Unrelated Active Context

The system SHALL apply a task event to every matching persisted UI projection without replacing a different active workflow in the single-slot WorkflowContext.

#### Scenario: An older workflow completes while a newer workflow is active

- **GIVEN** workflow B is the active WorkflowContext workflow
- **AND** workflow A remains represented by a WorkZone or Chat message
- **WHEN** a task event for workflow A arrives
- **THEN** workflow A's matching persisted projections SHALL update
- **AND** WorkflowContext SHALL remain on workflow B

#### Scenario: The active workflow receives its own task event

- **GIVEN** the TaskEvent matches the active workflow by exact task ID or workflow batch metadata
- **WHEN** synchronization runs
- **THEN** the matching active step SHALL update once
- **AND** the resulting state SHALL be projected to its Chat and WorkZone records

### Requirement: Workflow UI Projections SHALL Use One Authoritative Task Projection

The system SHALL prevent overlapping subscribers from applying the same TaskEvent more than once to the same logical WorkflowContext, Chat record, or WorkZone projection.

#### Scenario: One task completion event reaches all workflow surfaces

- **GIVEN** a workflow is represented in WorkflowContext, Chat, and WorkZone
- **WHEN** one completion event arrives for its task
- **THEN** each logical target SHALL receive one state transition
- **AND** duplicate Chat persistence writes for the same projected state SHALL NOT occur

### Requirement: Persisted Workflow And Chat Status SHALL Match Step State

The system SHALL derive workflow status and Chat message status from the same normalized step state before persisting an update.

#### Scenario: All steps complete without queued work remaining

- **WHEN** every normalized workflow step is completed
- **THEN** WorkflowMessageData SHALL be persisted as completed
- **AND** its Chat message SHALL be persisted as successful

#### Scenario: A step fails and remains retryable

- **WHEN** a normalized workflow step enters failed
- **THEN** WorkflowMessageData SHALL be persisted as failed
- **AND** its Chat message SHALL be persisted as failed while preserving retry context

### Requirement: Legacy Engine Workflows SHALL Retain Fallback Recovery

The system SHALL continue to resume a workflow through `MainThreadWorkflowEngine` when and only when a compatible persisted workflow-store record exists.

#### Scenario: A legacy engine workflow has resumable steps

- **GIVEN** the workflow store contains a workflow with pending, running, or pending-main-thread steps
- **WHEN** recovery selects the legacy engine owner
- **THEN** running steps SHALL be normalized for resume according to the existing engine contract
- **AND** execution events SHALL continue through the workflow submission service

