## ADDED Requirements

### Requirement: Default-Only Text Model Update Preserves Provider Routes

Changing the built-in default text model SHALL NOT mutate user-defined provider routes or selected provider model IDs.

#### Scenario: Custom provider route exists

- **GIVEN** a custom provider has an explicit text model route
- **AND** that model remains selected in the provider's authoritative catalog
- **WHEN** the application loads the new default model catalog
- **THEN** the custom provider route SHALL remain unchanged
- **AND** requests using that route SHALL continue to use its original model ID

#### Scenario: Runtime model is explicitly selected

- **GIVEN** a provider catalog contains a user-selected runtime text model
- **WHEN** the built-in default-display list changes
- **THEN** the catalog selection SHALL remain unchanged
- **AND** the runtime model SHALL remain selectable with its provider reference

### Requirement: Provider Routes Follow The Active User Selection Set

In provider-selection mode, request routing SHALL resolve only to models selected under enabled provider catalogs and SHALL NOT restore an unselected built-in or stale provider model.

#### Scenario: Stale route is replaced after credential change

- **GIVEN** a route references a model selected under a previous API key
- **AND** the current credential catalog selects a different model of the same type
- **WHEN** the route is resolved
- **THEN** it SHALL use the current selected model
- **AND** it SHALL use that model's owning provider credentials

#### Scenario: No model is selected for the requested modality

- **GIVEN** provider-selection mode is active
- **AND** no enabled provider has a selected model for the requested modality
- **WHEN** the route is resolved
- **THEN** it SHALL return no model or credentials
- **AND** it SHALL NOT fall back to a built-in default model
