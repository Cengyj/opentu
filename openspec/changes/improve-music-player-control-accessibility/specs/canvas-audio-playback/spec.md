## ADDED Requirements

### Requirement: Global Playback Actions Shall Have Localized Accessible Names

The system SHALL expose each existing icon-only global playback action with a stable localized accessible name that reflects the action currently available without disclosing private playback data.

#### Scenario: Assistive technology reaches playback actions

- **GIVEN** the global playback overlay is visible
- **WHEN** keyboard or assistive-technology focus reaches previous, play/pause, next, layout, or close
- **THEN** every control SHALL expose a non-empty localized name identifying its operation
- **AND** disabled previous/next controls SHALL remain identifiable
- **AND** visible icons, geometry, callbacks, and pointer behavior SHALL remain unchanged

#### Scenario: Playback or layout state changes

- **WHEN** the current action changes between play/pause or horizontal/vertical layout targets
- **THEN** the corresponding accessible name SHALL update to the action now available
- **AND** the name SHALL NOT include track title, note text, media URL, provider/task/clip identifier, error body, credential, or persisted position

#### Scenario: Music player tool is minimized

- **GIVEN** the music-player tool is playing or paused and shares the global playback session
- **WHEN** the user minimizes the tool and the global overlay becomes visible
- **THEN** the named overlay controls SHALL operate the same shared playback session
- **AND** restoring the tool SHALL preserve the existing track, queue, progress, speed, and mode behavior
