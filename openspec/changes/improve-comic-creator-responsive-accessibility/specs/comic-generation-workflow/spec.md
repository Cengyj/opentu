## ADDED Requirements

### Requirement: Comic controls adapt to the tool content width

The system SHALL adapt comic planning, generation, history, and export controls to the comic tool's own content width so that a manually narrowed desktop tool window remains operable without relying on a narrow browser viewport.

#### Scenario: Desktop user narrows the comic tool window

- **GIVEN** the browser viewport remains desktop sized
- **WHEN** the comic tool content width reaches the existing compact-layout threshold
- **THEN** the prompt mode, model selector, generation controls, history filters, and export actions SHALL remain within the comic content boundary
- **AND** the selected model identity and primary actions SHALL remain readable and pointer/keyboard operable
- **AND** the adaptation SHALL NOT change or persist prompt, model, task, project, or window values

### Requirement: Comic workflow fields and navigation have localized accessible names

The system SHALL expose one stable localized accessible name for every visible comic input, textarea, native select, composite model selector, and icon-only workflow navigation action.

#### Scenario: Assistive technology enumerates the comic planning form

- **WHEN** the comic planning form is rendered
- **THEN** the creative demand, scenario, page count, prompt mode, knowledge context, and text model controls SHALL each expose a useful localized name
- **AND** naming metadata SHALL NOT include prompt bodies, credentials, task IDs, cached media, or full stored records

#### Scenario: Assistive technology navigates comic history

- **WHEN** comic history or favorites is rendered
- **THEN** back, history, favorites, query, status filter, select, favorite, and delete actions SHALL expose localized names that identify their existing action
- **AND** keyboard activation SHALL invoke the same existing callback exactly once

