## ADDED Requirements

### Requirement: Settings window exposes a named non-modal focus contract

The system SHALL expose the existing shared Settings WinBox as a localized named non-modal dialog with keyboard-operable visible title-bar controls and a guarded focus lifecycle, without changing close, save, discovery, geometry, or pointer semantics.

#### Scenario: Open Settings from an existing user entry

- **GIVEN** the user activates an existing Settings entry and no nested Settings content has intentionally placed focus
- **WHEN** the shared Settings window opens
- **THEN** its root SHALL expose a dialog role and a localized name derived from its visible title
- **AND** focus SHALL enter a stable Settings target without trapping focus or making the rest of the application inert
- **AND** the invoking control identity SHALL be retained when it can be safely resolved

#### Scenario: Open Settings from an existing gated or programmatic path

- **GIVEN** an existing model, Chat, toolbox, video-analysis, or API-authentication path opens Settings to resolve configuration
- **WHEN** no connected explicit invoker can be retained
- **THEN** the same named non-modal surface and stable focus fallback SHALL be available
- **AND** the system SHALL NOT force focus to an unrelated control or add a provider, discovery, task, network, storage, or analytics side effect

#### Scenario: Operate a visible Settings title-bar control

- **GIVEN** the Settings title bar visibly exposes split, maximize or restore, or close
- **WHEN** keyboard focus reaches that control and the user presses Enter or Space
- **THEN** the control SHALL expose localized button semantics and its current action or state where applicable
- **AND** the same existing pointer callback SHALL run exactly once
- **AND** hidden minimize or full-screen controls SHALL remain outside the focus order and accessibility tree

#### Scenario: Dismiss Settings with Escape

- **GIVEN** focus is inside the active Settings window
- **AND** no nested dialog, popover, combobox, viewer, editor, or other child surface has handled Escape
- **WHEN** the user presses Escape
- **THEN** the system SHALL invoke the existing guarded Settings close path exactly once
- **AND** an open discovery dialog, active persistence, pending-draft save, or save failure SHALL retain its existing ability to block or delay actual close

#### Scenario: Restore focus only after actual close

- **GIVEN** Settings was opened from an existing user or gated path
- **WHEN** the Settings window actually closes after all existing guards and pending-save behavior complete
- **THEN** focus SHALL return to a still-connected invoker or an explicitly related persistent launcher when available
- **AND** a blocked or failed close SHALL NOT perform close-focus restoration
- **AND** a disconnected invoker SHALL NOT cause an exception or force focus to an unrelated control

### Requirement: Settings navigation exposes the current view and content relationship

The system SHALL expose the existing four-view Settings navigation and active content relationship without changing view values, ordering, transitions, analytics, or adding tablist arrow behavior.

#### Scenario: Inspect the current Settings view

- **GIVEN** the shared Settings surface is open on providers, presets, canvas, or speech
- **WHEN** assistive technology reaches the shared navigation
- **THEN** the navigation SHALL expose a localized programmatic name
- **AND** exactly one existing navigation button SHALL expose current state
- **AND** every navigation button SHALL identify the one stable active-content panel it controls
- **AND** that panel SHALL be a localized named region associated with the current button

#### Scenario: Change Settings view with pointer or keyboard

- **GIVEN** any of the four existing Settings navigation buttons is available
- **WHEN** the user activates another view with pointer, Enter, or Space
- **THEN** the existing `handleViewChange` transition and analytics event SHALL occur exactly once
- **AND** current state and the active-panel name SHALL move to the selected view
- **AND** provider, preset, canvas, speech, discovery, storage, routing, task, and network semantics SHALL remain unchanged

#### Scenario: Preserve ordinary navigation-button keyboard behavior

- **GIVEN** focus is on an existing Settings navigation button
- **WHEN** the user navigates with Tab or presses a key other than the button's existing activation keys
- **THEN** the system SHALL preserve the native button focus order
- **AND** SHALL NOT introduce tablist arrow selection, duplicate activation, or an unrelated view transition

### Requirement: Shared Settings shell copy follows the selected application language

The system SHALL render only the shared Settings title, navigation, active-panel framing, and visible title-bar action names through the existing Chinese/English provider without changing feature content or data.

#### Scenario: Open the shared shell in Chinese or English

- **GIVEN** the active application language is Chinese or English
- **WHEN** the Settings surface opens on any of its four existing views
- **THEN** the visible title, dialog name, navigation group/view labels, active-panel name, and visible title-bar action names SHALL use the selected language
- **AND** provider, model, preset, canvas, speech, credential, URL, error, and user-authored values SHALL remain owned data rather than translation input

#### Scenario: Change language while Settings is open

- **GIVEN** Settings is open with an active view, current drafts, scroll, focus, or nested state
- **WHEN** the existing application language changes between Chinese and English
- **THEN** the shared shell and accessible names SHALL update in place
- **AND** the active view, drafts, discovery, scroll, focus, callbacks, and pending-save state SHALL remain unchanged

#### Scenario: Preserve private and behavioral data across languages

- **GIVEN** Settings contains arbitrary provider names, model IDs, URLs, API keys, prompts, raw errors, or persisted values
- **WHEN** either language renders or operates on the shared shell
- **THEN** those values SHALL remain byte-for-byte unchanged and SHALL NOT enter fixed shell accessible names, translation keys, screenshots, logs, or analytics
- **AND** no additional provider, discovery, benchmark, storage, task, media, canvas, or network side effect SHALL occur
