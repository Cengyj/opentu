## ADDED Requirements

### Requirement: Built-In External Tools Shall Not Receive Application Provider Credentials

The system SHALL NOT inject an application provider credential into a built-in cross-origin iframe tool URL, fragment, path, query, DOM attribute, log, analytics event, accessible name, or persistent record.

#### Scenario: User opens the built-in Chat-MJ tool

- **WHEN** Chat-MJ is opened from any supported toolbox, launcher, or canvas entry
- **THEN** the external Chat-MJ shell SHALL be loaded without the application's provider API key or base URL
- **AND** the existing tool identity, category, window lifecycle, canvas capability, and sandbox policy SHALL remain unchanged

#### Scenario: User has an application provider key configured

- **GIVEN** the application settings contain a provider credential
- **WHEN** any built-in external tool URL is resolved
- **THEN** that credential SHALL NOT be added to the resolved built-in URL or any launch diagnostic

### Requirement: Sensitive Tool Templates Shall Use One Launch Preflight Across All Entries

The system SHALL reject a tool launch or render before state, iframe, analytics, pin, or canvas mutation when an explicitly user-authored sensitive URL template is missing its required configured value.

#### Scenario: Missing-key custom tool is opened from a window entry

- **GIVEN** a user-authored custom tool URL contains `${apiKey}` and the application key is empty
- **WHEN** the user opens it from the drawer card/window action, pinned launcher, or launcher new-window action
- **THEN** no tool window or iframe request SHALL be created
- **AND** the user SHALL receive localized actionable settings guidance that contains no key or raw URL

#### Scenario: Missing-key custom tool is inserted or rendered on canvas

- **GIVEN** a user-authored custom tool URL contains `${apiKey}` and the application key is empty
- **WHEN** the user inserts it, a persisted element renders or refreshes, or the element is opened as a popup
- **THEN** no sensitive iframe request SHALL be issued
- **AND** a popup rejection SHALL leave the canvas element intact
- **AND** the user SHALL receive a privacy-safe missing-configuration state or message

#### Scenario: Configured user-authored custom tool is launched

- **GIVEN** the custom-tool authoring UI disclosed the `${apiKey}` destination risk and the required value is configured
- **WHEN** the tool is opened through any supported entry
- **THEN** the existing runtime substitution and tool lifecycle MAY proceed
- **AND** only the unresolved template SHALL be stored in catalog, canvas, backup, or export data

