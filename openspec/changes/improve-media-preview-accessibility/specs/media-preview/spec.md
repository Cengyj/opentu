## ADDED Requirements

### Requirement: Full-screen media preview is an accessible modal dialog

The system SHALL expose the full-screen media preview as a labelled modal dialog and keep keyboard focus within the visible preview until it closes.

#### Scenario: Open and close preview with the keyboard

- **GIVEN** focus is on a control that opens a media preview
- **WHEN** the preview opens
- **THEN** focus SHALL move to a stable visible control inside the preview
- **AND** Tab and Shift+Tab SHALL remain within the preview
- **WHEN** the user presses Escape
- **THEN** the preview SHALL close
- **AND** focus SHALL return to the invoking control when it is still available

### Requirement: Media preview controls expose localized purpose and state

The system SHALL provide localized accessible names for every media preview action and selector, independently of visual hover feedback.

#### Scenario: Assistive technology inspects preview actions

- **WHEN** a user navigates the preview toolbar, viewport actions, or thumbnail queue
- **THEN** every interactive control SHALL expose a non-empty localized accessible name
- **AND** toggles, the current thumbnail, and compare-slot selection SHALL expose their current state where applicable

### Requirement: Media preview remains operable on touch and reduced-motion settings

The system SHALL preserve usable interaction targets on supported mobile viewports and SHALL suppress non-essential preview motion when the user requests reduced motion.

#### Scenario: Use preview on a narrow touch viewport

- **WHEN** the preview is rendered at a supported narrow viewport
- **THEN** action hit areas SHALL meet the approved project touch-target threshold
- **AND** the toolbar SHALL remain reachable without clipping the media content or close action

#### Scenario: Open preview with reduced motion enabled

- **GIVEN** the operating system requests reduced motion
- **WHEN** the preview opens or its controls change state
- **THEN** non-essential fade, transform, and smooth-scroll motion SHALL be disabled
- **AND** the same controls and state changes SHALL remain available
