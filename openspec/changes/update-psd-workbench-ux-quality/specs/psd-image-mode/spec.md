## MODIFIED Requirements

### Requirement: PSD Layer Planning Surface

The system SHALL provide a PSD-oriented generation surface that reuses existing AI image controls, analyzes uploaded imagery into a dynamic layer plan, and lets the user review that plan before layer image tasks are created.

#### Scenario: PSD surface analyzes before layer generation

- **GIVEN** PSD mode has a source image and prompt
- **WHEN** the user starts PSD generation
- **THEN** the system SHALL create a `TaskType.CHAT` layer analysis task
- **AND** the system SHALL NOT create layer image tasks until the analysis result has been reviewed and the user explicitly starts layer asset generation

#### Scenario: User chooses a source image from supported inputs

- **GIVEN** PSD mode is open in the existing AI image generation window
- **WHEN** the user uploads, drags, pastes, or selects an image from the media library
- **THEN** the PSD workbench SHALL use that image as the single source image for `TaskType.CHAT` layer analysis
- **AND** selecting from the media library SHALL NOT create `AssetType.PSD` or a separate PSD asset

#### Scenario: User edits the analyzed layer plan

- **GIVEN** a PSD layer analysis result has created a local layer plan
- **WHEN** the user renames a layer, edits a layer prompt, or excludes a layer
- **THEN** the layer plan used for subsequent image tasks SHALL reflect those edits
- **AND** the PSD mode SHALL remain inside the existing AI image generation window

### Requirement: Stable First-Version PSD Task Surface

The system SHALL keep PSD layer asset generation compatible with the existing image generation task and asset model while exposing per-layer status and retry controls.

#### Scenario: Layer tasks use existing image task metadata

- **GIVEN** a reviewed PSD layer plan
- **WHEN** the user starts layer asset generation
- **THEN** the system SHALL create `TaskType.IMAGE` tasks for included raster layers
- **AND** each task SHALL include `psdPlan.layerId` metadata
- **AND** the system SHALL NOT introduce `TaskType.PSD` or `AssetType.PSD`

#### Scenario: Failed layers are retryable

- **GIVEN** one or more PSD layer image tasks fail
- **WHEN** the PSD workbench renders the layer panel
- **THEN** each failed layer SHALL show its failed state
- **AND** the user SHALL be able to retry a single failed layer or all failed layers without regenerating successful layers

### Requirement: PSD-Ready Workspace Export

The system SHALL export completed PSD layer assets as a PSD-ready workspace package without implying native PSD output from upstream image APIs.

#### Scenario: User downloads a partial workspace package

- **GIVEN** at least one PSD layer image task has completed with an image result
- **AND** at least one PSD layer image task failed or was cancelled
- **WHEN** the user downloads the PSD-ready workspace package
- **THEN** the package SHALL include the successful layer assets
- **AND** the manifest SHALL record failed or cancelled layers
- **AND** the UI SHALL label the result as a `.zip` workspace package, not a native `.psd` file
