## ADDED Requirements

### Requirement: Project drawer exposes a named non-modal focus contract

The system SHALL expose the existing project drawer as a named non-modal working region related to its toolbar trigger, with deterministic focus entry and return.

#### Scenario: User opens the project drawer

- **WHEN** the user activates the existing project toolbar trigger
- **THEN** the trigger exposes the drawer relationship and expanded state
- **AND** the project drawer exposes one stable programmatic name
- **AND** focus moves to the existing project search input without activating an operation

#### Scenario: User closes the project drawer by keyboard

- **WHEN** focus is inside the project drawer and the user presses Escape or activates its close control outside a nested edit, menu or dialog
- **THEN** the drawer closes exactly once
- **AND** focus returns to the visible project toolbar trigger

#### Scenario: A nested project interaction consumes Escape

- **WHEN** rename, an item menu or a delete confirmation is the active nested layer
- **THEN** the first Escape closes or cancels only that nested layer
- **AND** the project drawer remains open with focus at the invoking item or control

### Requirement: Project tree is keyboard operable and exposes state

The system SHALL expose the rendered folder and board hierarchy with a bounded roving keyboard model and the same operation callbacks as the current pointer path.

#### Scenario: Assistive technology reads project hierarchy state

- **WHEN** folders, the current board and selected boards are rendered
- **THEN** folder items expose expanded or collapsed state
- **AND** the active board exposes current state
- **AND** multi-selected boards expose selected state

#### Scenario: User navigates the rendered hierarchy

- **WHEN** focus is in the project tree and the user presses Up, Down, Left or Right
- **THEN** focus moves or folder expansion changes according to the visible hierarchy
- **AND** no board switch, create, move, copy, rename or delete callback is invoked by focus movement alone

#### Scenario: User activates a folder or board by keyboard

- **WHEN** the user presses Enter or Space on a focused folder or board item
- **THEN** the same primary handler as the existing unmodified pointer click runs exactly once
- **AND** existing Shift, Control or Command selection intent is preserved where applicable

#### Scenario: A focused item disappears after refresh

- **WHEN** a workspace event removes or filters out the focused item
- **THEN** focus moves to the nearest surviving rendered item or the named tree container
- **AND** the system does not implicitly activate an item

### Requirement: Project item actions and menus are named and focus safe

The system SHALL provide a visible, localized keyboard path to every existing board and folder item action.

#### Scenario: User focuses an item action control

- **WHEN** keyboard focus reaches a board or folder More control
- **THEN** the control is visibly exposed and has an item-specific localized name
- **AND** activating it opens the existing actions without triggering the row action

#### Scenario: User opens the project context menu by keyboard

- **WHEN** a project tree item is focused and the user presses Shift+F10 or the ContextMenu key
- **THEN** the existing supplemental item menu opens at that item
- **AND** focus moves to the first enabled menuitem

#### Scenario: User navigates or closes a project item menu

- **WHEN** an item menu or its move submenu is open
- **THEN** Arrow keys, Home, End, Enter and Space operate the current menu level without duplicate selection
- **AND** Escape closes the current menu layer and returns focus to its invoker

#### Scenario: User renames an item from an action

- **WHEN** the user selects Rename from an item action
- **THEN** the existing inline input receives focus and selected text
- **AND** Enter submits once while Escape cancels and returns focus to the same item

### Requirement: Project tree states distinguish loading, true empty and no match

The system SHALL describe the current board-tree state without representing a filtered result as persisted workspace emptiness.

#### Scenario: Workspace tree is loading

- **WHEN** ProjectDrawer is waiting for the current workspace tree
- **THEN** it exposes one localized bounded loading status
- **AND** it does not expose empty or no-match actions at the same time

#### Scenario: Workspace contains no boards

- **WHEN** the unfiltered workspace tree is empty and no search result exists
- **THEN** the current true-empty message and create-first-board action are available

#### Scenario: Search has no matches in a non-empty workspace

- **WHEN** the unfiltered tree contains items and a non-empty query returns no rendered items
- **THEN** the drawer exposes a localized no-match message
- **AND** it does not claim that the workspace has no boards
- **AND** it does not expose the create-first-board action for that filtered state

### Requirement: Workspace manager system copy follows the selected language

The system SHALL use the existing application language owner for ProjectDrawer shell and F-02 board/folder-management copy while preserving user data.

#### Scenario: ProjectDrawer opens in English

- **WHEN** the selected application language is English
- **THEN** the drawer shell, board/folder actions, search states and destructive confirmation system copy render in English
- **AND** FramePanel, LayerPanel and import/export content remain with their existing feature owners

#### Scenario: Language changes while ProjectDrawer is open

- **WHEN** the existing language owner changes between Chinese and English
- **THEN** safe ProjectDrawer/F-02 visible and accessible labels update without remounting workspace data

#### Scenario: User-owned workspace data is rendered

- **WHEN** a board name, folder name, filename, raw validation value or identifier is displayed or passed to an operation
- **THEN** that value remains byte-for-byte unchanged by localization
- **AND** analytics and persistence payloads keep their existing values and schemas

### Requirement: Project drawer width adjustment has a keyboard equivalent

The system SHALL provide an opt-in bounded keyboard equivalent for the ProjectDrawer's existing pointer and touch resize behavior.

#### Scenario: Assistive technology reads the resize control

- **WHEN** the ProjectDrawer resize handle is available
- **THEN** it exposes a localized name, vertical separator semantics and current/minimum/maximum width values

#### Scenario: User adjusts width by keyboard

- **WHEN** focus is on the ProjectDrawer resize control and the user presses ArrowLeft or ArrowRight
- **THEN** the numeric width decreases or increases by the documented fixed step within the existing minimum and maximum
- **AND** the existing width callback and storage owner receive the new width exactly once

#### Scenario: User resizes with pointer or touch

- **WHEN** the user uses the current pointer or touch drag path
- **THEN** its width calculation, clamp, dock-edge handling and persistence semantics remain unchanged
