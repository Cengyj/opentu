## ADDED Requirements

### Requirement: Chat Session Message Count SHALL Have One Storage Owner

The system SHALL derive each Chat session's durable `messageCount` from message-store mutations in one storage owner and SHALL NOT apply additional caller-owned increments for the same mutation.

#### Scenario: A normal Chat turn persists two messages

- **GIVEN** a session contains `N` persisted messages
- **WHEN** one user message and one assistant terminal message are inserted with distinct IDs
- **THEN** the session SHALL contain `N + 2` message records
- **AND** its durable `messageCount` SHALL equal `N + 2`

#### Scenario: A workflow turn persists a user and workflow message

- **GIVEN** a session contains `N` persisted messages
- **WHEN** one workflow user message and one workflow assistant message are inserted
- **THEN** the durable `messageCount` SHALL equal `N + 2`
- **AND** no caller SHALL add another pair count after the storage inserts

#### Scenario: The same message ID is written again

- **GIVEN** a message ID already exists in its owning session
- **WHEN** the complete message record is written again with that ID
- **THEN** the record SHALL be replaced without increasing `messageCount`

### Requirement: Loaded Legacy Chat Counts SHALL Reconcile Without Activity Drift

The system SHALL correct an opened session's old `messageCount` from the message records already loaded for that session and SHALL preserve unrelated session metadata.

#### Scenario: An opened session has an inflated legacy count

- **GIVEN** a session stores two message records and an older `messageCount` greater than two
- **WHEN** the session is loaded for display
- **THEN** its durable and in-memory `messageCount` SHALL become two
- **AND** its title, creation time, and `updatedAt` SHALL remain unchanged by reconciliation

### Requirement: Chat Terminal State SHALL Have A Durable Completion Boundary

The system SHALL await the terminal assistant-message write before reporting the normal Chat send operation as durably complete or accepting another normal Chat send.

#### Scenario: Terminal persistence is delayed

- **GIVEN** the provider stream has emitted its last visible content
- **AND** the assistant-message storage write remains pending
- **WHEN** the send operation reaches terminal handling
- **THEN** the durable completion boundary SHALL remain pending
- **AND** another normal Chat send SHALL NOT be accepted as though the first were durable

#### Scenario: Terminal persistence fails

- **WHEN** the assistant-message storage write rejects
- **THEN** the Chat state SHALL expose a safe failure instead of durable success
- **AND** logs and user feedback SHALL NOT expose message contents, attachments, API keys, or provider credentials

### Requirement: Agent Workflow Patches SHALL Follow Base Message Persistence

The system SHALL persist a complete assistant base record before applying Agent workflow metadata or terminal-status patches to that message ID.

#### Scenario: Agent response contains tool calls

- **WHEN** a streamed Agent response is converted into a workflow message
- **THEN** the assistant record with session, role, content, timestamp, and status SHALL exist before the first workflow patch
- **AND** refreshing after the patch completes SHALL return the workflow metadata on that record

### Requirement: Committed Chat Session Metadata SHALL Reach The Session List

The system SHALL project committed Chat session activity metadata into the in-memory session list without requiring a page refresh.

#### Scenario: A normal Chat turn commits

- **GIVEN** the active session is visible in the session list
- **WHEN** its user and assistant messages reach the durable terminal boundary
- **THEN** the in-memory count and `updatedAt` SHALL match the committed session record
- **AND** the session list's displayed time and ordering SHALL use the committed metadata
