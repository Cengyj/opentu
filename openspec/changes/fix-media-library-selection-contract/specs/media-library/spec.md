## ADDED Requirements

### Requirement: Media-library picker constraints shall be invocation-local and enforced

The system SHALL apply a media-library picker's type and category constraints only to that open invocation, SHALL prevent assets outside those constraints from being displayed or selected, and SHALL leave the user's general-library browse filters unchanged.

#### Scenario: Open and close a constrained picker

- **GIVEN** the user has an existing set of general media-library browse filters
- **WHEN** an entry opens a picker constrained to a media type or category
- **THEN** the picker SHALL display and allow selection only within that constraint
- **AND** user-controlled search, source, sort, and playlist filters SHALL continue to operate within the constraint
- **WHEN** the constrained picker closes and the user opens the general media library
- **THEN** the pre-existing general browse filters SHALL still be active
- **AND** the picker constraint SHALL NOT leak into the general entry

#### Scenario: A picker invocation changes its constraint

- **GIVEN** a selected or batch-selected asset does not satisfy the next invocation constraint
- **WHEN** the media-library picker is opened or updated with that constraint
- **THEN** the out-of-constraint asset SHALL NOT remain selectable or confirmable
- **AND** the user's shared general-library filters SHALL remain unchanged

### Requirement: Single and batch selection actions shall use their corresponding labels

The system SHALL render the configured single-selection label on the single action and the configured batch-selection label on the batch action, using the existing default for any omitted label.

#### Scenario: A caller supplies distinct action labels

- **GIVEN** a media-library caller provides different single and batch selection labels
- **WHEN** the user selects one asset or enters batch-selection mode
- **THEN** the single action SHALL show the single-selection label
- **AND** the batch action SHALL show the batch-selection label with the selected count where applicable
- **AND** neither label SHALL replace the other action's text

### Requirement: Selection completion shall reflect callback success

The system SHALL close a media-library selection invocation only after its single or batch callback completes successfully, and SHALL retain retryable selection state when that callback fails.

#### Scenario: A single or batch selection succeeds

- **GIVEN** the user has selected one or more permitted assets
- **WHEN** the selection callback fulfills
- **THEN** the modal SHALL close exactly once
- **AND** duplicate activation while the callback was pending SHALL NOT invoke it again

#### Scenario: A single or batch selection fails

- **GIVEN** the user has selected one or more permitted assets
- **WHEN** the selection callback rejects or its insertion operation reports failure
- **THEN** the existing safe failure message SHALL remain visible
- **AND** the modal SHALL remain open with the selected asset(s) and effective filters intact
- **AND** the pending indicator SHALL clear so the user can retry or cancel
- **AND** the failure SHALL NOT produce an unhandled promise rejection or automatic duplicate insertion
