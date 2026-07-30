## ADDED Requirements

### Requirement: Performance-panel settings SHALL reflect durable commit outcomes

The system SHALL distinguish transient panel movement from the last localStorage settings record that completed successfully.

#### Scenario: User changes pinned state and storage succeeds

- **WHEN** the user pins or unpins the performance panel and the complete settings write succeeds
- **THEN** the UI and last-durable state SHALL publish the same new pinned value
- **AND** refresh SHALL restore that value through the existing key and schema

#### Scenario: Pinned-state write is rejected

- **GIVEN** a last-durable performance-panel settings record
- **WHEN** a pin or unpin write throws a quota, security, or equivalent storage error
- **THEN** the UI SHALL retain the last-durable pinned value
- **AND** the stored record SHALL remain unchanged
- **AND** the user SHALL receive localized retry guidance without serialized settings, coordinates, URL, credential, or raw exception text

#### Scenario: User drags and commits a position

- **WHEN** the user moves the panel during one pointer interaction
- **THEN** intermediate positions MAY update transiently without a localStorage write per move event
- **AND** release SHALL attempt at most one complete final settings write
- **AND** a successful write SHALL promote the final clamped position to the last-durable state

#### Scenario: Final drag-position write is rejected

- **WHEN** the final drag-position write is rejected
- **THEN** the panel SHALL restore the last-durable position
- **AND** the stored record SHALL remain unchanged
- **AND** one localized retryable failure outcome SHALL be presented without repeated per-move feedback

#### Scenario: Existing record is missing or malformed

- **WHEN** the settings key is missing, unavailable, or cannot be parsed at mount
- **THEN** the existing default position and unpinned state SHALL remain the safe fallback
- **AND** the component SHALL remain usable without throwing
