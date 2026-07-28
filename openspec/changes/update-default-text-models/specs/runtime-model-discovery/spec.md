## ADDED Requirements

### Requirement: GPT-5.6 Text Defaults Are Selectable Without Runtime Discovery

The text selectable-model collection SHALL include `gpt-5.6-sol`, `gpt-5.6-terra`, and `gpt-5.6-luna` when no enabled provider has an authoritative model catalog.

#### Scenario: Empty runtime catalog

- **GIVEN** no enabled provider has an authoritative model catalog
- **WHEN** the system builds selectable text models
- **THEN** the three GPT-5.6 IDs SHALL be present
- **AND** they SHALL be ordered Sol, Terra, Luna

### Requirement: Explicit Legacy Static Text Models Remain Displayable

The system SHALL preserve an explicitly selected static text model in built-in fallback mode even when that model is no longer in the default display list.

#### Scenario: Existing user selected a legacy text model

- **GIVEN** the current route or persisted selection references a known static legacy text model
- **AND** that model is not in the default display list
- **WHEN** the text selector renders
- **THEN** the model SHALL be pinned into the visible choices
- **AND** its stored model ID SHALL remain unchanged

#### Scenario: Provider selection mode supersedes an unscoped static selection

- **GIVEN** an enabled provider has an authoritative model catalog
- **AND** the current selection references a static text model that was not selected from an enabled provider
- **WHEN** the text selector renders
- **THEN** the static model SHALL not be pinned into the visible choices
- **AND** the selection SHALL move to a valid selected provider model when one exists

### Requirement: Provider Selection Mode Shows Only User-Selected Models

Once an enabled provider has an authoritative catalog, model selectors SHALL expose only models explicitly selected under enabled provider catalogs.

#### Scenario: Selected provider models replace built-in defaults

- **GIVEN** an enabled provider catalog contains selected text models
- **WHEN** the system builds selectable text models
- **THEN** it SHALL return the selected provider-backed text models
- **AND** it SHALL not append GPT-5.6 built-in defaults unless those IDs were explicitly selected from a provider catalog

#### Scenario: No selected model for a modality

- **GIVEN** provider selection mode is active
- **AND** no enabled provider has a selected model for a modality
- **WHEN** a selector for that modality opens
- **THEN** it SHALL show an empty model state
- **AND** it SHALL not inject a built-in model as a selectable fallback

#### Scenario: Multiple enabled providers contribute selections

- **GIVEN** multiple enabled providers have selected models
- **WHEN** the selector collection is built
- **THEN** it SHALL contain the union of those selected provider-scoped models
- **AND** changing one provider credential SHALL not remove selections owned by another provider

### Requirement: Discovery Recommendations Follow Default Display

The model discovery dialog SHALL treat only current default-display models as recommended models.

#### Scenario: User selects recommended discovered models

- **GIVEN** a provider discovery response contains both current default models and legacy static models
- **WHEN** the user activates the recommended-model action
- **THEN** the current default-display models SHALL be selected
- **AND** legacy models SHALL remain available for manual selection
