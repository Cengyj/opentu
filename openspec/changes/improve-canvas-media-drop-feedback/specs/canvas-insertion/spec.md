## ADDED Requirements

### Requirement: Direct canvas media drops report their settled result

The system SHALL provide one user-visible result after a direct file drop has classified and attempted all supported media files.

#### Scenario: Every supported file is inserted

- **WHEN** all supported image, video, or audio files in a drop are inserted successfully
- **THEN** the system SHALL preserve every inserted element
- **AND** SHALL NOT report a failure

#### Scenario: Some supported files fail

- **WHEN** at least one supported file is inserted and at least one supported file fails
- **THEN** the system SHALL preserve the successful insertions
- **AND** SHALL report the successful and failed counts after the batch settles
- **AND** SHALL restore the viewport anchor according to the existing drop behavior

#### Scenario: Every supported file fails

- **WHEN** no supported file in the drop can be inserted
- **THEN** the system SHALL report that the drop failed
- **AND** SHALL NOT claim that media was added to the canvas

#### Scenario: Drop includes unsupported files

- **WHEN** a direct file drop contains unsupported files
- **THEN** the settled result SHALL report the unsupported count
- **AND** SHALL keep the existing support classification and successful supported-file insertions unchanged
