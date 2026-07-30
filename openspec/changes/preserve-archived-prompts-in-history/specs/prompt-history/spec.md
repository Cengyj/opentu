## ADDED Requirements

### Requirement: Prompt History Includes Durable Archived Records
The prompt history tool SHALL derive its lightweight history from both active and archived terminal task records without reactivating archived tasks.

#### Scenario: Automatic retention archives an older prompt task
- **GIVEN** an older completed, failed, or cancelled generation task has been marked `archived` by task retention
- **AND** its task record remains in IndexedDB
- **WHEN** the user opens, filters, searches, or refreshes prompt history
- **THEN** the task's prompt remains eligible for the same aggregation, override, deletion, pinning, filtering, and preview rules as an active terminal task
- **AND** the task remains absent from active task loading unless that view independently opts into archives

#### Scenario: Archived prompt task survives backup restore
- **GIVEN** a backup contains an archived terminal task with prompt data
- **WHEN** the user restores the backup and opens prompt history
- **THEN** the restored prompt is queryable from its lightweight task summary
- **AND** no task re-execution, unarchive write, or data migration occurs

#### Scenario: Archived task contains large execution fields
- **GIVEN** an archived prompt task contains uploaded media, analysis payloads, tool-call arrays, or full generated media data
- **WHEN** prompt history reads the archived task
- **THEN** only the existing lightweight prompt metadata and preview references cross into the prompt-history list layer
- **AND** the large execution fields remain excluded

