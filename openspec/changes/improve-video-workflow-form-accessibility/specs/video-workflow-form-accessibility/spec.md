## ADDED Requirements

### Requirement: Video workflow fields have programmatic names

The system SHALL expose one stable programmatic accessible name for every visible video-workflow input, textarea, native select, editable preset selector, and form model selector.

#### Scenario: Assistive technology enumerates the video workflow form

- **WHEN** the Analyze, Script, or corresponding MV form is rendered
- **THEN** every visible field SHALL be associated with its visible localized label or an equivalent localized accessible name
- **AND** target-duration and segment-duration controls SHALL be distinguishable without relying on visual proximity or placeholder text
- **AND** naming metadata SHALL NOT contain prompt bodies, credentials, provider secrets, or generated media data

### Requirement: Editable preset selectors follow the combobox keyboard contract

The system SHALL expose shared editable preset selectors as a named combobox controlling a listbox and SHALL provide keyboard behavior equivalent to existing pointer selection.

#### Scenario: Keyboard user selects a preset

- **GIVEN** an editable preset selector has options
- **WHEN** the user opens it and presses ArrowDown, ArrowUp, Home, or End
- **THEN** the active option SHALL move within the filtered list without committing a different value
- **AND** Enter SHALL commit the active option exactly once and close the listbox
- **AND** the committed value SHALL equal pointer selection of the same option

#### Scenario: Keyboard user dismisses the preset list

- **GIVEN** an editable preset listbox is open
- **WHEN** the user presses Escape
- **THEN** the listbox SHALL close without changing the current value
- **AND** focus SHALL remain on its combobox input
- **AND** the same Escape event SHALL NOT close the outer tool window

#### Scenario: User enters a custom value

- **WHEN** the user types a value that is not a preset
- **THEN** the existing free-text value SHALL remain accepted
- **AND** filtering, prompt construction, record persistence, and task submission SHALL retain their existing value semantics

