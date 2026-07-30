## ADDED Requirements

### Requirement: Performance-panel controls SHALL be operable and named without pointer hover

The system SHALL expose the existing performance-panel actions and movement through standard keyboard and assistive-technology semantics while preserving pointer behavior.

#### Scenario: Assistive technology inspects panel actions

- **WHEN** the performance panel is visible in Chinese or English
- **THEN** create-project when present, refresh, pin/unpin, and close buttons SHALL have localized programmatic names
- **AND** pin state SHALL be exposed as a toggle state
- **AND** an in-flight create-project action SHALL expose its disabled/busy state
- **AND** names SHALL NOT contain board, media, task, provider, URL, credential, or raw diagnostic values

#### Scenario: Keyboard user moves the panel

- **WHEN** focus is on the move control and the user presses a supported Arrow key
- **THEN** the panel SHALL move by the documented fixed step in that direction
- **AND** its position SHALL remain clamped within the current viewport
- **AND** focus SHALL remain on the move control
- **AND** the page SHALL NOT also scroll for the handled key

#### Scenario: Pointer user drags the panel

- **WHEN** the user drags and releases the existing move control
- **THEN** pointer capture, viewport clamping, visual drag state, and final action behavior SHALL remain equivalent to the current panel

#### Scenario: Panel is not visible

- **WHEN** current memory/image/pinned/dismissed rules do not show the performance panel
- **THEN** the accessibility changes SHALL NOT add a hidden focus stop or announce an inactive panel
