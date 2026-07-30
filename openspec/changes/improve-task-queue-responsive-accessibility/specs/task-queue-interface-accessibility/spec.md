## ADDED Requirements

### Requirement: Task Queue Surface Shall Expose A Deterministic Non-Modal Focus Contract

The system SHALL expose the existing task-queue trigger and opened task surface with stable localized names, disclosure relationships, and deterministic focus behavior while keeping the queue non-modal.

#### Scenario: User opens and closes the task queue by keyboard or pointer

- **WHEN** the user opens the task queue from the existing toolbar trigger
- **THEN** the trigger SHALL expose its expanded state and the controlled task surface
- **AND** the opened surface SHALL expose a localized task-queue name
- **AND** focus SHALL move to the task surface heading before sequential navigation enters its controls
- **WHEN** the user closes the queue through its close action or Escape
- **THEN** focus SHALL return to the exact invoker when it remains available
- **AND** task data, toolbar action, analytics identity, and pointer behavior SHALL remain unchanged

#### Scenario: A nested task surface owns Escape

- **GIVEN** the task queue has opened an existing preview, editor, character dialog, or confirmation dialog
- **WHEN** the user presses Escape
- **THEN** the nested surface SHALL handle that key before the outer task queue
- **AND** one Escape keypress SHALL NOT close both interaction layers

### Requirement: Task Queue Filters And Selection Shall Be Keyboard And Assistive-Technology Operable

The system SHALL expose the existing status filters, type filters, search, and selection controls with semantic names and state without changing which tasks they select or display.

#### Scenario: User changes the task status tab without a pointer

- **WHEN** keyboard focus reaches the task status selector
- **THEN** one status SHALL be exposed as selected
- **AND** Left, Right, Home, and End SHALL move among the existing statuses using the tabs pattern
- **AND** activating a status SHALL render the same filtered task list as the current pointer action

#### Scenario: User changes the task type filter

- **WHEN** keyboard or assistive-technology focus reaches All, Image, Video, Audio, Text, or Character
- **THEN** each action SHALL expose a localized name with its visible count
- **AND** the active type SHALL expose its pressed state independently of color

#### Scenario: User enters multi-selection

- **WHEN** the existing multi-select mode is visible
- **THEN** select-all and each row checkbox SHALL have a programmatic label associated with its visible selection/task context
- **AND** batch cancel, retry, sync, and delete SHALL retain their existing availability, confirmation, and callback semantics

### Requirement: Task Items Shall Expose Existing Actions And Lifecycle Feedback

The system SHALL make each existing task action, actionable preview, error-detail affordance, and processing state perceivable and keyboard-operable without adding a new task capability.

#### Scenario: User reaches completed, failed, or cancelled task actions

- **WHEN** an existing download, copy, edit, regenerate, character, delete, insert, or retry action is rendered
- **THEN** the action SHALL expose a stable localized operation name
- **AND** one pointer or keyboard activation SHALL invoke its existing callback exactly once
- **AND** the name SHALL NOT include a media URL, provider credential, raw error body, task ID, or hidden request payload

#### Scenario: User opens a media preview or detailed error

- **WHEN** the task already supports opening a preview or detailed error
- **THEN** that affordance SHALL be reachable and activatable by keyboard with a localized name
- **AND** non-actionable placeholders SHALL remain non-interactive
- **AND** this change SHALL NOT alter media loading, cached status, or error sanitization content

#### Scenario: A task is processing or reaches a terminal state

- **WHEN** a determinate task progress value is rendered
- **THEN** assistive technology SHALL be able to query one labelled progress value for that task
- **WHEN** the task reaches completed, failed, cancelled, or a retry transition
- **THEN** the concise lifecycle change SHALL be announced politely and atomically
- **AND** visual animation frames and every percentage poll SHALL NOT each create a live announcement

### Requirement: Compact Task Queue Controls Shall Remain In-Viewport And Touch Operable

The system SHALL keep every existing task-queue control visible and operable within current compact drawer widths without reducing desktop/tablet density or hiding actions.

#### Scenario: User opens the queue at 320 CSS pixels

- **WHEN** the task queue is open at a 320 CSS px portrait viewport with status tabs, type filters, search, and multi-select visible
- **THEN** no existing action SHALL extend outside or be clipped by the drawer
- **AND** hidden status choices SHALL have a keyboard-operable route
- **AND** compact interactive controls SHALL provide at least 44×44 CSS px touch target boxes
- **AND** list content SHALL remain vertically scrollable

#### Scenario: User opens the queue at wider viewports

- **WHEN** the queue is rendered at 390 CSS px, tablet, or desktop widths
- **THEN** the compact fix SHALL preserve existing action order, filter results, drawer width/pin behavior, toolbar docking, theme tokens, and desktop/tablet density

### Requirement: Task Queue Interface Shall Follow The Selected Application Language

The system SHALL render task-queue-owned interface copy and accessible names in the selected existing Chinese or English application language without translating user or provider data.

#### Scenario: User opens the queue in Chinese or English

- **GIVEN** the selected application language is Chinese or English
- **WHEN** the queue renders its title, filters, status, actions, empty/loading/error/confirmation text, archive pagination, tooltips, and accessible names
- **THEN** all application-owned copy SHALL use the selected language
- **AND** long English copy SHALL remain within the verified compact layout

#### Scenario: Existing task data is rendered under another language

- **WHEN** the application language changes while tasks already exist
- **THEN** user prompts/titles, provider/model values, URLs, IDs, error payloads, task/result records, cache keys, and persisted data SHALL remain byte-for-byte unchanged
- **AND** no localization key SHALL be written into task, result, cache, board, workflow, or analytics data
