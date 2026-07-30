## ADDED Requirements

### Requirement: Primary settings writes report their durable outcome

The system SHALL publish a settings update to shared in-memory consumers only after the primary serialized settings record commits, and SHALL report a primary write failure without exposing private settings data.

#### Scenario: Commit a setting successfully
- **GIVEN** a user changes an existing setting through a settings-manager consumer
- **WHEN** normalization and the primary serialized-record write succeed
- **THEN** the committed manager state SHALL contain the normalized value
- **AND** affected listeners SHALL be notified once with the committed transition
- **AND** the existing settings key and serialized shape SHALL remain compatible

#### Scenario: Primary setting write fails
- **GIVEN** the manager has a previously committed settings snapshot
- **WHEN** preparation, serialization, or the primary storage write for a new value fails
- **THEN** the previously committed manager state SHALL remain authoritative
- **AND** listeners SHALL NOT be notified of the failed candidate as a successful commit
- **AND** the caller SHALL receive a retryable failure outcome whose user/log/analytics representations exclude settings payloads, credentials, provider URLs or bodies, and serialized records

#### Scenario: Interactive caller handles a failed write
- **GIVEN** an existing settings surface displays a candidate value while its primary write is pending
- **WHEN** that write fails
- **THEN** the surface SHALL not present the candidate as durably saved
- **AND** it SHALL restore the committed value or preserve an explicitly unsaved editable draft
- **AND** it SHALL provide localized retry feedback without an unhandled promise rejection
