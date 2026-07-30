## ADDED Requirements

### Requirement: External WinBox Clipboard Permission Shall Be Explicit And Least-Privilege

The system SHALL omit clipboard feature permissions from an external WinBox iframe unless its built-in tool manifest explicitly declares a feature required by an existing user action, and each declaration SHALL contain only the confirmed minimum feature set.

#### Scenario: User opens Banana Prompt in a WinBox

- **GIVEN** the Banana Prompt manifest declares its existing copy action
- **WHEN** the external Banana Prompt iframe is rendered in a WinBox
- **THEN** the parent frame SHALL allow `clipboard-write` for that iframe
- **AND** the iframe SHALL NOT receive `clipboard-read`
- **AND** its URL, sandbox tokens, dimensions, and window lifecycle SHALL remain unchanged

#### Scenario: User opens an external tool without a clipboard declaration

- **GIVEN** Chat-MJ, Pose Library, or another external URL tool has no explicit WinBox clipboard declaration
- **WHEN** its iframe is rendered in a WinBox
- **THEN** the iframe SHALL have no clipboard feature permission in its `allow` attribute
- **AND** no default clipboard permission SHALL be inferred from its URL, category, sandbox, or custom-tool status

#### Scenario: Browser or external page independently refuses a Banana copy

- **GIVEN** the Banana WinBox parent policy allows `clipboard-write`
- **WHEN** browser permission, user activation, operating-system policy, or the external page independently refuses the write
- **THEN** Opentu SHALL NOT broaden the iframe permission to `clipboard-read` or another feature
- **AND** the parent-policy allowance SHALL NOT be reported as a guarantee of clipboard success

#### Scenario: User inserts Banana Prompt on the canvas

- **WHEN** the Banana Prompt tool is rendered through the existing canvas iframe path
- **THEN** this WinBox-specific change SHALL NOT modify the canvas iframe Feature Policy
- **AND** it SHALL NOT add a new serialized permission field or migrate existing board data

