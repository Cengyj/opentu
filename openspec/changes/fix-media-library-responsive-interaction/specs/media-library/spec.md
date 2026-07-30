## ADDED Requirements

### Requirement: The media library shall remain operable on supported narrow viewports

The system SHALL keep the media-library window, its title controls, and its existing primary actions inside the current viewport on cold open, viewport resize, and orientation change, without remounting the media-library content or persisting automatic fitting as a user-selected rectangle.

#### Scenario: Open the media library in a narrow viewport

- **GIVEN** the current viewport cannot contain the configured desktop media-library minimum
- **WHEN** the user opens the media library
- **THEN** the system SHALL reduce the effective compact minimum and fit the window inside the available viewport budget
- **AND** close, upload, view, filter, and selection controls SHALL remain pointer- and keyboard-operable
- **AND** the document SHALL NOT gain horizontal overflow from the media-library window

#### Scenario: An open media library crosses viewport sizes

- **GIVEN** the media library is already open with a selected asset or active batch selection
- **WHEN** the viewport shrinks, expands, or changes orientation
- **THEN** the system SHALL fit the window and title controls inside the new viewport
- **AND** SHALL preserve the mounted content, selection, batch state, and scroll state
- **AND** desktop minima and inspector behavior SHALL remain unchanged when the viewport can contain them

### Requirement: Selected assets shall have reachable mobile details

The system SHALL expose an explicit, accessible details action for the selected media-library asset when the desktop inspector is replaced by the mobile drawer.

#### Scenario: Open and close details for a selected mobile asset

- **GIVEN** the media library is using its mobile layout and an asset is selected
- **WHEN** the user activates the selected asset's details action
- **THEN** the existing inspector SHALL open in the bottom drawer for that asset
- **AND** rename, subject, download, delete, and selection actions SHALL remain available when applicable
- **WHEN** the user closes the drawer
- **THEN** the asset SHALL remain selected
- **AND** focus SHALL return to the details action when it is still mounted, or to a stable grid control otherwise

#### Scenario: No asset is selected in the mobile library

- **GIVEN** the media library is using its mobile layout and no asset is selected
- **WHEN** the grid is displayed
- **THEN** the system SHALL NOT expose an enabled details action with no target
- **AND** browsing, filtering, uploading, and batch selection SHALL remain available
