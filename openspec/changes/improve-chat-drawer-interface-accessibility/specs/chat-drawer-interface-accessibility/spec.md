## ADDED Requirements

### Requirement: Responsive Chat Drawer Entry SHALL Remain Reachable

The system SHALL keep one visible, localized, named control that opens the existing Chat Drawer whenever ordinary Chat is available and the Drawer is closed, including compact full-screen layouts.

#### Scenario: User closes Chat on a compact viewport

- **GIVEN** the existing Chat Drawer is open at a viewport width of 768 CSS pixels or less
- **WHEN** the user closes the Drawer
- **THEN** one visible named Chat-open control SHALL remain reachable
- **AND** activating it by pointer, Enter, or Space SHALL reopen the same Drawer

#### Scenario: Compact toolbar is collapsed or docked

- **GIVEN** the compact toolbar is collapsed, expanded, or docked in any existing supported position
- **WHEN** the Chat Drawer is closed
- **THEN** the Chat-open control SHALL remain visible and unobscured
- **AND** it SHALL NOT introduce a second Chat destination or request path

### Requirement: Chat Drawer Width SHALL Survive Responsive Round Trips

The system SHALL preserve the user's preferred desktop Chat Drawer width while compact mode renders the Drawer full-screen and SHALL restore a valid bounded width when returning to desktop.

#### Scenario: Viewport changes from desktop to compact and back

- **GIVEN** the Drawer has a valid preferred width at a 1280 CSS-pixel viewport
- **WHEN** the viewport changes to 320 CSS pixels and then returns to 1280 CSS pixels
- **THEN** the restored Drawer width SHALL equal the prior preferred width within 1 CSS pixel
- **AND** it SHALL NOT fall below the existing 375 CSS-pixel minimum when the viewport can accommodate that minimum

#### Scenario: Keyboard user resizes the desktop Drawer

- **GIVEN** focus is on the existing resize handle in desktop mode
- **WHEN** the user presses a supported Arrow key
- **THEN** the preferred width SHALL change through the same bounded width owner used by pointer drag
- **AND** the current/minimum/maximum values SHALL be available to assistive technology

#### Scenario: Compact viewport resize does not rewrite preference

- **GIVEN** compact CSS renders the Drawer at full viewport width
- **WHEN** the compact viewport changes size or orientation
- **THEN** the existing preferred desktop width and width-cache key SHALL remain unchanged
- **AND** no new width storage format or migration SHALL be introduced

### Requirement: Chat Drawer SHALL Expose A Named Non-Modal Region And Deterministic Close Focus

The system SHALL expose the existing desktop Chat Drawer as a localized named non-modal region controlled by its disclosure entry and SHALL manage close focus without stealing focus on programmatic workflow opens.

#### Scenario: Assistive technology inspects an open Drawer

- **GIVEN** the Chat Drawer is open
- **WHEN** assistive technology enumerates page regions and controls
- **THEN** the Drawer SHALL have a name derived from application-owned title context
- **AND** its opener SHALL reference the Drawer and expose the same expanded state

#### Scenario: User closes from inside the Drawer

- **GIVEN** keyboard focus is inside the open Drawer
- **WHEN** the user presses Escape or activates the close control outside a nested edit or dialog
- **THEN** the Drawer SHALL close
- **AND** focus SHALL return to the visible control that opened it

#### Scenario: Workflow opens Chat programmatically

- **GIVEN** focus is on another existing canvas control
- **WHEN** a workflow uses the existing programmatic Chat-open path
- **THEN** the Drawer SHALL open without moving focus unexpectedly
- **AND** the same close and region semantics SHALL remain available

### Requirement: Chat Title And Session Operations SHALL Be Native Keyboard Structures

The system SHALL expose title edit, session selection, rename, and delete as named non-nested native controls with one explicit active-session state.

#### Scenario: User edits the current title by keyboard

- **GIVEN** the current session title is visible
- **WHEN** the user activates its named edit control with Enter or Space
- **THEN** focus SHALL move to a labelled edit field containing the existing title
- **AND** Enter SHALL save through the existing rename callback

#### Scenario: User cancels title or session rename

- **GIVEN** focus is in a title or session rename field with an unsaved value
- **WHEN** the user presses Escape
- **THEN** only that edit SHALL be cancelled
- **AND** the Drawer SHALL remain open
- **AND** focus SHALL return to the edit trigger without a storage write

#### Scenario: User selects and manages a session

- **GIVEN** the session list contains an active and an inactive session
- **WHEN** the user navigates and activates selection, edit, or delete controls by keyboard
- **THEN** selection SHALL respond to Enter and Space through one native control
- **AND** edit/delete controls SHALL be siblings rather than descendants of the selection control
- **AND** the active session SHALL be exposed without changing session CRUD or confirmation semantics

### Requirement: Chat Session And Composer Actions SHALL Remain Perceivable And Touch Operable

The system SHALL keep existing Chat session and composer actions visible when focused or used on non-hover surfaces and SHALL provide at least 44 × 44 CSS-pixel hit boxes at compact or pointer-coarse boundaries.

#### Scenario: Keyboard user tabs through a session row

- **GIVEN** the session action group is not pointer-hovered
- **WHEN** keyboard focus enters the session selection, edit, or delete controls
- **THEN** each focused control SHALL be visibly perceivable
- **AND** no control SHALL remain hidden only because hover is absent

#### Scenario: Touch user operates compact Chat controls

- **GIVEN** the Drawer is rendered at 320 or 390 CSS pixels or under a pointer-coarse condition
- **WHEN** the user operates close, reopen, session, upload, library, or send actions
- **THEN** every scoped action SHALL have a hit box of at least 44 × 44 CSS pixels
- **AND** glyph size, action order, callback ownership, and Drawer horizontal overflow SHALL remain unchanged

### Requirement: Ordinary Chat Lifecycle Feedback SHALL Be Bounded And Localized

The system SHALL expose concise localized ordinary Chat loading and terminal-error feedback without making the transcript or streaming provider content a live region.

#### Scenario: Ordinary request starts and streams

- **GIVEN** a normal Chat request enters submitted or streaming state
- **WHEN** the visible loading state appears or rerenders unchanged
- **THEN** assistive technology SHALL receive one concise localized lifecycle status
- **AND** prompt, attachment, model response, provider payload, and every stream chunk SHALL NOT be announced by that status

#### Scenario: Ordinary request reaches an error

- **GIVEN** a normal Chat request reaches the existing terminal error UI
- **WHEN** the error becomes visible
- **THEN** assistive technology SHALL receive one concise safe localized error notification
- **AND** unchanged rerenders SHALL NOT duplicate the notification

#### Scenario: User changes application language

- **GIVEN** the Drawer shows its shell, session list, empty/loading/error state, and composer controls
- **WHEN** the application language changes between Chinese and English
- **THEN** application-owned labels, placeholders, preview language, and time formatting SHALL follow the selected language
- **AND** stored session titles, prompts, messages, workflow/model names, attachment names, provider errors, and results SHALL remain unchanged

