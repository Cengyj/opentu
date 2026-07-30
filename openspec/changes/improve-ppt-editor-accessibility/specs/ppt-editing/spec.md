## ADDED Requirements

### Requirement: PPT Editing Controls Are Programmatically Identifiable

The system SHALL expose every existing PPT editing and slideshow control with a localized accessible name and state that matches its current operation.

#### Scenario: Assistive technology reaches PPT editor actions

- **GIVEN** the PPT editing panel is open
- **WHEN** keyboard or assistive-technology focus reaches view, add, play, export, arrange, outline, or per-page icon actions
- **THEN** every action SHALL expose a non-empty localized name
- **AND** view/toggle actions SHALL expose their current selected state
- **AND** disabled or pending actions SHALL remain identifiable

#### Scenario: User enters a custom Frame size

- **GIVEN** the add-PPT-page dialog is open
- **WHEN** focus reaches the two numeric inputs and custom-size add action
- **THEN** width and height SHALL have distinct localized names with dimension context
- **AND** the add action SHALL be identifiable without relying on its icon or hover text

### Requirement: PPT Slideshow Controls Remain Operable With Keyboard And Assistive Technology

The system SHALL expose slideshow drawing and navigation controls with localized names, selection states, and visible keyboard focus.

#### Scenario: User selects a slideshow tool or pen option

- **GIVEN** slideshow controls are visible
- **WHEN** the user reaches select, pen, eraser, laser, color, stroke-style, or stroke-width controls
- **THEN** each control SHALL expose its operation or option name
- **AND** the current selection SHALL be programmatically distinguishable
- **AND** Enter/Space activation SHALL invoke the same existing action as pointer activation

#### Scenario: Inactivity timer runs while a control is focused

- **GIVEN** keyboard focus is within the slideshow controls
- **WHEN** the pointer inactivity timer would otherwise hide the controls
- **THEN** the focused control and its focus indicator SHALL remain visible
- **AND** controls MAY resume the existing inactivity behavior after focus leaves

#### Scenario: User navigates or exits slideshow

- **WHEN** previous, next, or exit interaction is available
- **THEN** its accessible name SHALL match the current action
- **AND** existing page order, keyboard shortcuts, fullscreen lifecycle, and viewport restoration SHALL remain unchanged
