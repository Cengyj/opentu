## ADDED Requirements

### Requirement: Music Analyzer Controls Shall Be Programmatically Named And Stateful

The system SHALL expose localized accessible names and programmatic state for existing Music Analyzer navigation, creation modes, favorites, expansion, model/form, and generation controls.

#### Scenario: User navigates Music Analyzer with assistive technology

- **WHEN** focus reaches history, favorites, history back, scratch/reference mode, favorite, expand, or icon-only actions
- **THEN** each action SHALL expose one useful localized name
- **AND** mode/favorite/filter/expanded state SHALL be programmatically available where applicable
- **AND** accessible names SHALL NOT contain prompts, lyrics, filenames, media URLs, task IDs, provider bodies, credentials, or internal record payloads

### Requirement: Music Analyzer Existing Pointer Actions Shall Have Keyboard Parity

The system SHALL let a keyboard user invoke the existing audio-upload and history-record selection actions with Enter or Space while preserving nested interactive controls.

#### Scenario: User selects an audio upload by keyboard

- **GIVEN** the reference-audio creation mode is active
- **WHEN** the user focuses the named upload trigger and presses Enter or Space
- **THEN** the existing audio file chooser SHALL be invoked exactly once
- **AND** click, drag/drop, file-type acceptance, preview, clear, and analysis behavior SHALL remain unchanged

#### Scenario: User selects a history record by keyboard

- **GIVEN** a Music Analyzer history record is rendered
- **WHEN** the focused record is activated with Enter or Space
- **THEN** it SHALL select the same record exactly once as the current pointer action
- **AND** activating nested audio, favorite, expand, delete, or related-task controls SHALL NOT select the parent record

### Requirement: Music Analyzer Feedback Shall Be Announced Without Exposing Private Content

The system SHALL announce terminal errors assertively and non-urgent progress or success politely, without duplicating unchanged announcements or adding private content to accessible names.

#### Scenario: Generation status changes

- **WHEN** analysis, lyrics, or music feedback changes among loading, progress, success, failure, cancellation, retry, or recovery
- **THEN** the current meaningful state SHALL be available through an appropriate status or alert region
- **AND** an unchanged message SHALL NOT be re-announced only because the component re-rendered

### Requirement: Music Analyzer Compact Actions Shall Remain Touch Operable

The system SHALL keep primary Music Analyzer navigation and action hit areas at least 44 by 44 CSS pixels in compact touch layouts while preserving the established desktop visual hierarchy.

#### Scenario: Tool is used in a compact touch viewport

- **WHEN** the Music Analyzer window is constrained into the supported compact viewport
- **THEN** primary navigation, mode, favorite, upload, and submit actions SHALL expose at least a 44 by 44 CSS pixel hit area
- **AND** controls and focus indicators SHALL remain inside the tool content boundary
