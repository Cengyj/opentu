## ADDED Requirements

### Requirement: Knowledge-base edits retain every pending field
The system SHALL coalesce pending knowledge-base title and Markdown-body edits without allowing an edit to one field to discard the other field.

#### Scenario: Edit title and body inside one debounce interval
- **GIVEN** the user is editing a writable knowledge-base note
- **WHEN** the user changes both its title and body before the quiet period expires
- **THEN** the system SHALL persist the latest value of both fields
- **AND** it SHALL not report the note as saved after committing only one field

#### Scenario: More input arrives during a save
- **GIVEN** a note update is still being written
- **WHEN** the user makes another title or body edit
- **THEN** the system SHALL retain the later edit as a trailing batch
- **AND** write completion order SHALL not restore an older field value

### Requirement: Pending note edits survive in-page editor transitions
The system SHALL enqueue a pending writable-note draft when the user switches notes or closes the knowledge-base editor within the running page.

#### Scenario: Switch notes before the debounce expires
- **GIVEN** a writable note has a pending title or body edit
- **WHEN** the user selects another note
- **THEN** the pending edit SHALL be submitted for the originating note instead of being cleared
- **AND** a late completion SHALL not replace the newly selected note's draft or status

#### Scenario: Close the knowledge-base tool before the debounce expires
- **GIVEN** a writable note has a pending edit
- **WHEN** the knowledge-base editor unmounts while the application page remains running
- **THEN** the system SHALL start the pending save before releasing the editor state
- **AND** reopening the note after that successful write SHALL show the committed values

### Requirement: Knowledge-base save outcomes are truthful and retryable
The system SHALL expose the asynchronous save outcome and SHALL keep a failed draft retryable while the editor remains mounted.

#### Scenario: IndexedDB update rejects
- **GIVEN** a note draft is being saved
- **WHEN** the durable update rejects
- **THEN** the editor SHALL show a save failure instead of an unhandled rejection or saved state
- **AND** the failed latest draft SHALL remain available for retry

#### Scenario: Retry a failed save
- **GIVEN** the editor shows a failed latest draft
- **WHEN** the user activates retry and storage accepts the update
- **THEN** the latest title and body values SHALL be committed once
- **AND** the editor SHALL transition to the saved state
