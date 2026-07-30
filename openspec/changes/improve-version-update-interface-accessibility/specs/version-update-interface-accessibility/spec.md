## ADDED Requirements

### Requirement: Version update interface uses the selected application language

The system SHALL present application-owned update notice, action and changelog-heading copy in the selected supported language while preserving release values as data.

#### Scenario: Update notice appears in Chinese or English

- **GIVEN** the selected application language is Chinese or English
- **WHEN** a pending version is shown
- **THEN** the notice and existing action labels SHALL use that language
- **AND** the version value SHALL remain unchanged

#### Scenario: Language changes while the changelog is open

- **GIVEN** the update notice or changelog is visible
- **WHEN** the selected application language changes
- **THEN** application-owned labels and headings SHALL update
- **AND** version and changelog entries SHALL remain byte-for-byte release data
- **AND** no additional version fetch or update confirmation SHALL occur

### Requirement: Update readiness uses one bounded status announcement

The system SHALL expose the current update-ready summary as one concise bounded status without making actions or release notes live.

#### Scenario: A pending version becomes visible

- **WHEN** the update notice first renders for the current pending version
- **THEN** one polite atomic status SHALL announce that version is ready
- **AND** the action buttons and changelog content SHALL NOT be live regions

#### Scenario: Unrelated prompt state rerenders

- **GIVEN** the same pending version remains current
- **WHEN** task or dialog state causes an unrelated rerender
- **THEN** the readiness summary SHALL NOT be duplicated into multiple status regions

### Requirement: Version changelog exposes a named modal focus contract

The system SHALL expose the existing changelog view as a named modal and preserve explicit close/update actions.

#### Scenario: User opens the changelog

- **WHEN** the user activates the existing view-changelog control
- **THEN** one modal dialog SHALL open with the localized visible heading as its accessible name
- **AND** focus SHALL move to a meaningful control or content entry inside it

#### Scenario: User closes the changelog

- **WHEN** the user invokes the close control or Escape
- **THEN** the existing close callback SHALL run exactly once
- **AND** focus SHALL return to the view-changelog trigger
- **AND** no update confirmation SHALL be dispatched

#### Scenario: User explicitly updates from the changelog

- **WHEN** the focused update button is activated
- **THEN** one existing update-confirmation event SHALL be dispatched
- **AND** no keyboard shortcut outside that native activation SHALL auto-commit the update

### Requirement: Version notice honors reduced motion

The system SHALL preserve update notice state while removing nonessential entry animation for users who request reduced motion.

#### Scenario: Reduced motion is active

- **WHEN** the update notice appears under prefers-reduced-motion
- **THEN** the slide transform animation SHALL be removed or reduced
- **AND** the same notice text and actions SHALL remain visible and operable
