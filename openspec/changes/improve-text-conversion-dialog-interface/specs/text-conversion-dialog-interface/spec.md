## ADDED Requirements

### Requirement: Text conversion dialogs shall expose localized modal semantics

The system SHALL expose each Mermaid and Markdown conversion surface as one localized named modal dialog with a visible heading, associated description and programmatically labeled syntax input.

#### Scenario: Mermaid dialog opens

- **WHEN** the user opens Mermaid conversion from a reachable entry
- **THEN** one modal dialog SHALL expose the localized visible Mermaid heading as its accessible name
- **AND** the syntax textarea SHALL be programmatically named by its visible Mermaid syntax label
- **AND** initial focus SHALL move to that textarea

#### Scenario: Markdown dialog opens

- **WHEN** the user opens Markdown conversion from a reachable entry
- **THEN** one modal dialog SHALL expose the localized visible Markdown heading as its accessible name
- **AND** the syntax textarea SHALL be programmatically named by its visible Markdown syntax label
- **AND** initial focus SHALL move to that textarea

#### Scenario: Locale changes while dialog is open

- **WHEN** the application locale changes between Chinese and English while a conversion dialog remains open
- **THEN** its heading, accessible name, description, syntax label, preview label, action and status text SHALL update consistently
- **AND** the accessible relationships SHALL remain valid

### Requirement: Text conversion dialog focus shall remain deterministic

The system SHALL contain keyboard focus within the open modal, dismiss it through the existing Escape behavior, and return focus after a user close to a stable control associated with the invocation path.

#### Scenario: Persistent toolbar opener remains connected

- **WHEN** the user opens a conversion dialog from a persistent toolbar control and closes it
- **THEN** focus SHALL return to that connected control

#### Scenario: Ephemeral popup or command row unmounts

- **WHEN** the user opens a conversion dialog from an entry that unmounts while the dialog is open and then closes it
- **THEN** focus SHALL return to the defined connected owner control for that entry family
- **AND** SHALL NOT remain on the document body or reopen the ephemeral surface

#### Scenario: User navigates within the open dialog

- **WHEN** the user presses Tab or Shift+Tab while the conversion dialog is open
- **THEN** focus SHALL remain within enabled controls of that modal
- **AND** background canvas controls SHALL remain unavailable to the modal tab sequence

### Requirement: Text conversion errors and action availability shall be perceivable

The system SHALL expose the current concise conversion error through one dedicated live error node and SHALL present Insert availability consistently with the current-result eligibility contract.

#### Scenario: Current conversion fails

- **WHEN** the current input conversion changes from pending to failure
- **THEN** one dedicated localized/current error node SHALL be announced
- **AND** the full preview and user input SHALL NOT be live-announced
- **AND** Insert SHALL be exposed as unavailable

#### Scenario: User corrects the input

- **WHEN** a later current input converts successfully after an error
- **THEN** the current error SHALL clear
- **AND** the successful current preview and Insert availability SHALL be presented without duplicate stale-error announcement

### Requirement: Text conversion actions shall remain reachable on compact viewports

The system SHALL keep conversion content and the complete Insert action reachable inside the modal at supported compact viewports while preserving background scroll lock.

#### Scenario: Portrait compact viewport

- **WHEN** a conversion dialog is displayed at 320×568, 375×667 or 390×844 in initial, success or error state
- **THEN** the user SHALL be able to reach and view the complete Insert action by scrolling within the modal when required
- **AND** background canvas/body scrolling SHALL remain locked

#### Scenario: Landscape compact viewport

- **WHEN** a conversion dialog is displayed at a supported short landscape viewport such as 640×360
- **THEN** the syntax input, preview/status and complete Insert action SHALL remain reachable inside the modal
- **AND** content SHALL NOT rely on overflow beyond a locked body

#### Scenario: Desktop viewport

- **WHEN** the dialog is displayed at the existing desktop breakpoint
- **THEN** the current two-column input/preview composition, theme tokens and z-index layer SHALL remain
- **AND** no board, parser, storage or insertion data contract SHALL change solely for responsive layout

