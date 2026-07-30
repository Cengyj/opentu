## ADDED Requirements

### Requirement: Application menu remains operable above non-modal application windows

The system SHALL render the existing application menu and its submenus above currently open non-modal WinBox application windows so their visible controls remain visually and pointer operable.

#### Scenario: Open application menu over one non-modal window
- **GIVEN** an existing non-modal Settings, generation, media, or tool WinBox is open
- **WHEN** the user opens the application menu from the still-operable toolbar trigger
- **THEN** the complete menu surface SHALL render above the overlapping window
- **AND** pointer hit testing throughout the visible overlap SHALL resolve to menu content
- **AND** the underlying window SHALL NOT intercept those menu interactions

#### Scenario: Open application menu over multiple non-modal windows
- **GIVEN** multiple existing WinBox windows are registered in an activation order
- **WHEN** the user opens the application menu
- **THEN** the menu SHALL remain above the current top non-modal window
- **AND** opening or closing the menu SHALL NOT change window activation order, geometry, minimized/maximized state, or persistence
- **AND** this change SHALL NOT impose a new maximum on existing multi-window creation

#### Scenario: Operate an application submenu over a window
- **GIVEN** the application menu overlaps a non-modal window
- **WHEN** the user opens an existing language or export submenu and activates or dismisses it
- **THEN** the submenu SHALL remain visually and pointer operable above that window
- **AND** the existing single selection/dismissal behavior SHALL remain unchanged

### Requirement: Application-menu stacking change remains scoped

The system SHALL change only the application menu's explicit floating layer while preserving unrelated overlay and data contracts.

#### Scenario: Open application menu without a WinBox
- **GIVEN** no WinBox window is open
- **WHEN** the user opens and closes the application menu
- **THEN** its current placement, dimensions, contents, focus, selection, dismissal, and analytics SHALL remain unchanged

#### Scenario: Render unrelated Popover callers
- **GIVEN** an existing toolbar, feedback, view-navigation, or other Popover caller does not opt into the application-menu layer
- **WHEN** that Popover renders
- **THEN** its current effective stacking SHALL remain unchanged
- **AND** this change SHALL NOT normalize its style or portal behavior

#### Scenario: Preserve higher-priority overlays and data
- **GIVEN** the application menu stacking fix is active
- **WHEN** notification, authentication, viewer, loading, system-error, slideshow, or debug overlays are shown
- **THEN** their existing higher priority SHALL remain unchanged
- **AND** no storage key/schema, toolbar configuration, settings/provider data, task, cache, or user content SHALL change
