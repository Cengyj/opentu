## ADDED Requirements

### Requirement: Command palette search shall ignore boundary whitespace

The system SHALL match the current command registry using a query with leading and trailing whitespace removed while preserving the user's raw displayed query and meaningful internal whitespace.

#### Scenario: Valid query has leading or trailing whitespace

- **WHEN** a user types or pastes a query whose trimmed value matches a command label, keyword or shortcut
- **THEN** the palette SHALL return the same available commands and ordering as the trimmed query
- **AND** SHALL keep the raw query visible without rewriting the input or caret

#### Scenario: Query contains only whitespace

- **WHEN** the search query contains only whitespace
- **THEN** the palette SHALL use the existing empty-query behavior
- **AND** SHALL show all commands whose current predicates allow them

#### Scenario: Query contains meaningful internal spaces

- **WHEN** the normalized query contains internal spaces
- **THEN** the existing fuzzy matcher SHALL retain those internal spaces for scoring
- **AND** SHALL NOT collapse or reorder the user's search terms

#### Scenario: No normalized match exists

- **WHEN** no current label, keyword or shortcut matches the normalized query
- **THEN** the palette SHALL show its localized no-match state
- **AND** SHALL execute no command

### Requirement: Command palette keyboard handling shall respect text composition

The system SHALL leave navigation, submit and dismiss keys to the input method while native text composition is active and SHALL resume normal palette behavior only after composition ends.

#### Scenario: Enter commits an IME candidate

- **WHEN** Enter is received while the search input reports active composition or keyCode 229
- **THEN** the palette SHALL NOT close or execute/schedule the active command
- **AND** the input method SHALL retain control of the event

#### Scenario: Escape or Arrow key is used during composition

- **WHEN** Escape, ArrowUp or ArrowDown is received while composition is active
- **THEN** the palette SHALL NOT close or change the active command index
- **AND** the input method SHALL retain control of the event

#### Scenario: Ordinary key follows composition end

- **WHEN** composition has ended and the user then presses ArrowUp, ArrowDown, Enter or Escape
- **THEN** the existing command navigation, execution or dismissal behavior SHALL apply
- **AND** a valid Enter activation SHALL schedule exactly one current command through the existing dispatch boundary

### Requirement: Input correction shall preserve command-target contracts

The system SHALL retain current command IDs, predicate visibility, scoring order and target ownership while correcting search and composition handling.

#### Scenario: Equivalent normalized queries are compared

- **WHEN** raw queries differ only by leading or trailing whitespace
- **THEN** their available command IDs, category order and predicate results SHALL be identical

#### Scenario: Command is activated after valid input

- **WHEN** the user activates an available command outside composition
- **THEN** the palette SHALL close and invoke the existing target once on the existing next-frame boundary
- **AND** target feedback, storage, board mutation and recovery SHALL remain owned by that command's feature

