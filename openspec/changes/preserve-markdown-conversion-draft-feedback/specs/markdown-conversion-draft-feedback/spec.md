## ADDED Requirements

### Requirement: Markdown conversion shall preserve authored text across locale changes

The system SHALL distinguish the dialog's untouched localized example from user-authored Markdown and SHALL NOT replace authored text solely because the application locale changes while the dialog remains open.

#### Scenario: Untouched example follows the locale

- **WHEN** the current Markdown text is the untouched example injected by the dialog and the application locale changes
- **THEN** the dialog SHALL replace it with the built-in example for the new locale
- **AND** SHALL continue conversion from that localized example

#### Scenario: Authored draft survives a locale change

- **WHEN** the user has edited the Markdown input and the application locale changes
- **THEN** the dialog SHALL preserve the authored text exactly
- **AND** SHALL NOT replace it with either built-in example

#### Scenario: Authored text equals an example

- **WHEN** an explicit user edit results in text equal to a built-in example and the locale later changes
- **THEN** the text SHALL remain user-authored for replacement decisions
- **AND** SHALL be preserved exactly

#### Scenario: Dialog is closed and reopened

- **WHEN** the user closes and later reopens the Markdown conversion dialog
- **THEN** the new mounted session SHALL start from the built-in example for the current locale
- **AND** no new persisted draft, backup field or migration SHALL be required

### Requirement: Markdown converter loading failure shall be identified truthfully

The system SHALL report a Markdown converter load failure with Markdown-specific localized UI feedback and aggregate diagnostics without exposing user content.

#### Scenario: Markdown converter fails to load in Chinese

- **WHEN** the Markdown converter module fails to load while the Chinese locale is active
- **THEN** the dialog SHALL display the Chinese Markdown load-failure message
- **AND** SHALL NOT identify the failing converter as Mermaid

#### Scenario: Markdown converter fails to load in English

- **WHEN** the Markdown converter module fails to load while the English locale is active
- **THEN** the dialog SHALL display the English Markdown load-failure message
- **AND** SHALL NOT identify the failing converter as Mermaid

#### Scenario: Load failure is logged

- **WHEN** the Markdown converter load failure is recorded for diagnostics
- **THEN** the diagnostic SHALL identify only the Markdown loading boundary and the caught error
- **AND** SHALL NOT add Markdown input, converted output, credentials, URLs or clipboard content

