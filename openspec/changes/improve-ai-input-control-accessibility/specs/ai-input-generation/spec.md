## ADDED Requirements

### Requirement: AI Input Icon Controls Have Accessible Names

The AI input bar SHALL expose an accessible name for each icon-only control required to upload images, open the media library, and submit the current request.

#### Scenario: Screen reader inspects AI input controls

- **GIVEN** the canvas AI input bar is available
- **WHEN** assistive technology enumerates its interactive controls
- **THEN** the upload-image control SHALL expose a localized accessible name
- **AND** the media-library control SHALL expose a localized accessible name
- **AND** the submit control SHALL expose a localized accessible name

#### Scenario: Keyboard user activates an icon control

- **GIVEN** keyboard focus is on an AI input icon control
- **WHEN** the user activates the control
- **THEN** it SHALL perform the same existing action as pointer activation
- **AND** upload and media-library controls SHALL NOT trigger an enclosing form submission

### Requirement: Removable AI Attachments Are Perceivable And Operable

The AI composers SHALL expose each existing removable attachment through a localized, distinguishable remove control that remains perceivable and operable without hover.

#### Scenario: Assistive technology inspects repeated attachments

- **GIVEN** the primary AI input or Chat Drawer contains two or more removable attachments
- **WHEN** assistive technology enumerates the attachment controls
- **THEN** every remove control SHALL expose a localized accessible name
- **AND** the controls SHALL be distinguishable by their associated attachment while preserving the current attachment order and removal callback

#### Scenario: Keyboard user removes an attachment

- **GIVEN** keyboard focus reaches a removable attachment
- **WHEN** the remove control receives focus and the user activates it with Enter or Space
- **THEN** the control SHALL be visibly perceivable while focused
- **AND** it SHALL remove only the associated existing attachment
- **AND** it SHALL NOT submit the composer

#### Scenario: Non-hover input exposes attachment removal

- **GIVEN** the composer is used through a coarse pointer or another input mode without hover
- **WHEN** a removable attachment is displayed
- **THEN** its remove control SHALL remain visibly discoverable
- **AND** the control's hit target SHALL be at least 24 by 24 CSS pixels
- **AND** it SHALL NOT cover the activation target of an adjacent attachment
