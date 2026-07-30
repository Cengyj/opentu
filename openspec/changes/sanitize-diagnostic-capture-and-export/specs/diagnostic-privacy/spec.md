## ADDED Requirements

### Requirement: Diagnostic data SHALL cross a bounded privacy-safe boundary

The system SHALL create a bounded, serializable, privacy-safe projection before diagnostic data is retained, displayed, copied, transported, or downloaded.

#### Scenario: Crash diagnostic is captured

- **WHEN** startup, error, rejection, unload, freeze, long-task, resource, console, network, or custom crash context is captured
- **THEN** URL query/fragment, credential-shaped keys/values, bearer/authorization values, oversized structures, and unsafe raw values SHALL NOT enter localStorage, SW transport, crash IndexedDB, or live debug broadcast
- **AND** safe snapshot type, timestamp, error category, bounded location summary, memory/page counts, duration, and FPS SHALL remain available

#### Scenario: Unified log is recorded

- **WHEN** a unified log receives message text, structured data, or an Error
- **THEN** all three inputs SHALL be normalized before memory-cache or IndexedDB insertion
- **AND** sensitive keys/values, credential assignments, URL query/fragment, unsafe raw stack/message content, and values beyond the configured bounds SHALL NOT be retained
- **AND** safe category, level, session, duration, error name/category, and bounded summary SHALL remain available

#### Scenario: User displays, copies, or downloads diagnostics

- **WHEN** the application error UI or SW Debug displays, copies, or downloads current diagnostics
- **THEN** a fresh final privacy-safe projection SHALL be applied to the complete output
- **AND** environment URL, current error, component stack, crash recovery data, console/network data, unified logs, crash snapshots, and selected debug logs SHALL NOT bypass that boundary
- **AND** a serialization/sanitization failure SHALL produce a safe failure outcome rather than a partially raw export

#### Scenario: Historical record predates the safe boundary

- **GIVEN** an existing diagnostic record contains a legacy raw field
- **WHEN** the record is read for display, copy, or export
- **THEN** the raw field SHALL be filtered by the current final boundary
- **AND** the system SHALL NOT require a destructive background migration or store wipe
- **AND** at-rest removal MAY occur through existing eviction, user clear, or an ordinary compatible safe overwrite

#### Scenario: Diagnostic input is cyclic, malformed, or oversized

- **WHEN** diagnostic input cannot be traversed or serialized normally
- **THEN** projection SHALL terminate within configured depth/item/string bounds without throwing into product flow
- **AND** unsupported content SHALL become a stable safe summary or omission
