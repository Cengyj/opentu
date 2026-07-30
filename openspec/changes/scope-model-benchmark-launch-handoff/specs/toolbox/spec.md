## ADDED Requirements

### Requirement: Model Benchmark Shortcut Handoff Shall Be One Shot

The system SHALL apply each model-benchmark shortcut request once and SHALL prevent the request from replaying after it is consumed.

#### Scenario: Settings shortcut opens a benchmark workbench

- **WHEN** the user invokes a benchmark shortcut for a provider/model context
- **THEN** the opened or reused benchmark workbench SHALL apply that context once
- **AND** the shortcut SHALL NOT start a provider call unless existing explicit auto-run authorization is present

#### Scenario: Target model discovery is still loading

- **GIVEN** the targeted workbench is waiting for compatible model discovery
- **WHEN** the shortcut request cannot yet be applied
- **THEN** the request SHALL remain pending until it is applied or the target becomes terminally unavailable
- **AND** an older acknowledgement SHALL NOT clear a newer shortcut request

#### Scenario: User later opens the workbench from the toolbox

- **GIVEN** an earlier shortcut was already applied or resolved
- **WHEN** the user closes and opens a generic model-benchmark workbench
- **THEN** the old provider/model context SHALL NOT replay
- **AND** the generic workbench SHALL use its normal builder defaults or current explicitly selected session
