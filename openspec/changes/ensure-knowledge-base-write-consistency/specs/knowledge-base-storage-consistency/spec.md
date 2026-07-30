## ADDED Requirements

### Requirement: Knowledge-base note results match required durable records
The system SHALL report a note create, update, or delete as successful only when the note metadata, content, and required associations match that result.

#### Scenario: Note creation fails after one required write
- **GIVEN** the user creates a knowledge-base note
- **WHEN** a required metadata or content write rejects
- **THEN** the operation SHALL reject instead of reporting a created note
- **AND** the system SHALL compensate records created only by that attempt or explicitly report compensation failure

#### Scenario: Note update fails after one required write
- **GIVEN** a note has existing metadata and content
- **WHEN** an update changes both and a later required write rejects
- **THEN** the operation SHALL restore the prior logical note when compensation succeeds
- **AND** it SHALL not report the mixed old/new record set as saved

#### Scenario: Note deletion fails
- **GIVEN** a note has metadata, content, and tag associations
- **WHEN** a required delete step rejects
- **THEN** the system SHALL restore a retryable logical note when compensation succeeds
- **AND** it SHALL report any compensation failure with the exact affected note id and phase

### Requirement: Replacement tags preserve a retryable set
The system SHALL update a note's tag associations without losing the prior set when a replacement write fails.

#### Scenario: Adding a replacement association fails
- **GIVEN** a note has an existing tag set
- **WHEN** replacement adds and removes tags and an addition rejects
- **THEN** the prior tag set SHALL remain effective after successful compensation
- **AND** retry SHALL not create duplicate associations

#### Scenario: Removing an obsolete association fails
- **GIVEN** replacement associations have been prepared
- **WHEN** removing an obsolete association rejects
- **THEN** the system SHALL restore the prior set or explicitly report a partial recovery

### Requirement: Multi-item knowledge-base operations report committed outcomes
The system SHALL expose committed, skipped, and failed items for directory cascades, duplication, imports, restores, and GitHub apply operations.

#### Scenario: Directory cascade partially completes
- **GIVEN** a directory contains multiple notes
- **WHEN** one note mutation rejects after another note committed
- **THEN** the result SHALL identify the committed and failed note ids
- **AND** the UI SHALL not report the entire directory operation as a clean success or clean no-op

#### Scenario: Import note content fails after metadata
- **GIVEN** an imported note does not already exist
- **WHEN** one of its required records rejects
- **THEN** the note SHALL not be included in the committed note count
- **AND** the result SHALL remain safe to retry without duplicating committed directories, tags, notes, or associations

#### Scenario: GitHub apply stops after a committed prefix
- **GIVEN** merged knowledge-base data is being applied locally
- **WHEN** a later record rejects
- **THEN** the result SHALL identify the committed prefix and failed item
- **AND** a retry SHALL converge without duplicating associations or changing merge precedence

### Requirement: Knowledge-base recovery diagnostics protect content privacy
The system SHALL make failed mutation phases diagnosable without logging full note bodies, embedded media payloads, credentials, or source contents.

#### Scenario: Compensation fails
- **GIVEN** a required write and its compensation both reject
- **WHEN** the system records or displays recovery details
- **THEN** it SHALL include the operation, phase, affected ids, and recovery status
- **AND** it SHALL omit full Markdown, base64 data, tokens, and secrets
