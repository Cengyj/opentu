## ADDED Requirements

### Requirement: Custom Tool Mutations Match Durable Storage Results
The system SHALL report a custom-tool mutation as successful only when the same catalog state has been committed to both memory and persistent local storage.

#### Scenario: Custom-tool write succeeds
- **WHEN** an add, update, remove, clear, or import operation completes its persistent write
- **THEN** the in-memory catalog reflects that committed result
- **AND** the caller receives the existing success result for the same catalog change

#### Scenario: Custom-tool write fails
- **GIVEN** the previous custom-tool catalog is committed
- **WHEN** persistence of a new mutation fails
- **THEN** the caller receives the existing failure result or rejected promise
- **AND** the in-memory and persisted catalogs retain the previous committed state
- **AND** later catalog reads or synchronization SHALL NOT treat the failed mutation as accepted

#### Scenario: Custom-tool mutations overlap
- **WHEN** multiple persisted custom-tool mutations are started before earlier writes finish
- **THEN** they are applied in accepted order against the last committed catalog
- **AND** a failure or late completion SHALL NOT erase or reorder another successfully committed mutation

