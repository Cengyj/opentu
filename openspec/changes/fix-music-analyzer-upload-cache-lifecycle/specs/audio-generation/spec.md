## ADDED Requirements

### Requirement: Music Analyzer Shall Validate Upload Size Before Cache Write

The system SHALL enforce the existing Music Analyzer analysis-size limit before writing the selected upload to the unified cache.

#### Scenario: User selects audio larger than the existing analysis limit

- **GIVEN** the selected audio exceeds the existing 20 MB Music Analyzer analysis limit
- **WHEN** the user starts analysis
- **THEN** the tool SHALL reject the request before writing the source cache or creating a task
- **AND** SHALL preserve the selected form state and report the existing limit safely

### Requirement: Music Analyzer Upload Cache Shall Have Explicit Owners

The system SHALL retain a cached Music Analyzer upload while an accepted retryable task or retained record references it, and SHALL remove it only after the last explicit owner is removed or pruned.

#### Scenario: Cache succeeds but task creation is rejected

- **GIVEN** the Create page writes a new Music Analyzer source cache
- **WHEN** task creation fails before an accepted task exists
- **THEN** the page SHALL attempt to remove that new cache entry
- **AND** SHALL report submission failure without claiming cleanup success when cleanup also fails

#### Scenario: Analysis task fails or is cancelled but remains retryable

- **GIVEN** an accepted analysis task references the cached upload
- **WHEN** that task enters failed or cancelled while remaining in task history
- **THEN** the cache SHALL remain available for the existing retry path
- **AND** no Music Analyzer record SHALL be fabricated only to retain the cache

#### Scenario: The last task or record owner is deleted

- **GIVEN** a Music Analyzer cache URL is referenced by one or more stored tasks or records
- **WHEN** one owner is deleted or pruned
- **THEN** the cache SHALL remain if another owner still references it
- **AND** SHALL be removed idempotently after the last owner is removed
