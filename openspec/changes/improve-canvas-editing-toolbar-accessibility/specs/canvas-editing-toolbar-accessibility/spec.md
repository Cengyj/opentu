## ADDED Requirements

### Requirement: Canvas Editing Controls SHALL Expose Localized Accessible Actions and Native Focus Entry

The system SHALL expose localized, distinguishable names and existing control state for canvas creation and size-editing actions, and SHALL preserve native focus navigation from the canvas into those controls, without changing drawing, sizing, history, or persistence semantics.

#### Scenario: Tab leaves the canvas through the native focus order

- **GIVEN** the canvas surface owns focus and no text editor is active
- **WHEN** the user presses Tab without a modifier
- **THEN** the canvas hotkey layer SHALL NOT cancel the browser's native Tab behavior
- **AND** focus SHALL advance to the next focusable application control in DOM order
- **AND** no pointer mode, selection, element, history, or persisted value SHALL change

#### Scenario: Screen reader distinguishes width and height

- **GIVEN** one or more scalable canvas elements are selected
- **WHEN** focus reaches the size inputs in the popup toolbar
- **THEN** the width and height inputs SHALL each expose a localized accessible name
- **AND** the two inputs SHALL remain distinguishable without relying only on visual `W` and `H` text

#### Scenario: Aspect-ratio action exposes its state

- **GIVEN** the size editor is visible
- **WHEN** focus reaches the aspect-ratio control
- **THEN** the control SHALL expose whether ratio locking is active
- **AND** its localized action name SHALL distinguish locking from unlocking
- **AND** activating it SHALL preserve the existing ratio math and size values

#### Scenario: Preset trigger exposes popup state

- **GIVEN** the size editor is visible
- **WHEN** focus reaches the preset-size trigger
- **THEN** the trigger SHALL expose a localized accessible name
- **AND** SHALL expose whether the preset popup is expanded
- **AND** Enter, Space, and Escape SHALL operate the existing popup without adding another focus stop for the same action

#### Scenario: Creation and link actions follow the active locale

- **GIVEN** the application language is Chinese or English
- **WHEN** the shape picker, arrow picker, or selected-text link action is shown
- **THEN** every existing action SHALL expose a name in the active locale
- **AND** existing tool choices, shortcuts, pointer modes, and created element data SHALL remain unchanged

#### Scenario: Touch editing actions meet the activation target threshold

- **GIVEN** the editing surface is touch-capable or within the approved compact breakpoint
- **WHEN** the affected ratio, preset, shape, arrow, or link icon action is rendered
- **THEN** its activation target SHALL be at least 44 by 44 CSS pixels
- **AND** the visual glyph MAY remain smaller
- **AND** the popup SHALL remain within the viewport and SHALL NOT obscure the selected element more than the existing toolbar placement

#### Scenario: Desktop density remains stable

- **GIVEN** the editing surface is a non-touch desktop viewport outside the compact breakpoint
- **WHEN** the affected controls are rendered
- **THEN** their existing visual density and pointer behavior SHALL remain unchanged except for localized names and semantic state
