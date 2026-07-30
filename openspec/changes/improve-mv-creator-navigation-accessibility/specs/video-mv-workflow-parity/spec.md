## ADDED Requirements

### Requirement: MV workflow navigation has localized accessible names

The system SHALL expose one stable localized accessible name for the MV history, favorites, and history-back actions without changing their visible icons, counts, callbacks, or layout.

#### Scenario: Assistive technology enumerates MV navigation

- **WHEN** the MV workflow is on Analyze, Script, or Generate
- **THEN** history and favorites actions SHALL expose localized names
- **WHEN** the MV workflow is on History
- **THEN** the back action and favorite filter SHALL expose localized names
- **AND** names SHALL NOT contain prompts, lyrics, task IDs, credentials, media URLs, or full records

### Requirement: MV selectable music and history rows are keyboard operable

The system SHALL let keyboard users select completed music clips and MV history records with button-equivalent Enter and Space behavior while preserving current pointer results.

#### Scenario: Keyboard user selects a music clip

- **GIVEN** the Analyze page contains a completed music clip
- **WHEN** the focused clip row is activated with Enter or Space
- **THEN** the same clip SHALL be selected exactly once as with pointer activation
- **AND** activating the nested audio control SHALL NOT also select the row

#### Scenario: Keyboard user selects a history record

- **GIVEN** the History page contains an MV record
- **WHEN** the focused record row is activated with Enter or Space
- **THEN** the same record SHALL be selected exactly once as with pointer activation
- **AND** activating nested favorite, expand, delete, or confirm controls SHALL NOT select the row
