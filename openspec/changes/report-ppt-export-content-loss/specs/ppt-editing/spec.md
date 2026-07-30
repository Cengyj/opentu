## ADDED Requirements

### Requirement: PPT Export Outcome Integrity

The system SHALL report full PPT export success only when every image-first page contains its required primary slide image in the generated file.

#### Scenario: Every required page image is embedded

- **GIVEN** every image-first PPT page has a readable current primary slide image
- **WHEN** the user exports the full deck
- **THEN** the system SHALL embed each required page image in deck order
- **AND** SHALL download the PPTX and report the number of successfully exported pages

#### Scenario: A required page image cannot be embedded

- **GIVEN** an image-first PPT page has a declared current primary slide image
- **WHEN** that image cannot be read, converted, or embedded during full-deck export
- **THEN** the system SHALL NOT write or download the incomplete deck
- **AND** SHALL report export failure with a safe reference to the affected page
- **AND** SHALL keep the source board and image references available for retry

#### Scenario: A non-critical legacy element is omitted

- **GIVEN** all required primary slide images can be embedded
- **AND** a non-critical background or legacy canvas element cannot be converted
- **WHEN** the full deck is exported
- **THEN** the system MAY download the usable PPTX
- **BUT** SHALL report partial success and the affected page/count instead of full success
- **AND** SHALL NOT expose media URLs, prompts, credentials, provider payloads, or task identifiers in feedback or analytics
