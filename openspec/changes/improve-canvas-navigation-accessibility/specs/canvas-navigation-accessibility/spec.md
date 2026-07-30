## ADDED Requirements

### Requirement: Canvas Navigation Controls Are Accessible Across Input Modes
The system SHALL preserve the existing canvas search and viewport actions while exposing localized names, keyboard-operable minimap navigation, sufficiently sized compact targets, and reduced-motion behavior.

#### Scenario: Assistive technology identifies canvas search actions
- **GIVEN** canvas search is open in Chinese or English
- **WHEN** assistive technology enumerates the previous-match, next-match, and close controls
- **THEN** every control SHALL expose a localized accessible name that identifies its operation
- **AND** its disabled state and existing pointer callback SHALL remain unchanged

#### Scenario: Keyboard user navigates with the minimap
- **GIVEN** the expanded minimap is visible and its custom navigation widget has keyboard focus
- **WHEN** the user presses an unmodified Arrow key
- **THEN** the viewport SHALL move in that direction by 10% of the current visible viewport dimension
- **AND** the key SHALL NOT also scroll the page or trigger a canvas shortcut
- **AND** focus SHALL remain on the minimap widget

#### Scenario: Assistive technology discovers the minimap contract
- **WHEN** assistive technology reaches the interactive minimap canvas
- **THEN** it SHALL expose a localized accessible name, custom two-dimensional navigation semantics, and localized Arrow-key instructions
- **AND** Tab and Shift+Tab SHALL move out of the widget in normal document order
- **AND** no board text, element identifier, coordinate, credential, or persisted user value SHALL be included in its accessible name or description

#### Scenario: Pointer and persistence behavior remains unchanged
- **WHEN** a pointer or touch user clicks or drags the minimap or activates an existing zoom/search control
- **THEN** the same pre-change viewport/search callback and analytics payload semantics SHALL occur
- **AND** viewport persistence, minimap expansion timing, rendering cadence, board data, and storage formats SHALL remain unchanged

#### Scenario: Compact navigation targets remain operable
- **GIVEN** the application viewport width is 768 CSS px or less
- **WHEN** the zoom-out, zoom-menu, zoom-in, minimap-toggle, or visible canvas-search action is rendered
- **THEN** its interactive layout box SHALL be at least 44×44 CSS px
- **AND** adjacent targets SHALL NOT overlap
- **AND** the control group and search surface SHALL remain within a 320 CSS px-wide viewport without horizontal page overflow
- **AND** existing icon glyph dimensions SHALL remain unchanged

#### Scenario: Reduced-motion preference suppresses nonessential navigation motion
- **GIVEN** the user has enabled `prefers-reduced-motion: reduce`
- **WHEN** canvas search or view navigation opens, repositions, previews, expands, or collapses
- **THEN** nonessential entrance, position, and preview animations owned by those surfaces SHALL be disabled
- **AND** callbacks, viewport results, focus order, and automatic hide delays SHALL remain unchanged
