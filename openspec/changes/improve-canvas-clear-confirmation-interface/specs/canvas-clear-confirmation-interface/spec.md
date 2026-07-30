## ADDED Requirements

### Requirement: Clear-board confirmation shall return focus to the invoking workflow

The system SHALL preserve a non-persisted invocation owner for the existing clear-board confirmation and SHALL return focus to a connected workflow control or documented same-root fallback after the confirmation closes.

#### Scenario: Application-menu user cancels

- **WHEN** the user opens Clear Board from the application menu and cancels with Escape or the Cancel action
- **THEN** the confirmation SHALL close without changing the board
- **AND** focus SHALL return to the stable application-menu owner in the same Drawnix root
- **AND** SHALL NOT remain on the document body or reopen the menu

#### Scenario: Hotkey user cancels

- **WHEN** the user opens Clear Board with the existing hotkey from a connected workflow control and cancels
- **THEN** focus SHALL return to that control when it remains connected
- **AND** otherwise SHALL use the documented same-root board/toolbar fallback

#### Scenario: Command-palette user cancels

- **WHEN** the command palette hands off to the clear-board confirmation and the user cancels
- **THEN** initial focus SHALL belong to the confirmation's Cancel action
- **AND** final focus SHALL return to the workflow owner captured before the palette
- **AND** a later palette restoration SHALL NOT steal confirmation or returned focus

#### Scenario: Captured owner disconnects

- **WHEN** the captured invocation owner is disconnected before the confirmation closes
- **THEN** the system SHALL focus a connected stable control in the same Drawnix root
- **AND** SHALL NOT focus a hidden, disabled, cross-root or detached element

### Requirement: Clear-board confirmation actions shall be touch operable in compact viewports

The system SHALL keep the existing clear-board confirmation fully inside the viewport and SHALL provide compact/pointer-coarse Cancel and Confirm activation boxes of at least 44×44 CSS pixels.

#### Scenario: Portrait compact viewport

- **WHEN** the clear-board confirmation is open at 320×568, 375×667 or 390×844 under compact or pointer-coarse conditions
- **THEN** the complete named dialog and both actions SHALL remain visible inside the viewport
- **AND** each action activation box SHALL be at least 44×44 CSS pixels
- **AND** background canvas scrolling SHALL remain locked

#### Scenario: Short landscape viewport

- **WHEN** the confirmation is open at a supported short landscape viewport such as 640×360
- **THEN** the complete dialog and actions SHALL remain inside the viewport
- **AND** both actions SHALL retain the compact touch-target size without horizontal overflow

#### Scenario: Desktop viewport

- **WHEN** the confirmation is open at the existing desktop breakpoint
- **THEN** current dialog width, action density, copy, theme tokens and z-index SHALL remain

### Requirement: Interface correction shall preserve the explicit destructive decision

The system SHALL retain the current clear-board confirmation and mutation contracts while correcting focus and compact geometry.

#### Scenario: Confirmation opens

- **WHEN** any existing entry opens the confirmation
- **THEN** one localized named dialog SHALL describe the clear-board consequence
- **AND** initial focus SHALL remain on Cancel
- **AND** no board, history or storage mutation SHALL occur

#### Scenario: User cancels

- **WHEN** the user cancels with Escape, outside dismissal or the Cancel action
- **THEN** the board, selection, history and durable workspace projection SHALL remain unchanged
- **AND** no clear action SHALL be reported as complete

#### Scenario: User confirms

- **WHEN** the user activates Confirm once
- **THEN** the existing current-board delete operation SHALL execute exactly once
- **AND** current Plait history, after-change and workspace autosave behavior SHALL remain
- **AND** the dialog SHALL close once and apply the approved focus return

