## ADDED Requirements

### Requirement: The Latest Playback Intent Shall Own Shared Audio State

The system SHALL allow only the latest audio, reading, or stop intent to mutate the shared playback session after asynchronous cache and media-play boundaries settle.

#### Scenario: Older cache resolution completes after the latest track

- **GIVEN** track A is still resolving its playback URL
- **WHEN** the user selects track B and B becomes the latest playback intent before A resolves
- **THEN** A SHALL NOT replace B's media source, metadata, queue index, play state, timing, or error state
- **AND** the shared player SHALL continue to identify B as active

#### Scenario: Obsolete play attempt rejects after a newer track starts

- **GIVEN** track B is the current playback intent
- **WHEN** an earlier track A `play()` promise later rejects
- **THEN** A's rejection SHALL NOT pause B or publish A's error as B's playback error
- **AND** a failure from the current owning intent SHALL retain the existing user feedback path

#### Scenario: Stop or reading invalidates pending audio

- **GIVEN** an audio request is waiting at an asynchronous playback boundary
- **WHEN** the user closes/stops the player, the playback owner unmounts, or a reading source becomes the latest intent
- **THEN** the pending audio request SHALL NOT reactivate audio or replace the resulting cleared/reading state after it settles
- **AND** the system SHALL NOT claim physical cancellation when the underlying cache or provider boundary cannot be aborted
