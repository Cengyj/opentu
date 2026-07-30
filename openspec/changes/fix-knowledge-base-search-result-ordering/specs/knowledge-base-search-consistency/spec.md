## ADDED Requirements

### Requirement: Knowledge-base search results belong to the current request
The system SHALL allow only the latest active knowledge-base query and directory-filter request to update the visible semantic results.

#### Scenario: An older query finishes after a newer query
- **GIVEN** semantic search for query A has started
- **AND** query B starts and returns after A starts but before A finishes
- **WHEN** query A later succeeds or fails
- **THEN** query A SHALL NOT replace or clear query B's visible result state

#### Scenario: Clear the query during an in-flight search
- **GIVEN** a semantic search is in progress
- **WHEN** the user clears the search input
- **THEN** the system SHALL restore the non-search note projection
- **AND** the old completion SHALL NOT repopulate search results

#### Scenario: Change the directory filter during an in-flight search
- **GIVEN** a semantic search is in progress for one directory filter
- **WHEN** the active directory filter changes
- **THEN** only results belonging to the latest query-and-filter pair SHALL be displayed

#### Scenario: Search completes after unmount
- **GIVEN** a semantic search is in progress
- **WHEN** the knowledge-base content unmounts
- **THEN** its late completion SHALL NOT attempt to update the released UI state
