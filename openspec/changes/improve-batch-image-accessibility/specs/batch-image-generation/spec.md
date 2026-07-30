## ADDED Requirements

### Requirement: The batch-image spreadsheet shall be keyboard operable

The system SHALL expose the existing batch-image table as a localized named spreadsheet with a predictable keyboard entry, one active-cell focus model, and keyboard behavior equivalent to the existing pointer-editing behavior.

#### Scenario: A keyboard user enters the spreadsheet

- **WHEN** keyboard focus reaches the batch-image spreadsheet
- **THEN** the spreadsheet SHALL expose a localized name and the active row and column
- **AND** exactly one current cell SHALL be the spreadsheet entry target
- **AND** prompt bodies, image URLs, task IDs, provider errors, credentials, and stored draft contents SHALL NOT appear in its accessible name

#### Scenario: A keyboard user navigates and edits cells

- **GIVEN** focus is on the current spreadsheet cell
- **WHEN** the user presses arrows, Tab, Shift+Tab, Enter, a printable character, Escape, Delete, copy/paste, undo, or redo
- **THEN** the existing active-cell, selection, edit, and history operations SHALL execute once with their current data semantics
- **AND** focus SHALL remain visibly synchronized with the resulting cell or editor
- **AND** the user SHALL be able to leave the spreadsheet at its keyboard boundary

#### Scenario: A nested control handles a key

- **GIVEN** focus is in a textarea, number input, checkbox, model or parameter control, media dialog, viewer, upload action, or other nested interactive surface
- **WHEN** that surface handles Enter, Space, Escape, Tab, or arrow keys
- **THEN** the outer spreadsheet SHALL NOT execute a duplicate cell action

### Requirement: Batch-image actions shall expose localized accessible names

The system SHALL provide stable localized accessible names for existing batch-image toolbar, column-fill, row-selection, row-image, add-row, library, import/export, and generation controls without changing their visible action results.

#### Scenario: A user explores batch-image controls with assistive technology

- **WHEN** assistive technology enumerates the batch-image controls
- **THEN** each available action SHALL expose its action and scope in Chinese or English
- **AND** row-selection names SHALL identify the corresponding 1-based row or the select-all scope
- **AND** icon-only controls SHALL NOT depend solely on hover content or visual position for their name

#### Scenario: A pointer user activates an existing action

- **WHEN** a pointer user selects, edits, fills, imports, uploads, downloads, generates, opens the library, or closes a nested surface
- **THEN** the current action availability, result, analytics payload semantics, and table layout SHALL remain unchanged
