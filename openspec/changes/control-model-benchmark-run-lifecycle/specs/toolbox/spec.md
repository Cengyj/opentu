## ADDED Requirements

### Requirement: Model Benchmark Runs Shall Have One Truthful Lifecycle Owner

The system SHALL execute at most one active run per benchmark session and SHALL keep start, stop, deletion, persistence, and refresh states aligned with the actual owned provider work.

#### Scenario: Same benchmark session is started twice

- **GIVEN** a benchmark session already has an active run
- **WHEN** another caller starts that same session before the run settles
- **THEN** the second start SHALL NOT create duplicate provider invocations
- **AND** both callers SHALL observe the same owned run outcome

#### Scenario: User stops a benchmark run

- **WHEN** the user stops an active benchmark session
- **THEN** no pending entry SHALL start a new provider invocation
- **AND** abortable in-flight work SHALL receive the supported cancellation signal
- **AND** non-abortable in-flight work SHALL remain truthfully identified as stopping until it settles rather than being reported as remotely cancelled

#### Scenario: User deletes an active benchmark session

- **WHEN** a session is running or stopping
- **THEN** the system SHALL keep the session tracked and prevent deletion until owned provider work settles
- **AND** SHALL guide the user to stop/wait without exposing provider response data

#### Scenario: Page refresh interrupts benchmark execution

- **GIVEN** persisted session or entry state says running or stopping but no runtime run owner exists after load
- **WHEN** benchmark history is restored
- **THEN** the orphaned work SHALL be marked interrupted
- **AND** completed results SHALL be preserved
- **AND** the system SHALL NOT automatically resume, retry, or create a provider request
