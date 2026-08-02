## ADDED Requirements

### Requirement: Provider settings omit manual pricing controls

The system SHALL NOT expose provider pricing URL, currency conversion, pricing-group selection, or manual pricing-fetch controls in the provider settings page.

#### Scenario: User opens or edits a provider profile

- **WHEN** a user opens an existing provider profile or creates a new provider profile in settings
- **THEN** no model pricing URL input, CNY-per-USD input, pricing-group selector, or “获取价格” action SHALL be rendered
- **AND** opening, editing, or saving the profile SHALL send no pricing request

### Requirement: Shared pricing consumers remain independent

Removing the provider settings controls SHALL NOT delete or redefine the shared provider pricing cache, cached model metadata, or cached endpoint evidence used by other runtime capabilities.

#### Scenario: Existing pricing cache is available

- **GIVEN** an existing profile has eligible persisted pricing cache data
- **WHEN** model presentation or provider binding inference reads that cache
- **THEN** cached model prices, documentation metadata, and endpoint evidence SHALL remain available as before
- **AND** provider routing, model discovery, and generation SHALL remain unchanged

#### Scenario: Existing provider pricing configuration loads

- **WHEN** a stored profile or backup contains existing pricing configuration fields
- **THEN** settings normalization SHALL preserve the fields without migration or destructive cleanup
- **AND** the removed settings controls SHALL NOT overwrite or clear them
