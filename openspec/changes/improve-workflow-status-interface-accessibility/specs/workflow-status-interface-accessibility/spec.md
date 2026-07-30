## ADDED Requirements

### Requirement: Workflow Detail Disclosures SHALL Be Keyboard Operable

The system SHALL expose every existing expandable Chat workflow step, Agent tool-call, and Agent tool-result header as a localized named disclosure that shares one expanded state across keyboard and pointer input.

#### Scenario: A keyboard user opens and closes step details

- **GIVEN** a workflow step has parameters, a result, an error, or a duration
- **WHEN** keyboard focus reaches its disclosure and the user presses Enter or Space
- **THEN** the same details shown by pointer activation SHALL open or close exactly once
- **AND** the disclosure SHALL expose its expanded state and visible focus

#### Scenario: An Agent log has expandable payload details

- **GIVEN** a tool-call or tool-result log has an existing details section
- **WHEN** the user operates its localized disclosure by keyboard or pointer
- **THEN** the existing details SHALL toggle through one shared state
- **AND** a non-expandable log or workflow step SHALL NOT become an inactive tab stop

### Requirement: Workflow Progress SHALL Expose Bounded Assistive Status

The system SHALL expose the existing normalized Chat and WorkZone progress as determinate progress and SHALL announce concise localized lifecycle transitions without exposing user or provider payloads.

#### Scenario: A workflow is pending or running

- **WHEN** the workflow surface renders a normalized completed-step count and total-step count
- **THEN** its visual progress bar SHALL expose a localized name, minimum, maximum, and the same clamped current value
- **AND** assistive status SHALL identify the generic lifecycle and numeric progress without announcing workflow names, prompts, step descriptions, tool payloads, results, errors, URLs, or identifiers

#### Scenario: A workflow reaches a terminal state

- **WHEN** the normalized workflow changes to completed or failed
- **THEN** the surface SHALL expose one concise polite terminal-state update
- **AND** the existing visible failure, retry, result, and summary content SHALL remain available through their existing controls

#### Scenario: The same state renders again

- **GIVEN** lifecycle and normalized progress have not changed
- **WHEN** an animation frame, parent render, or duplicate projection rerenders the surface
- **THEN** the system SHALL NOT emit a new lifecycle announcement solely because of that rerender

### Requirement: Workflow Application Copy SHALL Follow The Current Language

The system SHALL render application-owned workflow labels in the current Chinese or English language on both the main Chat root and every independently rendered WorkZone root.

#### Scenario: The application language changes with a WorkZone present

- **GIVEN** Chat and WorkZone show the same workflow
- **WHEN** the user changes the existing application language
- **THEN** status, progress, detail, failure, retry, hide, delete, confirmation, and result action labels on both surfaces SHALL use the selected language
- **AND** the independent WorkZone root SHALL NOT remain on a default Chinese language

#### Scenario: Workflow data contains user or provider text

- **WHEN** the localized workflow interface renders a workflow name, prompt, step description, tool name, Agent content, result, error, URL, or identifier
- **THEN** that data SHALL remain unchanged
- **AND** no separate WorkZone language preference or stored record migration SHALL be introduced

### Requirement: Compact Workflow Controls SHALL Remain Readable And Operable

The system SHALL preserve the existing workflow title, status, count, and actions at compact widths without horizontal clipping and SHALL provide sufficiently sized touch targets for existing WorkZone actions.

#### Scenario: A long workflow title renders at 320 CSS pixels

- **WHEN** a Chat workflow bubble renders a long Chinese or English title at a 320 CSS-pixel viewport
- **THEN** the status label and progress count SHALL remain readable in their normal horizontal writing direction
- **AND** the title SHALL be constrained without causing horizontal overflow or hiding the status/count

#### Scenario: A compact user operates WorkZone actions

- **GIVEN** hide, delete, or retry is available on a compact or pointer-coarse WorkZone
- **WHEN** the action is rendered inside the existing card
- **THEN** its interactive layout box SHALL be at least 44×44 CSS pixels
- **AND** the glyph, action order, callback, and card boundary SHALL remain unchanged

### Requirement: Small Workflow Status Text SHALL Meet Contrast

The system SHALL render small normal workflow status and failure text at a contrast ratio of at least 4.5:1 against its actual application background while preserving redundant text or icon state cues.

#### Scenario: Chat step status text renders in the forced-light application palette

- **WHEN** pending, running, completed, failed, or skipped step status text is displayed
- **THEN** each small normal text value SHALL measure at least 4.5:1 against its computed background
- **AND** status SHALL remain conveyed by text or icon in addition to color

#### Scenario: WorkZone failure text renders in the forced-light application palette

- **WHEN** a failed step or failure summary is displayed in WorkZone
- **THEN** its small normal text SHALL measure at least 4.5:1 against its computed background
- **AND** this requirement SHALL NOT imply or add application-wide dark-mode support
