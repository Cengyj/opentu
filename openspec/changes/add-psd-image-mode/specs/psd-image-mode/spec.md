## ADDED Requirements

### Requirement: PSD Image Mode

The system SHALL expose PSD as a sub-mode of the existing AI image generation window.

#### Scenario: User switches to PSD mode

- **GIVEN** the AI image generation window is open
- **WHEN** the user selects the PSD mode tab
- **THEN** the same window SHALL switch to PSD mode
- **AND** the system SHALL NOT open a separate top-level PSD dialog

#### Scenario: PSD mode is restored safely

- **GIVEN** the saved AI image generation mode is `psd`
- **WHEN** the AI image generation window opens again
- **THEN** the window SHALL restore PSD mode when supported
- **AND** unknown saved mode values SHALL fall back to single-image mode

### Requirement: PSD Layer Planning Surface

The system SHALL provide a PSD-oriented generation surface that reuses existing AI image controls and displays a layer plan preview.

#### Scenario: PSD surface reuses image controls

- **WHEN** PSD mode renders
- **THEN** it SHALL use the existing image model selector, parameter controls, reference image upload, prompt input, knowledge-note context selector, error display, and action button styling where applicable
- **AND** it SHALL remain visually consistent with single-image and batch-image generation

#### Scenario: PSD layer plan preview is visible

- **WHEN** the user edits the PSD prompt or layer plan inputs
- **THEN** the PSD surface SHALL show a right-side layer plan or preview panel
- **AND** the preview SHALL describe planned layers without requiring a native PSD file to already exist

### Requirement: Stable First-Version PSD Task Surface

The system SHALL keep first-version PSD planning compatible with the existing image generation task and asset model.

#### Scenario: PSD mode does not add global PSD task or asset types

- **WHEN** PSD mode is added
- **THEN** the implementation SHALL NOT introduce `TaskType.PSD`
- **AND** it SHALL NOT introduce `AssetType.PSD`
- **AND** any first-version generation work SHALL remain compatible with the existing image generation flow

#### Scenario: Upstream APIs are not represented as native PSD producers

- **WHEN** PSD mode presents generation or planning output
- **THEN** it SHALL NOT imply that OpenAI-compatible image APIs directly return native layered PSD files
- **AND** final PSD binary export SHALL remain outside this first-version scope unless a later approved change adds it
