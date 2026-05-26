## ADDED Requirements

### Requirement: PSD Draft Editing

The system SHALL allow PSD mode users to create and edit a PSD draft before generating layer assets.

#### Scenario: User creates a PSD draft

- **GIVEN** the AI image generation window is open in PSD mode
- **WHEN** the user enters a design prompt and selects “Generate PSD structure”
- **THEN** the system SHALL create a PSD draft with canvas metadata, layer groups, and layer nodes
- **AND** the draft SHALL be displayed in an editable layer tree

#### Scenario: User edits draft layers

- **GIVEN** a PSD draft exists
- **WHEN** the user renames, hides, reorders, deletes, or edits a layer prompt
- **THEN** the draft SHALL update without creating a new top-level dialog
- **AND** the preview SHALL reflect visible layer order when possible

### Requirement: PSD Layer Asset Generation

The system SHALL generate raster assets for PSD layers by reusing the existing image generation task flow.

#### Scenario: Raster layers create image tasks

- **GIVEN** a PSD draft contains raster layers that need generated assets
- **WHEN** the user selects “Generate layer assets”
- **THEN** the system SHALL create image generation tasks for those raster layers using `TaskType.IMAGE`
- **AND** the system SHALL NOT introduce `TaskType.PSD`

#### Scenario: Layer task state is reflected in the PSD layer tree

- **GIVEN** raster layer image tasks are queued or running
- **WHEN** a task completes or fails
- **THEN** the corresponding PSD layer SHALL show ready or failed state
- **AND** failed layers SHALL be individually retryable

### Requirement: PSD Export

The system SHALL export ready PSD drafts as Photoshop-compatible `.psd` files without claiming upstream image APIs natively produce PSD.

#### Scenario: User exports a ready PSD draft

- **GIVEN** a PSD draft has required ready layers
- **WHEN** the user selects “Export PSD”
- **THEN** the system SHALL package the draft layers into a `.psd` download
- **AND** the exported PSD SHALL preserve layer names, order, visibility, and baseline raster content

#### Scenario: Text layer fallback is explicit

- **GIVEN** the PSD exporter cannot reliably write editable text layers
- **WHEN** the user exports a draft with text layers
- **THEN** the system MAY export rasterized text layers with metadata
- **AND** the UI SHALL clearly indicate that text editability is limited in that export

### Requirement: API Capability Disclosure

The system SHALL disclose that OpenAI-compatible image APIs generate or edit raster images and do not directly return native layered PSD files.

#### Scenario: User views PSD mode

- **WHEN** PSD mode is rendered
- **THEN** the UI SHALL state that AI image APIs generate layer assets or previews while Opentu packages the PSD
- **AND** the UI SHALL NOT state or imply that GPT Image directly returns native PSD files

### Requirement: PSD Workflow Compatibility

The system SHALL keep first-version PSD export compatible with existing image, task, and asset systems.

#### Scenario: PSD workflow stores generated images

- **WHEN** PSD layer assets are generated
- **THEN** generated raster outputs SHALL remain compatible with existing image task results
- **AND** the workflow SHALL NOT require `AssetType.PSD` for first-version export
