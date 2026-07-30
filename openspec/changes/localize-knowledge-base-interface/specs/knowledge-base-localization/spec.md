## ADDED Requirements

### Requirement: Knowledge-base UI follows the selected application language
The system SHALL render reachable knowledge-base labels, placeholders, tooltips, confirmations, status, errors, dates, counts, and accessible names in the selected Chinese or English application language.

#### Scenario: Open the knowledge base in English
- **GIVEN** the selected application language is English
- **WHEN** the user opens and operates the knowledge base
- **THEN** its application-owned interface and accessible names SHALL be English
- **AND** user-authored names, Markdown, imported content, source metadata, and Skill bodies SHALL remain unchanged

#### Scenario: Switch back to Chinese
- **GIVEN** the knowledge base is open in English
- **WHEN** the application language changes to Chinese
- **THEN** application-owned knowledge-base text SHALL update to Chinese
- **AND** the selected note, draft, pane, filters, and stored content SHALL remain unchanged

### Requirement: Canonical knowledge-base data is not translated
The system SHALL preserve stored directory identifiers/names and all existing user content while allowing localized display aliases for system-owned directories.

#### Scenario: Display a canonical default directory
- **GIVEN** IndexedDB contains a canonical default knowledge-base directory
- **WHEN** it is rendered under Chinese or English UI
- **THEN** the system MAY display the localized system-directory label
- **AND** it SHALL NOT rename the persisted directory or break internal navigation/import matching

#### Scenario: Display existing mixed-language data
- **GIVEN** notes, tags, directories, or imported Markdown contain Chinese, English, or mixed-language text
- **WHEN** the UI language changes
- **THEN** those stored values SHALL render exactly as user data
- **AND** sorting and search SHALL continue to operate on the stored values

### Requirement: New default note titles use the active language without migrating old notes
The system SHALL use the active application language when generating a default title for a newly created note while treating prior titles as user data.

#### Scenario: Create an untitled note in English
- **GIVEN** the selected application language is English
- **WHEN** the user creates a note without entering a title
- **THEN** the generated default title SHALL be English and unique in the target directory
- **AND** existing Chinese default titles SHALL not be renamed

#### Scenario: Create an untitled note in Chinese
- **GIVEN** the selected application language is Chinese
- **WHEN** the user creates a note without entering a title
- **THEN** the generated default title SHALL be Chinese and unique in the target directory

### Requirement: Knowledge-base locale formatting preserves stored values
The system SHALL format knowledge-base dates and numeric counts for the active language without changing stored timestamps or sort order.

#### Scenario: Change language while viewing timestamps
- **GIVEN** notes have stored numeric creation and update timestamps
- **WHEN** the active language changes
- **THEN** displayed dates SHALL use the selected locale
- **AND** the underlying timestamps and chronological ordering SHALL remain unchanged
