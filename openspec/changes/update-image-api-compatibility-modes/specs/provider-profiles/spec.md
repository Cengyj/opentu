## ADDED Requirements

### Requirement: Default New Provider Profiles To Official GPT Image Compatibility

The system SHALL default newly created image-capable provider profiles to the explicit `openai-gpt-image` compatibility mode instead of `auto` or `for-gpt-image`.

#### Scenario: User creates a new provider profile

- **GIVEN** the user creates a new provider profile from the settings UI
- **WHEN** the new profile draft is initialized
- **THEN** the profile SHALL store `imageApiCompatibility = openai-gpt-image`
- **AND** the user MAY still manually switch the profile to `auto` or `openai-compatible-basic`

### Requirement: Default Managed Legacy Profiles To Official GPT Image Without Losing Overrides

The system SHALL materialize built-in managed provider profiles with `openai-gpt-image` as their default compatibility mode unless a stored override already exists.

#### Scenario: Managed profile is rebuilt without a stored compatibility value

- **GIVEN** a built-in managed provider profile is reconstructed from legacy/default settings
- **AND** there is no stored `imageApiCompatibility` override for that profile
- **WHEN** the settings manager rebuilds the profile
- **THEN** the resulting profile SHALL default to `openai-gpt-image`

#### Scenario: Managed profile keeps a user-selected compatibility override

- **GIVEN** a built-in managed provider profile already stores an explicit supported compatibility value
- **WHEN** the settings manager rebuilds or reopens that profile
- **THEN** the system SHALL preserve the stored compatibility value
- **AND** SHALL NOT reset it back to `auto` or the managed default

### Requirement: Migrate Removed For GPT Compatibility To Official GPT Image

The system SHALL rewrite removed For GPT compatibility values to `openai-gpt-image` during profile normalization.

#### Scenario: Historical profile stores removed For GPT compatibility

- **GIVEN** a provider profile stores `imageApiCompatibility = for-gpt-image`, `tuzi-gpt-image`, or `tuzi-compatible`
- **WHEN** the profile is normalized or loaded
- **THEN** the system SHALL store `imageApiCompatibility = openai-gpt-image`
- **AND** the removed value SHALL NOT remain selectable in the settings UI

### Requirement: Preserve Explicit Historical Auto Choices

The system SHALL avoid silently rewriting explicit historical `auto` choices on custom provider profiles while still upgrading missing defaults.

#### Scenario: Historical custom profile explicitly stores auto

- **GIVEN** a custom provider profile already stores `imageApiCompatibility = auto`
- **WHEN** the profile is normalized or loaded
- **THEN** the system SHALL preserve `auto`
- **AND** SHALL continue to resolve it at runtime through the auto rules

#### Scenario: Historical profile missing the compatibility field

- **GIVEN** a historical provider profile predates the compatibility field and has no stored `imageApiCompatibility`
- **WHEN** the profile is normalized or upgraded
- **THEN** the system SHALL default the missing field to `openai-gpt-image`
- **AND** SHALL keep the value user-editable afterward
