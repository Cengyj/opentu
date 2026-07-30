## ADDED Requirements

### Requirement: Existing backup and cloud-sync surfaces are named focus-managed modals

The system SHALL expose the existing backup/restore and cloud-sync surfaces as localized named modal dialogs with deterministic focus entry, nested-dialog precedence, keyboard dismissal, and safe focus return without changing their data operations.

#### Scenario: Open a data-preservation dialog
- **GIVEN** the user invokes Backup / Restore or Cloud Sync from an existing reachable control
- **WHEN** the lazy dialog becomes interactive
- **THEN** it SHALL expose a localized non-empty dialog name and modal state
- **AND** focus SHALL move to the first stable task control or named dialog root

#### Scenario: Close a data-preservation dialog
- **GIVEN** one of the dialogs is open and no nested confirmation owns focus
- **WHEN** the user activates its close/cancel action or presses Escape
- **THEN** the dialog SHALL close once
- **AND** focus SHALL return to the connected invoker or the stable named application-menu launcher

#### Scenario: Close a nested confirmation
- **GIVEN** a restore, overwrite, disconnect, Gist-delete, permanent-delete, or empty-recycle-bin confirmation is open above its parent dialog
- **WHEN** the user cancels or closes the confirmation
- **THEN** only the nested confirmation SHALL close
- **AND** focus SHALL return to a stable control in the still-open parent dialog

### Requirement: Existing backup and restore controls have equivalent input semantics

The system SHALL expose the existing backup/restore tabs, restore-mode choice, and ZIP file selection with native or equivalent names, state, relationships, and keyboard/pointer activation while preserving current import/export validation and arguments.

#### Scenario: Navigate backup and restore tabs
- **GIVEN** the backup/restore dialog is open and not processing
- **WHEN** the user activates a tab or uses Left, Right, Home, or End on the tab set
- **THEN** exactly one localized tab SHALL be selected and related to its visible panel
- **AND** focus and selection SHALL remain within the two existing tabs

#### Scenario: Select an existing ZIP backup
- **GIVEN** the Restore tab is active and import is not processing
- **WHEN** the user activates the labelled file selector with pointer, Enter, or Space and selects one file
- **THEN** the native chooser SHALL be requested at most once per activation
- **AND** the existing `.zip` acceptance, replace confirmation, input reset, and import options SHALL remain unchanged

#### Scenario: Processing disables conflicting controls
- **GIVEN** backup export or restore import is running
- **WHEN** the user reaches tabs, options, mode, file, close, or submit controls
- **THEN** conflicting controls SHALL expose their disabled/busy state
- **AND** no duplicate export, import, close, or mode transition SHALL run

### Requirement: Backup and synchronization operation states are programmatically available

The system SHALL expose the existing progress, loading, success, partial-success, warning, failure, and busy states through concise programmatic status without changing service timing, retry, refresh, or terminal-result semantics.

#### Scenario: Observe backup or restore progress
- **GIVEN** an export or import is processing
- **WHEN** the existing progress callback updates percentage and message
- **THEN** assistive technology SHALL receive the determinate value and current concise message
- **AND** updates SHALL NOT move focus or duplicate the operation

#### Scenario: Inspect an import result
- **GIVEN** import completes successfully, partially, or with domain errors
- **WHEN** the result projection is rendered
- **THEN** its terminal state, per-domain counts, warnings, and errors SHALL be programmatically distinguishable
- **AND** imported warning/error payloads and counts SHALL remain unchanged

#### Scenario: Observe cloud synchronization state
- **GIVEN** Token validation, pull, push, Gist loading, recycle-bin loading, or a destructive action is running or fails
- **WHEN** the existing state owner updates the UI
- **THEN** the relevant busy/status/error state SHALL be exposed concisely
- **AND** no credential, full Gist identifier, board payload, or provider response body SHALL be announced as a label

### Requirement: Existing cloud-sync controls are named and operable without pointer-only containers

The system SHALL provide localized programmatic names and native keyboard behavior for the existing cloud-sync fields, switches, disclosures, close control, and icon actions without adding or changing cloud operations.

#### Scenario: Reach cloud-sync form controls
- **GIVEN** the cloud-sync dialog is disconnected or connected
- **WHEN** assistive technology reaches Token, custom password, auto-sync, show/hide, close, refresh, or delete controls
- **THEN** every existing control SHALL expose a non-empty localized name matching its visible purpose
- **AND** its value, checked, disabled, busy, or pressed state SHALL remain accurate

#### Scenario: Toggle Gist manager or recycle bin
- **GIVEN** the connected cloud-sync dialog shows an existing collapsed or expanded disclosure
- **WHEN** the user activates it with pointer, Enter, or Space
- **THEN** the same section SHALL toggle exactly once and expose its expanded relationship
- **AND** its existing loading, empty, current, and item projections SHALL remain controlled by the current service data

#### Scenario: Use an existing list action
- **GIVEN** a Gist or recycle-bin item exposes an existing action
- **WHEN** the user activates its named button
- **THEN** the existing confirmation and service callback SHALL execute at most once
- **AND** current item identity, destructive warning, and disabled/loading behavior SHALL remain unchanged

### Requirement: Existing synchronization passwords are masked until explicitly revealed

The system SHALL mask newly entered and stored custom synchronization passwords by default and SHALL reveal a stored password only through the existing explicit show action without changing password storage or encryption behavior.

#### Scenario: Enter or replace a synchronization password
- **GIVEN** the connected user focuses the custom synchronization password field
- **WHEN** the user types a new password
- **THEN** its characters SHALL be visually masked by default
- **AND** save, replace, clear, and auto-sync behavior SHALL receive the same byte sequence as before

#### Scenario: Explicitly reveal and hide a stored password
- **GIVEN** a stored custom password exists and is initially masked
- **WHEN** the user activates the named show or hide action
- **THEN** the visible state SHALL match the control's programmatic pressed/expanded state
- **AND** the plaintext SHALL NOT be interpolated into a placeholder, accessible name, status message, toast, or log

#### Scenario: Roll back presentation changes
- **GIVEN** the interface change is removed while the current storage services remain
- **WHEN** the user reopens cloud-sync settings
- **THEN** no Token, custom-password, config, Gist, backup, or board record SHALL require migration or cleanup

### Requirement: Existing backup and cloud-sync application copy follows the selected language

The system SHALL render application-authored copy in the existing backup/restore, cloud-sync, Token-guide, and recycle-bin flows using the current Chinese/English provider without translating data or changing operations.

#### Scenario: Open in Chinese or English
- **GIVEN** the current application language is Chinese or English
- **WHEN** the user opens either data-preservation dialog and its nested states
- **THEN** titles, controls, instructions, validation, progress, results, confirmations, and application-authored errors SHALL use that language
- **AND** accessible names SHALL remain stable and localized

#### Scenario: Change language while a dialog is open
- **GIVEN** a data-preservation dialog is open
- **WHEN** the existing language provider changes between Chinese and English
- **THEN** mounted application-authored copy and names SHALL update without resetting form, tab, processing, result, or disclosure state

#### Scenario: Preserve non-application data
- **GIVEN** a board/file/user name, Gist ID, provider value, imported warning/error, or credential contains arbitrary text
- **WHEN** either dialog renders, confirms, logs, imports, exports, pulls, pushes, deletes, or restores that value
- **THEN** the value SHALL remain byte-for-byte unchanged
- **AND** credentials SHALL NOT be added to translated output, accessible labels, analytics, or logs
