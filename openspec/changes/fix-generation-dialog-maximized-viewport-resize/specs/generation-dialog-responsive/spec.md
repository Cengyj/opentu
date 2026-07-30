## ADDED Requirements

### Requirement: Maximized generation dialogs shall follow the current viewport

When an image or video generation dialog is visible and maximized, the system SHALL keep the window within the current viewport after a viewport resize or orientation change.

#### Scenario: A maximized image dialog rotates from landscape to portrait

- **GIVEN** the image generation dialog is visible and maximized in a mobile or tablet landscape viewport
- **WHEN** the viewport changes to portrait dimensions
- **THEN** the generation window SHALL fit within the new viewport
- **AND** the configuration and task mobile tabs SHALL remain visible and pointer-operable
- **AND** the mounted prompt, reference images, selected model, parameters, task state, and active mobile panel SHALL be preserved

#### Scenario: A maximized video dialog rotates from landscape to portrait

- **GIVEN** the video generation dialog is visible and maximized in a mobile or tablet landscape viewport
- **WHEN** the viewport changes to portrait dimensions
- **THEN** the generation window SHALL fit within the new viewport
- **AND** the configuration and task mobile tabs SHALL remain visible and pointer-operable
- **AND** the mounted prompt, reference images, selected model, parameters, task state, and active mobile panel SHALL be preserved

#### Scenario: A maximized generation dialog rotates from portrait to landscape

- **GIVEN** an image or video generation dialog is visible and maximized in a portrait viewport
- **WHEN** the viewport changes to landscape dimensions
- **THEN** the generation window SHALL fit within the new viewport
- **AND** the dialog content SHALL remain mounted and operable

### Requirement: Generation-dialog viewport adjustment shall preserve unrelated window and execution semantics

The system SHALL limit the responsive adjustment to visible maximized generation dialogs and SHALL preserve existing non-maximized window behavior and generation execution semantics.

#### Scenario: A non-maximized desktop generation window is resized

- **GIVEN** an image or video generation dialog is visible but not maximized
- **WHEN** the desktop viewport size changes
- **THEN** the system SHALL retain the existing window position and sizing behavior
- **AND** SHALL NOT force the dialog into a maximized state

#### Scenario: A generation task is active during a viewport change

- **GIVEN** an image or video generation task is pending, processing, completed, failed, or cancelled in the dialog
- **WHEN** the viewport size or orientation changes
- **THEN** task creation, routing, progress, cancellation, retry, persistence, caching, and result handling SHALL continue with their existing semantics
