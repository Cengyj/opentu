## ADDED Requirements

### Requirement: Toolbar configuration mutations report durable outcomes

The system SHALL keep the shared toolbar configuration consistent with the last successfully persisted configuration when an existing visibility, order, or reset action succeeds or fails.

#### Scenario: Persist a toolbar configuration mutation
- **GIVEN** toolbar configuration initialization has completed
- **WHEN** the user removes, restores, reorders, or resets an existing toolbar control and the IndexedDB write succeeds
- **THEN** the shared toolbar UI SHALL publish the committed configuration
- **AND** refresh SHALL restore the same button visibility and order
- **AND** the existing storage key, version, and serialized shape SHALL remain compatible

#### Scenario: Toolbar configuration write fails
- **GIVEN** a previously committed toolbar configuration is active
- **WHEN** the storage write for a new visibility, order, or reset candidate fails
- **THEN** the previous committed configuration SHALL remain authoritative in the shared UI
- **AND** the user SHALL receive localized retryable feedback
- **AND** no error, log, analytics event, or accessible name SHALL contain serialized toolbar contents, board/settings data, URLs, credentials, or storage payloads

#### Scenario: Retry after a toolbar write failure
- **GIVEN** an interactive toolbar mutation failed and the prior configuration remains active
- **WHEN** the user retries the same existing action and storage succeeds
- **THEN** the candidate SHALL become the shared committed configuration
- **AND** a later refresh SHALL restore it without duplicating the action
