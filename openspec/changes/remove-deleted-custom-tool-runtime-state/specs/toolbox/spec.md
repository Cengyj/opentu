## ADDED Requirements

### Requirement: Custom Tool Deletion Feedback Matches Runtime Cleanup
The system SHALL report custom-tool deletion success only after the catalog deletion and required runtime cleanup for that tool ID have completed.

#### Scenario: User confirms custom-tool deletion
- **WHEN** the persistent catalog deletion succeeds
- **THEN** the toolbox removes the tool entry and reports success
- **AND** the tool's windows and launcher are no longer available

#### Scenario: Custom-tool deletion fails
- **WHEN** the persistent catalog deletion fails
- **THEN** the toolbox reports failure through its existing feedback boundary
- **AND** the tool entry, windows, launcher, and pin state remain available
