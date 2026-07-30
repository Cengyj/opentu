## ADDED Requirements

### Requirement: Toolbox tool windows shall expose keyboard-operable dialog controls

The system SHALL expose each toolbox tool window as a named non-modal dialog and SHALL provide keyboard behavior equivalent to the existing pointer behavior for its visible title-bar controls, window focus lifecycle, and launcher context actions.

#### Scenario: A tool window opens or restores

- **WHEN** the user opens or restores an internal or iframe toolbox tool window
- **THEN** the window SHALL expose a dialog role and an accessible name derived from its visible localized title
- **AND** focus SHALL enter the window unless mounted tool content has already placed focus intentionally
- **AND** the tool content SHALL remain mounted with its existing runtime state

#### Scenario: The user operates a title-bar control by keyboard

- **GIVEN** a visible tool-window title-bar control performs insert, split, minimize, maximize or restore, or close
- **WHEN** keyboard focus reaches that control
- **THEN** it SHALL expose localized button semantics and an accessible name for its action
- **AND** Enter or Space SHALL invoke the same action as a pointer click exactly once

#### Scenario: The user dismisses the active tool window

- **GIVEN** focus is inside the active toolbox tool window
- **AND** no nested dialog, popover, viewer, editor, or other child surface handles Escape
- **WHEN** the user presses Escape
- **THEN** the system SHALL close that tool-window instance
- **AND** SHALL restore focus to the connected invoker or its named launcher when available

#### Scenario: A tool window minimizes or closes through another control

- **WHEN** the user minimizes or closes a tool window through its title-bar control or launcher action
- **THEN** focus SHALL return to a connected invoking control or named launcher when available
- **AND** a disconnected invoker SHALL NOT cause an exception or force focus to an unrelated control

#### Scenario: A keyboard user opens launcher context actions

- **GIVEN** a named pinned, minimized, or open tool launcher has context actions
- **WHEN** the launcher has focus and the user presses Shift+F10 or the Context Menu key
- **THEN** the same action set available by right click SHALL open as a named keyboard-operable menu
- **AND** focus SHALL move to the first enabled menu item
- **AND** Arrow Up, Arrow Down, Home, End, Enter, Space, and Escape SHALL follow standard menu behavior
- **AND** closing the menu SHALL restore focus to the launcher

#### Scenario: Existing pointer and product semantics are preserved

- **WHEN** a pointer user opens a window, activates a title-bar control, or invokes a launcher context action
- **THEN** the existing action availability and result SHALL remain unchanged
- **AND** multi-instance identity, z-index ordering, tool state, persistence, iframe permissions, canvas insertion, and analytics payload semantics SHALL remain unchanged
