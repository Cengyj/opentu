## ADDED Requirements

### Requirement: Model benchmark content exposes its current selections

The system SHALL expose the selected state of existing model-benchmark content controls to keyboard and assistive-technology users without changing their values or benchmark operations.

#### Scenario: Select a benchmark modality or comparison mode

- **GIVEN** the Workbench builder is visible
- **WHEN** the user selects an existing modality or comparison mode with pointer or keyboard input
- **THEN** exactly one current option in that group SHALL be programmatically identifiable
- **AND** the existing preset, target reconciliation, analytics, and no-auto-run behavior SHALL remain unchanged

#### Scenario: Filter or choose benchmark history

- **GIVEN** existing sessions are visible in history
- **WHEN** the user changes the modality filter or active session
- **THEN** the current filter and session SHALL be programmatically identifiable
- **AND** search, ordering, selection, export, and deletion behavior SHALL remain unchanged

#### Scenario: Rate, favorite, or reject a result

- **GIVEN** a synthetic or existing terminal benchmark entry is visible
- **WHEN** the user changes its score, favorite, or rejected state
- **THEN** the resulting state SHALL be programmatically identifiable from that entry's controls
- **AND** exactly the existing feedback mutation and no provider request SHALL occur

### Requirement: Model benchmark fields and content regions have persistent relationships

The system SHALL provide persistent localized labels and content structure for the existing benchmark history, builder, form controls, and results rather than relying on placeholders or visual position alone.

#### Scenario: Navigate the empty builder

- **GIVEN** no benchmark session or target is available
- **WHEN** a keyboard or assistive-technology user navigates the Workbench
- **THEN** history, builder, and results SHALL be identifiable regions or heading relationships
- **AND** history search, model/provider/target selectors, prompt, knowledge context, concurrency, and start controls SHALL have stable purpose and instruction relationships

#### Scenario: Enter or replace a prompt

- **GIVEN** the existing prompt textarea contains a default or user value
- **WHEN** the user edits it and placeholder text is no longer visible
- **THEN** its localized programmatic label SHALL remain available
- **AND** the prompt bytes, preset switching, validation, knowledge context, and submitted session input SHALL remain unchanged

#### Scenario: Render provider, model, session, and result values

- **GIVEN** arbitrary provider/model/session/prompt/result/error values are present
- **WHEN** the Workbench renders labels, regions, controls, confirmations, or results
- **THEN** application labels SHALL NOT incorporate raw credentials, URLs, provider payloads, prompts, or error bodies
- **AND** user/provider data SHALL remain byte-for-byte unchanged

### Requirement: Model benchmark application copy follows the selected language

The system SHALL render application-authored Model Benchmark Workbench content using the existing Chinese/English provider without changing benchmark data or operations.

#### Scenario: Open the Workbench in Chinese or English

- **GIVEN** the application language is Chinese or English
- **WHEN** the user opens the Workbench in empty, builder, history, confirmation, or result state
- **THEN** application-authored headings, labels, instructions, state names, actions, and safe feedback SHALL use the selected language
- **AND** accessible names and state descriptions SHALL be localized consistently

#### Scenario: Change language while the Workbench is open

- **GIVEN** the Workbench contains current builder selections or a synthetic/existing session
- **WHEN** the existing provider changes language
- **THEN** mounted application-authored copy SHALL update without resetting selection, prompt, knowledge context, concurrency, active session, manual feedback, or focus

#### Scenario: Preserve data and side effects across languages

- **GIVEN** provider/model/session titles, prompts, preview data, errors, or export values contain arbitrary text
- **WHEN** either language renders or operates on that data
- **THEN** those values and existing callback arguments SHALL remain byte-for-byte unchanged
- **AND** no additional provider, storage, export, analytics, task, media, or canvas side effect SHALL occur
