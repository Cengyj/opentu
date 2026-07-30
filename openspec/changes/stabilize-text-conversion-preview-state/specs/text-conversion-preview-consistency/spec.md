## ADDED Requirements

### Requirement: Text conversion preview shall belong to the current input

The system SHALL associate converter loading, parsing, success, failure and preview state with the current normalized dialog input and SHALL NOT let an obsolete request replace that state.

#### Scenario: Older parse finishes after a newer parse

- **WHEN** an older conversion request settles after the input has started and completed a newer request
- **THEN** the system SHALL keep the newer request's preview and error state
- **AND** SHALL ignore the obsolete completion for insertion eligibility

#### Scenario: Older failure finishes after a newer success

- **WHEN** an obsolete request fails after the current input has converted successfully
- **THEN** the system SHALL keep the current successful preview
- **AND** SHALL NOT display the obsolete error as the current error

#### Scenario: Dialog closes while conversion is pending

- **WHEN** a conversion settles after its dialog closes or unmounts
- **THEN** the completion SHALL create no visible state update, board mutation or dialog transition

#### Scenario: Parser fallback is used

- **WHEN** the existing first parse attempt fails and the existing quote-replacement fallback is attempted
- **THEN** both attempts SHALL remain part of the same current-input request identity
- **AND** an obsolete fallback completion SHALL NOT replace current state

### Requirement: Text conversion insertion shall require the current successful result

The system SHALL enable and execute button or Ctrl/Cmd+Enter insertion only when a non-empty successful result belongs to the current normalized input.

#### Scenario: Current input is loading or pending

- **WHEN** the converter is loading or the current input conversion is pending
- **THEN** the Insert action SHALL be unavailable
- **AND** button or keyboard activation SHALL create no board operation and SHALL NOT close the dialog

#### Scenario: Current input failed after a previous success

- **WHEN** a previous input has a retained preview but the current input conversion failed
- **THEN** the retained preview SHALL NOT be eligible for insertion
- **AND** button or keyboard activation SHALL create no board operation and SHALL NOT close the dialog

#### Scenario: Current input produced an empty result

- **WHEN** the current conversion succeeds without insertable elements
- **THEN** the Insert action SHALL remain unavailable
- **AND** the empty result SHALL NOT close the dialog

#### Scenario: Current input produced a valid result

- **WHEN** the current normalized input owns a successful non-empty result and the user activates Insert
- **THEN** the system SHALL insert exactly that result once through the existing Plait paste operation
- **AND** SHALL close the corresponding conversion dialog after successful insertion

### Requirement: Successful text conversion shall preserve board contracts

The system SHALL retain the existing successful insertion placement, cloning, history, viewport and persistence behavior without changing serialized data contracts.

#### Scenario: Smart insertion point exists

- **WHEN** the current board selection provides the existing smart insertion point
- **THEN** the current conversion result SHALL be deep-cloned and inserted at that point
- **AND** SHALL use the existing paste/history operation

#### Scenario: Default insertion point is used

- **WHEN** no smart insertion point exists
- **THEN** Mermaid and Markdown results SHALL retain their existing type-specific default placement calculations
- **AND** the viewport reveal SHALL retain its current behavior

#### Scenario: Data contracts remain compatible

- **WHEN** the consistency correction is applied or rolled back
- **THEN** board elements, `.drawnix` files, workspace records, caches, backups and migrations SHALL retain their existing formats
- **AND** no new persisted draft, task record, network endpoint or analytics schema SHALL be required

