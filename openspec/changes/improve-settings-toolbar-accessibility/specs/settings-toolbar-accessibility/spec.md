## ADDED Requirements

### Requirement: Existing nested toolbar menus remain operable without hover

The system SHALL allow users to open, navigate, select, and close the existing application-menu submenus and toolbar More panel with keyboard and touch input without changing their existing actions or pointer behavior.

#### Scenario: Open and select a submenu with the keyboard
- **GIVEN** focus is on an enabled application-menu item that owns a submenu
- **WHEN** the user presses Right, Enter, or Space and then activates a submenu leaf
- **THEN** the submenu SHALL open and focus an enabled child item
- **AND** the selected existing language or export action SHALL run exactly once
- **AND** the enclosing application menu SHALL dismiss exactly once after leaf selection

#### Scenario: Return from a submenu
- **GIVEN** focus is inside an open application-menu submenu
- **WHEN** the user presses Left or closes the current submenu level with Escape
- **THEN** that submenu SHALL close
- **AND** focus SHALL return to its parent item while the applicable outer-menu state is preserved

#### Scenario: Use a submenu with pointer or touch
- **GIVEN** the application menu is open
- **WHEN** the user hovers with a pointer or taps a submenu parent and selects an existing leaf action
- **THEN** the submenu SHALL remain reachable without requiring hover capability
- **AND** the leaf action and outer-menu dismissal SHALL not be duplicated

#### Scenario: Open the existing More panel with the keyboard
- **GIVEN** focus is on the toolbar More button on a desktop device
- **WHEN** the user presses Enter or Space
- **THEN** the existing More panel SHALL open and expose its current controls
- **AND** its pointer-hover and touch activation paths SHALL remain available

### Requirement: Existing canvas setting switch has a programmatic name

The system SHALL expose a localized accessible name for the existing setting that controls canvas task-progress-card visibility without changing the setting value or storage behavior.

#### Scenario: Inspect and activate the canvas visibility setting
- **GIVEN** the user opens the canvas settings view in Chinese or English
- **WHEN** assistive technology reaches the task-progress-card switch
- **THEN** the switch SHALL expose a non-empty localized name matching the visible setting
- **AND** its checked state and existing change callback SHALL remain accurate
- **AND** the name SHALL NOT contain provider data, task identifiers, URLs, errors, credentials, or persisted payloads

### Requirement: Existing application-menu actions remain touch operable at compact sizes

The system SHALL provide the existing application-menu parent and leaf actions with compact/pointer-coarse activation boxes of at least 44×44 CSS pixels while retaining menu-owned scrolling and existing desktop density.

#### Scenario: Portrait compact menu

- **GIVEN** the application menu is open at 320×568, 375×667 or 390×844 under compact or pointer-coarse conditions
- **WHEN** the user navigates or activates an existing parent or leaf item
- **THEN** its activation box SHALL be at least 44×44 CSS pixels
- **AND** icons, text, action order and callbacks SHALL remain unchanged

#### Scenario: Short landscape menu

- **GIVEN** the application menu is open at a supported short landscape viewport such as 640×360
- **WHEN** the item list exceeds the available height
- **THEN** the menu SHALL remain internally scrollable inside the viewport
- **AND** keyboard navigation SHALL make the complete active item visible
- **AND** background canvas scrolling SHALL remain unchanged

#### Scenario: Desktop menu

- **GIVEN** the application menu is open at the existing desktop breakpoint without a coarse pointer condition
- **WHEN** the current items and submenus render
- **THEN** existing desktop row density, icon/text sizes, menu order, theme tokens and z-index SHALL remain
