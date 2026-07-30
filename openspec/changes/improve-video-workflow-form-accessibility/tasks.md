## 1. Evidence and Approval

- [x] 1.1 Inspect runtime names/roles/focus for the F-17 initial form.
- [x] 1.2 Run a controlled ArrowDown/Enter/Escape sample on the shared creative-brief combo.
- [x] 1.3 Trace shared F-17/F-18 field primitives and current pointer/typing behavior.
- [x] 1.4 Confirm outer WinBox accessibility remains owned by `improve-tool-window-accessibility`.
- [ ] 1.5 Obtain user approval for field naming and combobox keyboard semantics.

## 2. Implementation (approval required)

- [ ] 2.1 Add failing shared field-name and combo role/state/keyboard tests.
- [ ] 2.2 Add optional stable naming props to shared field and model-selector primitives.
- [ ] 2.3 Implement editable combobox/listbox keyboard behavior while preserving free text and pointer selection.
- [ ] 2.4 Associate every audited F-17/F-18 visible label with its control.
- [ ] 2.5 Add Analyze/Script/MV integration coverage, including two mounted instances and nested Escape precedence.

## 3. Verification

- [ ] 3.1 Run ComboInput, ModelDropdown, shared workflow, video analyzer, and MV focused tests.
- [ ] 3.2 Run focused lint, Drawnix typecheck, and full baseline comparison.
- [ ] 3.3 Capture same-viewport DOM and visual evidence at desktop/tablet/mobile in light/dark Chinese/English states.
- [ ] 3.4 Recheck pointer, typing, filtering, preset selection, focus, Escape, disabled, slow render, and multi-window behavior.
- [ ] 3.5 Run OpenSpec strict validation; while the CLI is unavailable, record the blocker and complete a manual structure/conflict audit.

