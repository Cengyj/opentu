## Context

The video analyzer and MV workflow reuse `CreativeBriefEditor`, `VideoParametersRow`, `ComboInput`, and form-variant `ModelDropdown`. Visible labels are layout siblings, not programmatic labels. `ComboInput` owns an input and portals a pointer-only option menu to `document.body`.

## Goals / Non-Goals

- Goals:
  - Give every visible field one stable accessible name.
  - Make existing preset selection fully operable with keyboard while retaining free text.
  - Keep focus and expanded state coherent across the portaled listbox.
  - Keep the F-17/F-18 shared form contract consistent.
- Non-Goals:
  - Do not redesign the form, add presets, change prompt content, or change stored values.
  - Do not change the outer WinBox focus/Escape contract owned by `improve-tool-window-accessibility`.
  - Do not change target sizes, colors, spacing, z-index, or responsive window geometry in this change.
  - Do not replace existing model discovery/routing behavior.

## Decisions

- Decision: shared field components accept stable `id`/`label` or `aria-labelledby` inputs, while page call sites provide localized visible labels.
  - Native label association is preferred for input/textarea/select. Composite model selectors use an explicit named trigger contract.
- Decision: implement `ComboInput` as an editable combobox controlling one portaled listbox.
  - ArrowDown/ArrowUp moves an active option; Home/End moves to bounds; Enter selects; Escape closes without changing the value; typing retains existing filtering/free-text behavior.
  - Focus stays in the input, with `aria-activedescendant` identifying the active option.
- Decision: option IDs are unique per mounted component and do not contain user-entered values.
- Decision: pointer `onMouseDown` selection remains one activation and produces the same value as keyboard selection.

## Invariants

- Visible labels and existing layout remain unchanged.
- Every rendered visible form field has exactly one useful accessible name.
- Open/closed state, active option, and `aria-expanded` remain synchronized.
- Keyboard and pointer selection emit the same existing option value exactly once.
- Escape closes only the combo/listbox and does not close the outer tool window in the same key event.
- Free-text values, presets, model references, prompt builders, record schemas, storage keys, and analytics remain unchanged.

## Risks / Trade-offs

- Escape could bubble to the pending outer WinBox handler and close the tool.
  - Mitigation: the combo handles and stops the event only while its listbox is open; add integration coverage with the outer-window change.
- Portaled listbox IDs can collide across multiple tool windows.
  - Mitigation: use React-generated stable IDs per instance and test two windows.
- ModelDropdown is widely reused.
  - Mitigation: add an optional form naming prop and update only audited video-workflow call sites; preserve minimal-variant semantics.
- Keyboard navigation can change the input value prematurely.
  - Mitigation: maintain a separate active option and commit only on Enter/pointer selection.

## Verification

- Component tests for label association and accessible names on every shared field type.
- Combo tests for role/state, Arrow Up/Down, Home/End, Enter, Escape, filtering, free text, no options, disabled state, pointer parity, and two mounted instances.
- Integration tests for Analyze and Script pages plus the MV shared consumers.
- Browser checks at 1280×720, 390×844, and 320×568; Chinese/English; keyboard only and pointer; light/dark; one and two windows.
- Before/after DOM snapshots must show named controls and listbox/option semantics. Same-viewport screenshots must show no layout shift attributable to this change.

## Rollback

Remove the optional naming props, combobox keyboard/state implementation, call-site associations, and focused tests together. Stored records and model preferences require no migration or cleanup.

