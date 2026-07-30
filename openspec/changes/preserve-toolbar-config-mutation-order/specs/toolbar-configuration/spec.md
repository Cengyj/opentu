## ADDED Requirements

### Requirement: Overlapping toolbar configuration mutations preserve accepted order

The system SHALL preserve the accepted order and durable outcome of overlapping existing toolbar visibility, order, show/hide, and reset operations without changing the stored `ToolbarConfig` format.

#### Scenario: Two overlapping toolbar operations succeed
- **GIVEN** toolbar configuration initialization has completed with a durable configuration
- **WHEN** the user accepts operation A and then operation B before A has settled
- **AND** both storage operations succeed
- **THEN** B SHALL be applied after A to the last successfully committed configuration
- **AND** shared and durable toolbar state SHALL converge on that ordered result
- **AND** refresh after both operations settle SHALL restore the same visibility and order

#### Scenario: Earlier overlapping operation fails
- **GIVEN** operation A and then operation B were accepted while A was unresolved
- **WHEN** A fails and B succeeds
- **THEN** A's uncommitted whole-record candidate SHALL NOT become shared or durable later
- **AND** B SHALL be derived from the last durable configuration before A
- **AND** A SHALL report only its own bounded retryable failure outcome

#### Scenario: Later overlapping operation fails
- **GIVEN** operation A and then operation B were accepted while A was unresolved
- **WHEN** A succeeds and B fails
- **THEN** A's committed result SHALL remain the shared and durable toolbar configuration
- **AND** B SHALL NOT roll back, duplicate, or overwrite A
- **AND** retrying B successfully SHALL apply it once after A

#### Scenario: Overlapping toolbar operations preserve data compatibility
- **GIVEN** rapid reset, visibility, or reorder operations are accepted
- **WHEN** the ordered operations settle
- **THEN** each successful operation SHALL produce at most one write in accepted execution order
- **AND** the storage key, version, serialized shape, button IDs, migration rules, and default layout SHALL remain compatible
- **AND** no repository-wide queue, cross-tab lock, or new toolbar action SHALL be introduced
