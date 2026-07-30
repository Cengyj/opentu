## ADDED Requirements

### Requirement: Edited media remains recoverable until persistence succeeds

The system SHALL keep the edited image output and edit state available until an overwrite or insert persistence operation completes successfully.

#### Scenario: Edited image persists successfully

- **GIVEN** the user has produced an edited image
- **WHEN** the user chooses overwrite or insert
- **THEN** the system SHALL wait for the cache and board operation to complete
- **AND** SHALL return to preview only after that operation succeeds

#### Scenario: Edited image persistence fails

- **GIVEN** the user has produced an edited image
- **WHEN** its cache write, image decode, board update, or insertion fails
- **THEN** the system SHALL report the failure
- **AND** SHALL keep the edited output and edit state available for another save attempt or cancellation

#### Scenario: Save is activated repeatedly while pending

- **GIVEN** an overwrite or insert persistence operation is still pending
- **WHEN** the user activates the save action again
- **THEN** the system SHALL NOT start a duplicate persistence operation
- **AND** SHALL continue to expose the pending state
