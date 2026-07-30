## ADDED Requirements

### Requirement: PPT Editing Workflow Uses The Active Interface Language

The system SHALL present existing PPT editing, outline, add-page, slideshow, status, confirmation, error, tooltip, and empty-state interface copy in the active supported language.

#### Scenario: User opens the PPT workflow in Chinese or English

- **GIVEN** the active interface language is Chinese or English
- **WHEN** the user opens the PPT panel, outline mode, add-page dialog, or slideshow
- **THEN** system-authored visible copy for that workflow SHALL use the active language
- **AND** current actions, state meanings, callbacks, and keyboard shortcuts SHALL remain unchanged

#### Scenario: Runtime status changes

- **WHEN** a PPT operation enters loading, success, partial success, failure, cancellation, retry, disabled, or empty state
- **THEN** its system-authored status and feedback SHALL use the active language
- **AND** user-authored titles/prompts, provider/model labels, raw external payloads, media URLs, and filenames SHALL NOT be translated

### Requirement: PPT Page Name Localization Preserves Stored Content

The system SHALL localize newly created default PPT page names without rewriting existing stored or user-authored names.

#### Scenario: A new default PPT page is created

- **GIVEN** the active interface language is Chinese or English
- **WHEN** the system creates a page without a user-supplied title
- **THEN** the new default page name SHALL use the active language and page index
- **AND** bilingual default-name recognition SHALL preserve renumbering behavior

#### Scenario: An existing deck is opened, reordered, or saved

- **GIVEN** an existing page has a persisted default or custom name
- **WHEN** the deck is opened, reordered, or saved after changing interface language
- **THEN** the persisted name SHALL remain unchanged except where the existing explicit default-page renumber operation applies
- **AND** no localization key SHALL be stored in board, task, cache, or PPT metadata
