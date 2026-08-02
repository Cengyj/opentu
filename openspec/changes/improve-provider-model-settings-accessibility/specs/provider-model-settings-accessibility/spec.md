## ADDED Requirements

### Requirement: Provider configuration controls expose persistent names and switch state

The system SHALL provide persistent localized names, instructions, and programmatic state for the existing provider configuration controls without changing provider data, settings persistence, or network behavior.

#### Scenario: Inspect or edit provider connection fields

- **GIVEN** a provider profile is visible in the existing settings page
- **WHEN** a keyboard or assistive-technology user reaches its name, provider type, image compatibility, icon URL, Base URL, or API key
- **THEN** each rendered field SHALL be associated with its persistent localized visible purpose and any existing instruction
- **AND** placeholders SHALL NOT be the sole programmatic name
- **AND** values, parsing, masking, validation, draft state, and save behavior SHALL remain unchanged

#### Scenario: Inspect or toggle an enabled provider

- **GIVEN** an existing provider row exposes its enabled switch
- **WHEN** the switch is rendered or activated with pointer or keyboard input
- **THEN** its provider-scoped localized purpose and current checked state SHALL be programmatically available on the actual switch
- **AND** exactly the existing enabled-state callback, rollback, persistence, routing availability, and analytics behavior SHALL occur

#### Scenario: Navigate the API-key field and reveal control

- **GIVEN** an API key value is empty or present
- **WHEN** the user navigates, edits, reveals, or hides it
- **THEN** the field and reveal action SHALL retain localized stable names and the existing mask state
- **AND** the key value SHALL NOT enter a fixed accessible name, translation key, log, screenshot assertion, analytics payload, or unrelated control description

### Requirement: Provider-scoped model management exposes state and keyboard operations

The system SHALL make the existing provider-scoped model summary and discovery controls operable and perceivable without relying on click-only containers, visual classes, icons, or hover tips.

#### Scenario: Expand or collapse a model-type group

- **GIVEN** a provider has selected models grouped by type
- **WHEN** the user expands or collapses a group with pointer, Enter, or Space
- **THEN** the group trigger SHALL be a focusable native or equivalent disclosure with current expanded and controlled-region state
- **AND** the adjacent group benchmark action SHALL remain a separate control and SHALL NOT run from disclosure activation

#### Scenario: Change the discovery type filter

- **GIVEN** the provider discovery dialog contains model results
- **WHEN** the user chooses an existing all, image, video, audio, or text filter with pointer or keyboard input
- **THEN** exactly one current filter SHALL be programmatically identifiable
- **AND** filtering, counts, search, selection, recommendation, and ordering SHALL remain unchanged

#### Scenario: Expand or collapse a discovered vendor

- **GIVEN** filtered discovered models are grouped by vendor
- **WHEN** the user activates a vendor header with pointer or keyboard input
- **THEN** its current expanded state and controlled model region SHALL be programmatically available
- **AND** the existing single-expanded-vendor behavior and selected counts SHALL remain unchanged

#### Scenario: Test or remove a specific model without hover

- **GIVEN** an existing model row exposes a test or remove action
- **WHEN** the user navigates or activates that action without hover
- **THEN** its localized action and row scope SHALL be programmatically identifiable
- **AND** exactly the existing benchmark or removal callback SHALL run
- **AND** semantic navigation alone SHALL NOT invoke discovery, health, price, benchmark, storage, provider, task, media, or canvas side effects

### Requirement: Provider and model settings copy follows the selected application language

The system SHALL render application-authored provider/model settings and discovery content through the existing Chinese/English provider without changing provider, model, credential, catalog, preset, error, or routing data.

#### Scenario: Open provider settings in Chinese or English

- **GIVEN** the active application language is Chinese or English
- **WHEN** the user opens the provider page in normal, empty, loading, failure, or model-discovery state
- **THEN** application-authored headings, field labels, instructions, state names, actions, empty/failure framing, and accessible names SHALL use the selected language
- **AND** shared settings navigation and outer WinBox behavior SHALL remain outside this capability

#### Scenario: Change language while provider settings are open

- **GIVEN** the provider page or discovery dialog contains current drafts, selection, expansion, or focus state
- **WHEN** the existing provider changes language
- **THEN** mounted application-authored F-09 copy SHALL update without resetting drafts, selected profile/models, search, expanded group/vendor, dialog state, API-key mask, or focus

#### Scenario: Preserve provider, model, and private data across languages

- **GIVEN** provider names, model IDs, URLs, API keys, prices, errors, catalog values, or preset values contain arbitrary text
- **WHEN** either language renders or operates on that data
- **THEN** those values and existing callback arguments SHALL remain byte-for-byte unchanged
- **AND** no additional provider, discovery, health, price, benchmark, storage, analytics, task, media, or canvas side effect SHALL occur
