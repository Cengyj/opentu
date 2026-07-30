## ADDED Requirements

### Requirement: Open tool windows shall remain operable across viewport transitions

The system SHALL keep an already-open toolbox tool window and its title-bar controls inside the current viewport after a viewport resize or orientation change, without remounting the tool content or persisting an automatic responsive clamp as a user-selected window rectangle.

#### Scenario: A desktop tool window enters a compact viewport

- **GIVEN** an internal or iframe toolbox tool is visible in a non-minimized, non-maximized, non-split desktop window
- **WHEN** the viewport becomes smaller than the current tool-window rectangle or configured desktop minimum
- **THEN** the system SHALL reduce the effective minimum and window rectangle to fit the available compact viewport
- **AND** all visible title-bar controls, including close, SHALL remain pointer-operable
- **AND** the mounted tool content and its runtime state SHALL be preserved

#### Scenario: The viewport expands after an automatic compact clamp

- **GIVEN** the system automatically constrained a tool window for a smaller viewport
- **AND** the user did not manually replace that constrained rectangle
- **WHEN** the viewport becomes large enough to contain the pre-transition rectangle
- **THEN** the system SHALL restore the pre-transition rectangle
- **AND** the automatic compact rectangle SHALL NOT replace the user's saved tool-window position or size

#### Scenario: The user changes a constrained compact window

- **GIVEN** the system automatically constrained a tool window for a smaller viewport
- **WHEN** the user manually moves or resizes that window before the viewport expands
- **THEN** the system SHALL treat the user action as the current rectangle
- **AND** SHALL NOT later restore a stale pre-transition rectangle over that user action

#### Scenario: Unrelated window states remain unchanged

- **GIVEN** a tool window is hidden, minimized, maximized, split, or destroyed, or a WinBox belongs to a non-tool feature
- **WHEN** the viewport changes
- **THEN** this tool-window constraint SHALL NOT alter that window's existing state semantics
- **AND** tool execution, iframe sandboxing, canvas insertion, persistence, caching, and multi-instance identity SHALL remain unchanged

#### Scenario: An auto-maximized tool opens larger than the current viewport

- **GIVEN** a toolbox tool is opened or retained in maximized state
- **AND** its manifest or prior numeric dimensions are larger than the current viewport
- **WHEN** the tool window is rendered or the viewport changes
- **THEN** the maximized tool rectangle and title-bar controls SHALL fit inside the current viewport
- **AND** the tool SHALL remain maximized rather than persisting the automatic fit as a user resize
- **AND** the mounted tool content and runtime state SHALL remain available
- **AND** maximized generation dialogs and non-tool WinBox consumers SHALL retain their independently specified behavior
