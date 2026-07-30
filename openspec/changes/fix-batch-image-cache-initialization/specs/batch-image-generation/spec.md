## ADDED Requirements

### Requirement: Batch-image draft hydration shall not replace accepted row mutations

The system SHALL establish one authoritative initial draft from the existing batch-image cache or existing default rows before accepting row mutations or generation submission, and SHALL NOT replace an accepted mutation with a late initial cache result.

#### Scenario: A saved draft is still loading

- **GIVEN** the initial batch-image cache read has not settled
- **WHEN** the batch-image tool content is visible
- **THEN** the system SHALL expose a named loading state
- **AND** SHALL NOT expose row mutation, import, deletion, reference-image, or generation submission as available actions

#### Scenario: A valid saved draft loads

- **GIVEN** the initial cache contains a non-empty valid batch-image draft
- **WHEN** the read settles
- **THEN** the system SHALL render that draft exactly once
- **AND** subsequent accepted edits SHALL remain authoritative over the completed initial read

#### Scenario: No usable saved draft loads

- **GIVEN** the initial cache is empty, malformed, or cannot be read
- **WHEN** the initial read attempt settles
- **THEN** the system SHALL render the existing default rows and allow editing
- **AND** SHALL preserve the existing cache key, value shape, and later save behavior

#### Scenario: The tool closes before hydration settles

- **GIVEN** the initial cache read is pending
- **WHEN** the batch-image tool unmounts
- **THEN** the late result SHALL NOT update the unmounted tool
- **AND** SHALL NOT delete or rewrite the stored draft
