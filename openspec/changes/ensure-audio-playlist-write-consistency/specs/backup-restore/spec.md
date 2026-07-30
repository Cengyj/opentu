## ADDED Requirements

### Requirement: Playlist Recovery State Shall Not Become User Backup Content

The system SHALL preserve existing audio playlist metadata and membership backup compatibility while treating incomplete-operation recovery records as private transient state.

#### Scenario: Complete backup exports audio playlists

- **WHEN** complete environment backup captures audio playlist data
- **THEN** it SHALL continue exporting the existing playlist metadata and membership records
- **AND** it SHALL NOT export prepared or committed recovery-journal records as user playlist content

#### Scenario: Replace restore imports audio playlists

- **WHEN** replace restore clears and imports the audio playlist domain
- **THEN** it SHALL clear transient playlist recovery records before importing the existing metadata and membership backup fields
- **AND** initialization SHALL validate/recreate the system favorites playlist after restore without deleting restored custom playlists
