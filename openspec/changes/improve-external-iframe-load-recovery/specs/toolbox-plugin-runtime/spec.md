## ADDED Requirements

### Requirement: External Iframe Tools Shall Expose Honest Recoverable Load States

The system SHALL expose localized and accessible loading, extended-loading, known-error, and retry states for external iframe tools without inspecting or disclosing cross-origin content.

#### Scenario: External iframe starts loading

- **WHEN** an external iframe tool is created in a WinBox window or on canvas
- **THEN** a loading status SHALL be visible above the iframe and programmatically available in the same user-visible region
- **AND** the first successful attempt SHALL issue exactly one external navigation
- **AND** the configured URL, sandbox, feature permissions, geometry, persistence, and analytics semantics SHALL remain unchanged

#### Scenario: External iframe load remains pending

- **GIVEN** no load or error signal has arrived within the bounded slow threshold
- **WHEN** the threshold elapses
- **THEN** the system SHALL describe the iframe as still loading rather than failed
- **AND** SHALL offer a keyboard-operable retry action
- **AND** a later load signal SHALL still reveal the successfully loaded iframe

#### Scenario: External iframe reports an error

- **WHEN** the browser supplies an iframe error signal
- **THEN** the system SHALL expose a localized alert and retry action above the iframe
- **AND** SHALL NOT render or log the raw URL, fragment, credential, prompt, tool instance ID, or remote response

#### Scenario: User retries an external iframe

- **GIVEN** the iframe is slow or reports an error
- **WHEN** the user activates retry
- **THEN** the system SHALL safely resolve and navigate the same tool URL once for the new attempt
- **AND** SHALL preserve the surrounding window/canvas identity, position, size, sandbox, and permissions
- **AND** stale events or timers from the previous attempt SHALL NOT change the new attempt or another instance

#### Scenario: External iframe instance is closed or removed

- **WHEN** its window unmounts or its canvas element is removed
- **THEN** all local lifecycle timers and callbacks for that instance SHALL be cleaned up
- **AND** other iframe tool instances SHALL remain unchanged

