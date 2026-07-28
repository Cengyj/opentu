## ADDED Requirements

### Requirement: New Text Defaults Do Not Rewrite User Selections

The AI input bar SHALL use the GPT-5.6 default only when no valid explicit or persisted text selection is available.

#### Scenario: Fresh text mode

- **GIVEN** there is no explicit text route or persisted model selection
- **WHEN** the AI input bar initializes text or Agent mode
- **THEN** it SHALL use `gpt-5.6-sol` as the fallback model

#### Scenario: Existing explicit legacy selection

- **GIVEN** the user has selected a known legacy text model
- **AND** no enabled provider has an authoritative model catalog
- **WHEN** the AI input bar initializes
- **THEN** it SHALL keep that model selected
- **AND** it SHALL not rewrite local storage or settings to a GPT-5.6 ID
