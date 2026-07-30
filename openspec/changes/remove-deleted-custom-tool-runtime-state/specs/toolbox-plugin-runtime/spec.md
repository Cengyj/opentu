## ADDED Requirements

### Requirement: Deleted Custom Tools Leave No Stale Runtime Launcher
The system SHALL remove window and persistent launcher state for a custom tool only after its catalog deletion has committed successfully, without deleting serialized canvas elements.

#### Scenario: User deletes an open or pinned custom tool
- **GIVEN** a custom tool has open, minimized, pinned, or launcher state
- **WHEN** the user confirms deletion and the catalog write succeeds
- **THEN** all window instances for that tool ID close
- **AND** its pinned ID, metadata, and preference are removed
- **AND** no toolbar launcher for the deleted catalog entry remains after reload

#### Scenario: Custom-tool deletion does not commit
- **WHEN** deletion is cancelled, the tool is missing, or persistence fails
- **THEN** existing window, minimized, pin, launcher, and canvas state remain unchanged

#### Scenario: Deleted custom tool exists on the canvas
- **GIVEN** a serialized canvas tool element still contains the deleted custom tool definition
- **WHEN** catalog deletion succeeds
- **THEN** the canvas element remains unchanged
- **AND** opening it as a window is transient unless the tool ID has been restored to the current catalog or registry

