## ADDED Requirements

### Requirement: Custom Tool Catalog Initialization Is Consistent
The system SHALL use one explicit custom-tool catalog initialization result so that persisted custom tools are not hidden, overwritten, or missed by reachable launch entry points because storage initialization is still pending.

#### Scenario: User mutates custom tools during slow initialization
- **GIVEN** the persisted custom-tool catalog has not finished loading
- **WHEN** the user starts an add or remove operation
- **THEN** the operation SHALL resolve against the initialized catalog rather than a provisional empty catalog
- **AND** a late initialization result SHALL NOT overwrite a successfully accepted mutation

#### Scenario: User opens the toolbox before custom tools are ready
- **WHEN** the toolbox opens while the persisted custom-tool catalog is loading
- **THEN** built-in tools remain available immediately
- **AND** persisted custom tools appear after the catalog becomes ready without requiring a search, filter, close, or reload action

#### Scenario: User launches a persisted custom tool
- **WHEN** a pinned custom-tool launcher requires the custom-tool catalog
- **THEN** the flow waits for the catalog's actual initialization result instead of an elapsed-time guess or provisional empty list
- **AND** each launch action opens at most one intended tool instance

#### Scenario: Custom-tool storage initialization fails
- **GIVEN** the persisted custom-tool catalog cannot be read
- **WHEN** a caller attempts a custom-tool mutation or launch
- **THEN** the system preserves built-in tool availability
- **AND** it SHALL NOT overwrite the unread catalog with a provisional empty or partial catalog
- **AND** the failure is reported through the caller's existing feedback or diagnostic boundary without exposing stored URLs or credentials
