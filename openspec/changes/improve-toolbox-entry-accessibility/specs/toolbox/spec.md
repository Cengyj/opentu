## ADDED Requirements

### Requirement: Toolbox Tool Entries Are Keyboard and Screen-Reader Operable
The system SHALL expose each actionable toolbox tool card and its icon-only actions with distinct accessible names and keyboard behavior equivalent to their existing pointer actions.

#### Scenario: User opens a tool from its card by keyboard
- **GIVEN** a tool card opens the tool in a window when clicked
- **WHEN** keyboard focus is on the card and the user presses Enter or Space
- **THEN** the same existing window-open action runs exactly once
- **AND** the card's accessible name identifies the target tool

#### Scenario: User navigates explicit tool actions
- **WHEN** keyboard or screen-reader focus reaches a tool card's delete, insert-to-canvas, or open-in-window action
- **THEN** the action exposes a name that identifies both the operation and target tool
- **AND** activating the child action SHALL NOT also activate the card's default window-open action

#### Scenario: Pointer behavior remains unchanged
- **WHEN** a pointer user clicks the card or one of its explicit actions
- **THEN** the same callback and visual behavior as before the accessibility change occurs
- **AND** no action is submitted twice
