## ADDED Requirements

### Requirement: Command palette shall expose a localized combobox and option model

The system SHALL expose the current command palette as one localized named modal with a named expanded combobox controlling a grouped listbox of currently available command options.

#### Scenario: Palette opens with available commands

- **WHEN** the user opens the command palette from the application menu or keyboard shortcut
- **THEN** one modal SHALL expose the localized command-palette name
- **AND** initial focus SHALL move to the named search combobox
- **AND** the combobox SHALL control the current listbox

#### Scenario: Active command changes

- **WHEN** ArrowUp, ArrowDown or pointer hover changes the active command
- **THEN** exactly one current option SHALL expose selected state
- **AND** the combobox active descendant SHALL reference that option's stable command-derived ID

#### Scenario: Predicates or query remove the active option

- **WHEN** filtering changes the available options so the prior active option no longer exists
- **THEN** the active index and active-descendant relationship SHALL clamp to a current option
- **AND** SHALL clear when no option exists

#### Scenario: Locale changes

- **WHEN** application language changes between Chinese and English while the palette is open
- **THEN** modal, combobox, category, option and status names SHALL update consistently
- **AND** stable command IDs and target operations SHALL remain unchanged

### Requirement: Command palette result state shall be perceivable without noisy disclosure

The system SHALL expose concise localized result/no-result state while avoiding live announcement of the entire query, command list or target content.

#### Scenario: Query changes result count

- **WHEN** filtering changes the number of available command options
- **THEN** a concise localized result status SHALL identify the current count or no-match state
- **AND** SHALL NOT repeat every option or shortcut through a live region

#### Scenario: No command matches

- **WHEN** the normalized query has no current match
- **THEN** the visible localized no-match message SHALL be programmatically exposed as current status
- **AND** Enter SHALL execute no command

### Requirement: Command palette focus shall return or hand off deterministically

The system SHALL contain focus while the palette is open and SHALL distinguish cancellation/non-surface execution from commands that open a new focus-owning surface.

#### Scenario: User cancels from a connected opener

- **WHEN** the user closes the palette with Escape or outside activation without executing a command
- **THEN** focus SHALL return to the connected captured invoker
- **AND** SHALL NOT remain on the document body

#### Scenario: Ephemeral application-menu row unmounts

- **WHEN** the menu row that opened the palette is no longer connected at close
- **THEN** focus SHALL return to the defined stable application-menu owner control
- **AND** SHALL NOT reopen the menu automatically

#### Scenario: Hotkey opens from a workflow control

- **WHEN** the keyboard shortcut opens the palette from a connected non-text workflow control and the user cancels or executes a non-surface command
- **THEN** focus SHALL return to that captured workflow control

#### Scenario: Command opens a focus-owning target

- **WHEN** an executed command opens Settings, canvas search, a conversion dialog or another approved focus-owning surface
- **THEN** the palette SHALL close before target dispatch
- **AND** the target surface SHALL own final focus without a later palette restoration stealing it

### Requirement: Command palette shall remain reachable on compact and landscape viewports

The system SHALL keep the complete panel and active option reachable inside the viewport under background scroll lock and SHALL provide the project's compact touch-target size.

#### Scenario: Portrait compact viewport

- **WHEN** the palette is displayed at 320×568, 375×667 or 390×844 under compact or pointer-coarse conditions
- **THEN** search and option activation boxes SHALL be at least 44×44 CSS pixels
- **AND** the list SHALL remain internally scrollable without background canvas scrolling

#### Scenario: Short landscape viewport

- **WHEN** the palette is displayed at a supported short landscape viewport such as 640×360
- **THEN** the panel SHALL remain within the visible dynamic viewport budget
- **AND** keyboard scrolling SHALL make the complete active option visible
- **AND** body/canvas scrolling SHALL remain locked

#### Scenario: Desktop viewport

- **WHEN** the palette is displayed at the existing desktop breakpoint
- **THEN** current command order, icon/shortcut glyph sizes, theme tokens, z-index and desktop density SHALL remain

### Requirement: Command palette shall respect reduced motion

The system SHALL suppress nonessential overlay, scale, translate and option-transition motion when the user requests reduced motion.

#### Scenario: Reduced motion is requested

- **WHEN** `prefers-reduced-motion: reduce` is active and the palette opens or its active option changes
- **THEN** the palette SHALL show the resulting state without nonessential overlay/panel animation or option transition
- **AND** focus, filtering, selection and command execution SHALL remain unchanged

#### Scenario: No reduced-motion preference is active

- **WHEN** the user has not requested reduced motion
- **THEN** the existing short palette animations MAY remain
- **AND** SHALL NOT delay semantic state, focus or action availability

