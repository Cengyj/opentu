## ADDED Requirements

### Requirement: Knowledge-base navigation supports keyboard and assistive technology
The system SHALL expose directory, note, virtual Skill, related-note, and similar-note navigation with semantic names, current state, and keyboard activation equivalent to pointer activation.

#### Scenario: Select a note without a pointer
- **GIVEN** focus is on a knowledge-base note selection control
- **WHEN** the user presses Enter or Space
- **THEN** the same note SHALL be selected as with pointer activation
- **AND** its selected state SHALL be exposed to assistive technology

#### Scenario: Expand or collapse a directory
- **GIVEN** focus is on a directory disclosure control
- **WHEN** the user activates it
- **THEN** the directory SHALL expand or collapse once
- **AND** the control SHALL expose its accessible name and `aria-expanded` state

#### Scenario: Navigate read-only Skill notes
- **GIVEN** a system or external Skill is listed as a virtual knowledge-base note
- **WHEN** a keyboard or screen-reader user selects it
- **THEN** its read-only editor content SHALL open
- **AND** unavailable edit/delete behavior SHALL not be announced as available

### Requirement: Knowledge-base actions have names and state relationships
The system SHALL provide localized accessible names and applicable state relationships for icon-only knowledge-base actions.

#### Scenario: Inspect editor actions
- **GIVEN** a note editor action for reading, stopping, exporting, inserting media, or metadata disclosure is available
- **WHEN** assistive technology inspects the control
- **THEN** the control SHALL expose a localized action name
- **AND** toggle/disclosure state SHALL be exposed when applicable

#### Scenario: Switch the details tab
- **GIVEN** related-note and extraction tabs are available
- **WHEN** the user activates one by keyboard or pointer
- **THEN** the corresponding details content SHALL be selected once
- **AND** tab selection and controlled content SHALL be exposed semantically

### Requirement: Knowledge-base context menus manage focus
The system SHALL expose knowledge-base context actions as a keyboard-operable menu and SHALL return focus after dismissal.

#### Scenario: Open and use a context menu by keyboard
- **GIVEN** focus is on a directory or note row
- **WHEN** the user invokes its context menu from the keyboard
- **THEN** focus SHALL enter the menu and its available actions SHALL be exposed as menu items
- **AND** activating an item SHALL perform the same action and confirmation as pointer input

#### Scenario: Dismiss a context menu
- **GIVEN** the context menu is open
- **WHEN** the user presses Escape or dismisses it without an action
- **THEN** the menu SHALL close
- **AND** focus SHALL return to the invoking row

### Requirement: Knowledge-base focus recovers after list mutations
The system SHALL move focus to a deterministic remaining control after a focused note or directory is deleted.

#### Scenario: Delete the focused note
- **GIVEN** a focused user note is confirmed for deletion
- **WHEN** deletion succeeds
- **THEN** focus SHALL move to the next note, previous note, or owning directory control in that order of availability
- **AND** focus SHALL not be lost to the document body
