## ADDED Requirements

### Requirement: Pending version readiness survives deferred UI mounting

The system SHALL retain the current page's authoritative pending-version readiness until the deferred update UI can consume it, independent of producer and consumer mount order.

#### Scenario: Update becomes ready before the prompt mounts

- **GIVEN** a staged version is ready and differs from the committed version
- **AND** the update prompt has not mounted
- **WHEN** the deferred update UI later mounts
- **THEN** the same pending version SHALL become available to the prompt
- **AND** the system SHALL NOT require a second SW state transition

#### Scenario: Update becomes ready after the prompt mounts

- **GIVEN** the update prompt is already listening
- **WHEN** a staged version becomes ready
- **THEN** the prompt SHALL receive the pending version once
- **AND** the result SHALL match the before-mount path

#### Scenario: Pending version changes or clears

- **GIVEN** the current page has retained pending version A
- **WHEN** authoritative runtime state replaces it with version B or reports no pending update
- **THEN** the page-local readiness SHALL replace A with B or clear it respectively
- **AND** a stale asynchronous result for A SHALL NOT restore A

### Requirement: Replayed update readiness preserves explicit task-safe upgrade semantics

The system SHALL replay only readiness information and SHALL preserve the existing active-task guard and explicit commit protocol.

#### Scenario: Active tasks delay a replayed prompt

- **GIVEN** a pending version was retained before the prompt mounted
- **AND** active tasks exist
- **WHEN** the update UI mounts
- **THEN** the visible prompt SHALL remain hidden
- **AND** readiness SHALL remain available so the prompt can appear after active tasks finish

#### Scenario: User explicitly confirms one pending version

- **GIVEN** a current pending version is visible and no active task blocks it
- **WHEN** the user invokes the existing update action once
- **THEN** the system SHALL resolve a live waiting worker and post one COMMIT_UPGRADE
- **AND** reload SHALL still wait for activation or controller takeover

#### Scenario: Waiting worker is temporarily unavailable

- **GIVEN** the prompt represents a retained pending version
- **WHEN** explicit confirmation cannot resolve a waiting worker
- **THEN** the system SHALL keep the update available
- **AND** SHALL use the existing state/update checks without reporting successful commit
