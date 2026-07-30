## ADDED Requirements

### Requirement: Early startup failure exposes direct bounded recovery

The system SHALL distinguish terminal pre-React startup failure from loading progress and SHALL expose direct, explicit access to the existing retry, safe-mode and debug recovery routes.

#### Scenario: A startup resource or script fails

- **GIVEN** the HTML boot shell is active
- **WHEN** a managed terminal resource, script or startup rejection is reported
- **THEN** the shell SHALL expose one named assertive failure region
- **AND** SHALL NOT represent the terminal state as a completed loading progressbar
- **AND** retry, safe-mode and debug actions SHALL be keyboard operable

#### Scenario: Terminal failure receives focus without action

- **WHEN** the HTML shell first enters terminal failure
- **THEN** focus SHALL move to the retry control
- **AND** no reload, safe-mode write or navigation SHALL occur until the user activates a distinct action

#### Scenario: Normal startup completes

- **GIVEN** no terminal startup failure occurred
- **WHEN** the application reports ready
- **THEN** the existing polite loading/progress status SHALL complete and leave
- **AND** recovery controls SHALL NOT appear

### Requirement: React recovery surfaces expose one named blocking context

The system SHALL expose repeated-crash, initialization, render and lazy-chunk recovery as one named blocking context with deterministic keyboard entry.

#### Scenario: A React recovery surface appears

- **WHEN** ErrorFallbackUI replaces the application
- **THEN** it SHALL expose one alertdialog named by the visible recovery heading
- **AND** concise recovery context SHALL describe the dialog
- **AND** focus SHALL move to an existing non-auto-activating recovery control

#### Scenario: User invokes an existing recovery action

- **WHEN** the user activates continue, export log, safe mode or debug where that action is present
- **THEN** the existing callback SHALL run exactly once
- **AND** no unrelated recovery action SHALL run

### Requirement: Recovery diagnostics expose bounded state without live raw content

The system SHALL expose interactive diagnostic state while keeping raw error and stack content opt-in and non-live.

#### Scenario: User expands error details

- **GIVEN** error stack or component stack detail exists
- **WHEN** the user toggles details
- **THEN** the control SHALL expose expanded state and a relationship to the detail region
- **AND** the raw detail SHALL NOT be a live region or accessible name

#### Scenario: Memory information is available

- **WHEN** recovery receives a memory percentage
- **THEN** the visual memory bar SHALL expose a progress value clamped from 0 to 100
- **AND** the used/limit summary SHALL remain available as concise value text

### Requirement: Recovery remains usable without application styles and at compact sizes

The system SHALL keep critical recovery content and actions usable when application CSS fails and across compact, zoomed, touch and reduced-motion conditions.

#### Scenario: Application CSS is unavailable

- **WHEN** the React recovery UI renders using only its critical inline styles
- **THEN** the named recovery context, heading, details and all current actions SHALL remain visible and operable
- **AND** content SHALL remain within the viewport at the supported compact widths

#### Scenario: User prefers reduced motion

- **WHEN** reduced motion is requested
- **THEN** nonessential recovery progress/entry transitions SHALL be removed or reduced
- **AND** state changes SHALL remain perceivable without animation

### Requirement: Recovery copy uses only an available supported language owner

The system SHALL use the current supported runtime language when it is already available without introducing a second persisted language owner.

#### Scenario: Runtime language is known before a React error

- **GIVEN** the existing application language owner currently holds Chinese or English
- **WHEN** a React recovery surface appears
- **THEN** application-owned recovery labels and instructions SHALL use that language
- **AND** user/error/stack/diagnostic content SHALL remain byte-for-byte data

#### Scenario: Language owner is not yet available

- **WHEN** the pre-React shell or initialization recovery appears before a selected runtime language exists
- **THEN** the documented default language SHALL be used
- **AND** no browser-locale inference or new persisted language setting SHALL be created
