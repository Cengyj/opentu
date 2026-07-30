## ADDED Requirements

### Requirement: Prompt History Create and Edit Dialog Is Keyboard Accessible
The prompt history create/edit surface SHALL behave as a named modal dialog and manage keyboard focus for the duration of the interaction.

#### Scenario: User opens create or edit dialog with a keyboard
- **WHEN** the user activates create or edit from a prompt-history control
- **THEN** assistive technology identifies a modal dialog named by its visible heading
- **AND** focus moves to an enabled control inside the dialog
- **AND** Tab and Shift+Tab remain within the dialog while it is open

#### Scenario: User cancels with Escape
- **GIVEN** the create/edit dialog is open
- **WHEN** the user presses Escape
- **THEN** the dialog closes without saving prompt changes
- **AND** focus returns to the invoking control when that control still exists

#### Scenario: User closes through pointer or submit controls
- **GIVEN** the create/edit dialog is open
- **WHEN** the user dismisses the mask, activates Close or Cancel, or completes a successful Save
- **THEN** the existing close or save behavior is preserved
- **AND** focus returns to a safe prompt-history control without reaching obscured background controls during the modal interaction

