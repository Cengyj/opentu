## ADDED Requirements

### Requirement: Knowledge-base window remains inside supported viewports
The system SHALL keep the opted-in knowledge-base tool window, its title controls, and its content bounds inside the available viewport on cold open and live viewport transitions without enabling the same behavior for unrelated windows.

#### Scenario: Open the knowledge base on a narrow viewport
- **GIVEN** the viewport cannot contain the configured desktop knowledge-base window minimum
- **WHEN** the user opens the knowledge-base tool
- **THEN** the system SHALL reduce only the effective compact minimum and fit the window within the available viewport budget
- **AND** title controls and knowledge-base navigation SHALL remain reachable

#### Scenario: An open knowledge-base window crosses viewport sizes
- **GIVEN** the knowledge-base tool is already open
- **WHEN** the viewport shrinks, expands, or changes orientation
- **THEN** the window SHALL remain inside the new viewport without remounting its knowledge-base content
- **AND** automatic fitting SHALL NOT overwrite the user's retained desktop rectangle

### Requirement: Knowledge-base panes remain navigable in compact containers
The system SHALL provide explicit navigation among the existing note tree, note editor, and related/extraction content when their container cannot display the desktop three-column layout.

#### Scenario: Select a note in compact mode
- **GIVEN** the compact tree pane is visible
- **WHEN** the user selects a writable, system, or external Skill note
- **THEN** the editor pane SHALL become visible for that note
- **AND** an explicit named action SHALL return to the tree pane

#### Scenario: Open related or extraction content in compact mode
- **GIVEN** a note is selected in the compact editor pane
- **WHEN** the user opens the existing details area
- **THEN** the related/extraction pane SHALL become reachable without clearing the selected note or editor draft
- **AND** returning to the editor SHALL preserve the selected details tab

#### Scenario: Resize back to desktop
- **GIVEN** the knowledge base adapted to compact panes
- **WHEN** its container can again contain the desktop layout
- **THEN** the desktop three-column layout and retained sidebar widths SHALL be restored
- **AND** automatic compact adaptation SHALL NOT be saved as a user resize preference

### Requirement: Compact knowledge-base navigation is accessible
The system SHALL expose compact pane navigation with semantic names, keyboard operation, visible focus, and sufficiently sized touch targets.

#### Scenario: Navigate compact panes without a pointer
- **GIVEN** the knowledge base is in compact mode
- **WHEN** the user reaches pane navigation by keyboard and activates it with Enter or Space
- **THEN** the same pane transition as pointer activation SHALL occur
- **AND** focus SHALL move to or return from the newly active pane deterministically

#### Scenario: Use compact navigation on a touch viewport
- **GIVEN** the knowledge base is shown in a supported narrow touch viewport
- **WHEN** navigation and primary note actions are rendered
- **THEN** their activation targets SHALL be at least 44 by 44 CSS pixels
- **AND** no primary action SHALL be clipped by the viewport or pane overflow
