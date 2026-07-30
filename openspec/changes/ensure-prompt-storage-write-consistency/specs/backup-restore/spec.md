## ADDED Requirements

### Requirement: Prompt Backup and Restore Uses a Durable Write Boundary
Backup export and import SHALL resolve prompt writes accepted earlier in the session before collecting, merging, clearing, or replacing prompt domains.

#### Scenario: User starts backup immediately after a prompt mutation
- **GIVEN** a prompt add, edit, pin, or delete has been accepted and its IndexedDB write is still pending
- **WHEN** the user starts backup export
- **THEN** prompt collection waits for the accepted write to complete
- **AND** the backup contains the same prompt state visible to the user

#### Scenario: Prompt write fails before backup
- **GIVEN** an accepted prompt write cannot be persisted
- **WHEN** backup reaches the prompt collection boundary
- **THEN** backup reports a safe prompt-storage failure instead of claiming a stale prompt payload is current
- **AND** no raw prompt content or credential is included in the error feedback

#### Scenario: User imports while earlier prompt writes are pending
- **GIVEN** prompt writes accepted before import are still pending
- **WHEN** merge or replace restore begins for the prompt domain
- **THEN** those writes reach a deterministic completion or failure boundary before imported data is merged or replaces local data
- **AND** an older pending write cannot complete later and overwrite restored prompt state

