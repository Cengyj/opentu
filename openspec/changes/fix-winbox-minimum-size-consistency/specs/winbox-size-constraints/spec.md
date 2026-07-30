## ADDED Requirements

### Requirement: Shared WinBox normal geometry honors declared constraints consistently

The system SHALL keep the stored and rendered normal rectangle of an existing shared WinBox within its current parsed effective minimum and maximum constraints, independent of lazy-load cache state, while preserving caller-declared dimension and placement intent.

#### Scenario: Open a percentage-sized window on the first lazy load

- **GIVEN** an existing WinBox caller declares a percentage dimension that resolves below its current parsed effective minimum
- **AND** the shared WinBox constructor has not yet loaded
- **WHEN** the window becomes visible after the constructor loads
- **THEN** its stored and rendered normal dimensions SHALL match the same effective constrained rectangle
- **AND** its existing center or numeric placement intent SHALL be evaluated against that final rectangle

#### Scenario: Reopen the same caller after WinBox is cached

- **GIVEN** the shared constructor is already cached and the caller's viewport and dimension props are unchanged
- **WHEN** the existing window closes and opens again
- **THEN** its normal rectangle SHALL match the constrained cold-open rectangle
- **AND** cache timing SHALL NOT create a different visible size or placement

#### Scenario: Restore a maximized constrained window

- **GIVEN** a window has a committed normal rectangle within its effective constraints
- **WHEN** the user maximizes and restores it without another intentional size change
- **THEN** the window SHALL return to that same normal rectangle
- **AND** SHALL NOT return to an under-minimum raw percentage value

#### Scenario: Use dimensions that already satisfy constraints

- **GIVEN** an existing numeric or percentage window dimension already lies within its parsed effective constraints
- **WHEN** the window opens, reopens, maximizes, or restores
- **THEN** its current normal dimensions and placement SHALL remain unchanged
- **AND** no redundant content remount or duplicate geometry callback SHALL occur

#### Scenario: The viewport cannot satisfy a raw minimum

- **GIVEN** the current WinBox container is smaller than a caller's raw declared minimum
- **WHEN** the shared wrapper resolves the window's effective current constraints
- **THEN** the existing parsed viewport maximum SHALL bound the effective rectangle
- **AND** this change SHALL NOT force overflow merely to satisfy an impossible raw minimum

### Requirement: Geometry normalization preserves existing caller behavior and state

The system SHALL normalize only the shared normal rectangle and SHALL preserve feature state, user-driven geometry, window lifecycle, callbacks, persistence, and data behavior.

#### Scenario: Normalize Settings and generation dialogs

- **GIVEN** the existing Settings, AI image generation, or AI video generation window declares a percentage height below its effective minimum at the current viewport
- **WHEN** it opens, reopens, maximizes, or restores
- **THEN** its effective declared minimum and final centered rectangle SHALL remain consistent
- **AND** Settings drafts/views/save guards and generation modes/parameters/tasks/results SHALL remain unchanged
- **AND** no provider request or task submission SHALL occur solely from geometry normalization

#### Scenario: Preserve intentional geometry transitions

- **GIVEN** a user or existing caller intentionally resizes, splits, restores from split, minimizes, shows, hides, or auto-maximizes a window
- **WHEN** the shared wrapper processes that transition
- **THEN** the existing action, callback count, keep-alive state, and caller-owned saved geometry semantics SHALL remain unchanged
- **AND** content SHALL NOT remount solely because normal constraints are synchronized

#### Scenario: Preserve unrelated consumers and data boundaries

- **GIVEN** Media Library, Prompt Optimize, toolbox, or another existing WinBox caller does not enter the under-minimum normal-size path in the measured state
- **WHEN** this shared normalization is present
- **THEN** its existing valid geometry and feature operations SHALL remain unchanged
- **AND** no board, settings, provider, task, cache, storage, analytics, API, credential, or migration payload SHALL change
