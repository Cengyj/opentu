## ADDED Requirements

### Requirement: `.drawnix` export shall use one point-in-time board snapshot

The system SHALL derive the exported elements, viewport and embedded-media URL set from one JSON-compatible snapshot captured before asynchronous media collection begins.

#### Scenario: Board changes while media collection is pending

- **GIVEN** a `.drawnix` save has captured its board snapshot and is waiting for embedded-media work
- **WHEN** the user inserts, deletes or edits a live board element
- **THEN** the exported elements SHALL remain the captured pre-edit values
- **AND** the embedded-media URL set SHALL correspond to those same captured elements
- **AND** the live edit SHALL remain on the board for a later save

#### Scenario: Viewport changes while media collection is pending

- **GIVEN** a `.drawnix` save is waiting for embedded-media work
- **WHEN** the user pans or zooms the live board
- **THEN** the exported viewport SHALL remain the value captured with the exported elements
- **AND** the live viewport change SHALL remain available for a later save

#### Scenario: Board has no virtual media

- **WHEN** export captures a board with no supported virtual media URL
- **THEN** the file SHALL contain the captured elements and viewport
- **AND** the optional embedded-media field MAY remain absent as in the current version-1 format

### Requirement: `.drawnix` snapshot capture shall preserve current data compatibility

The system SHALL keep the existing version-1 `.drawnix` schema, MIME type, extension, import path and JSON-compatible value semantics while stabilizing the snapshot boundary.

#### Scenario: Current version-1 file is exported and imported

- **WHEN** a user saves and imports a version-1 `.drawnix` file with supported embedded media
- **THEN** the existing type, version, source, elements, viewport and optional embedded-media fields SHALL remain compatible
- **AND** media restoration SHALL use the existing cache boundary

#### Scenario: Legacy version-1 file has no embedded media

- **WHEN** a valid existing version-1 file without `embeddedMedia` is imported
- **THEN** the file SHALL continue through the existing loader without migration

#### Scenario: Save is cancelled

- **WHEN** the user aborts the existing file-save picker
- **THEN** the cancellation SHALL remain a non-error outcome
- **AND** snapshot capture SHALL NOT mutate the board, history, workspace or cache

#### Scenario: Serialization fails

- **WHEN** a supported board value cannot be serialized or required snapshot work rejects
- **THEN** the save promise SHALL reject through the existing error boundary
- **AND** SHALL NOT write a partial `.drawnix` file

### Requirement: Snapshot consistency shall not add locking or persistence side effects

The system SHALL create the export snapshot without blocking normal editing or adding board, storage, cache, task or migration side effects.

#### Scenario: User continues editing during save

- **WHEN** snapshot capture has completed and asynchronous media collection continues
- **THEN** normal board edits SHALL remain available
- **AND** the export path SHALL NOT create a board operation, history entry or workspace autosave write solely for snapshot capture

#### Scenario: Data contracts are compared before and after correction

- **WHEN** the snapshot correction is applied or rolled back
- **THEN** board elements, workspace records, caches, backups, tasks, assets and analytics SHALL retain their existing formats
- **AND** no migration, cache purge, credential, provider request or external endpoint change SHALL be required

