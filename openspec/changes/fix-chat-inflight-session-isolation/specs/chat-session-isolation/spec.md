## ADDED Requirements

### Requirement: Busy Chat Submission SHALL Preserve The User Draft

The system SHALL expose whether a normal Chat message was accepted and SHALL preserve the draft when a submission is rejected because another normal Chat request is in flight.

#### Scenario: User submits while another Chat request is active

- **GIVEN** one normal Chat request owns the in-flight boundary
- **AND** the user has entered another message or selected attachments
- **WHEN** the user or a programmatic caller attempts another submission
- **THEN** no second provider request or message-store mutation SHALL occur
- **AND** the new draft text and attachments SHALL remain available
- **AND** the UI SHALL expose a non-sensitive busy state instead of silently clearing the draft

#### Scenario: The active request reaches its durable terminal boundary

- **WHEN** the current request's terminal persistence succeeds or reports failure
- **THEN** normal Chat submission SHALL become available again
- **AND** the preserved draft SHALL remain under the user's control

### Requirement: Latest Chat Session Selection SHALL Own Async Projection

The system SHALL commit asynchronously loaded ordinary messages, raw provider history, workflow messages, and loading state only for the latest active session selection.

#### Scenario: An older session read resolves after a newer selection

- **GIVEN** session A's message read is pending
- **AND** the user selects session B and B's read resolves first
- **WHEN** A's older read resolves later
- **THEN** B SHALL remain the active visible and raw-history session
- **AND** A's completion SHALL NOT overwrite B's messages, workflow map, or loading state

#### Scenario: A selected session is deleted while its read is pending

- **WHEN** the active session is removed or replaced before its pending read resolves
- **THEN** that completion SHALL NOT recreate or project the removed session into the current Chat UI

### Requirement: In-Flight Chat Callbacks SHALL Remain Bound To Their Origin Session

The system SHALL bind stream, terminal, error, and tool-call updates to the session that accepted the request and SHALL NOT append those updates to a later active session.

#### Scenario: User switches sessions during a stream

- **GIVEN** session A accepted a normal Chat request
- **WHEN** the user selects session B before A reaches terminal state
- **THEN** A's durable messages SHALL continue to target session A
- **AND** A's streamed content and raw history SHALL NOT be appended to session B
- **AND** a second normal provider request SHALL remain unavailable until A reaches its terminal durable boundary

#### Scenario: Origin request fails after another session is selected

- **GIVEN** session B is active after a request started in session A
- **WHEN** the origin request emits an error or storage failure
- **THEN** session B's visible messages and provider history SHALL remain unchanged
- **AND** the error SHALL remain associated with session A without exposing sensitive payloads

