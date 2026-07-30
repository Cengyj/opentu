## MODIFIED Requirements

### Requirement: Replace Restore

The system SHALL support replace restore for complete backups by clearing selected local domains before importing backup data.

#### Scenario: Replace restore mirrors the backup

- **GIVEN** the current browser has existing local data
- **AND** the user selects replace restore for a complete backup
- **WHEN** restore completes
- **THEN** selected domains SHALL match the backup content instead of being merged with previous local content
- **AND** the workspace SHALL reload and restore the backed-up current board when available

#### Scenario: Restored workspace does not silently replace a non-empty current board

- **GIVEN** project import has reloaded workspace metadata
- **AND** the current board contains persisted elements
- **AND** the backup records a different current board
- **WHEN** the user closes the completed restore dialog
- **THEN** the system SHALL determine emptiness from the complete persisted current board rather than a metadata-only projection
- **AND** the system SHALL request confirmation before switching to the backed-up board
- **AND** cancelling the confirmation SHALL keep the current board, URL, and tab-local selection unchanged

#### Scenario: Empty current board can still switch automatically

- **GIVEN** project import has reloaded workspace metadata
- **AND** the complete persisted current board has no elements
- **WHEN** the user closes the completed restore dialog
- **THEN** the system MAY switch automatically to the backed-up current board
