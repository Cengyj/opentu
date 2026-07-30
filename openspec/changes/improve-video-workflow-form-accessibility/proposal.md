# Change: Make Video Workflow Forms Programmatically Named and Keyboard Operable

## Why

The video analyzer renders visible text labels for its creative brief and video parameters, but those labels are not associated with the underlying inputs. In a controlled browser sample, all 10 rendered input/textarea/select elements had no `id`, `name`, `aria-label`, `aria-labelledby`, or associated `<label>`. The number and native select fields also had no placeholder fallback.

The shared `ComboInput` opens a preset menu on focus, but the input has no combobox role, expanded state, or controlled-list reference. Its option elements have no option role or tab stop and implement pointer `onMouseDown` only. In the browser sample, focusing the empty “导演风格” field and pressing ArrowDown then Enter left the value empty; Escape left all 30 options open.

These primitives are shared by the video analyzer and MV workflow. Adding names, roles, focus, and keyboard behavior changes user-observable interaction behavior, so implementation requires approval.

## What Changes

- Associate every visible video-workflow field label with its input, textarea, model selector, or native select using stable IDs/labels or equivalent programmatic naming.
- Give `ComboInput` the standard editable combobox/listbox/option contract, including expanded/controls/active-descendant state and Arrow/Enter/Escape behavior equivalent to pointer selection.
- Give form-variant model dropdown triggers a stable accessible name supplied by their visible field label without changing model discovery or selection.
- Preserve visible labels, layout, presets, free-text entry, stored values, prompt construction, task submission, and pointer behavior.
- Cover both current consumers of the shared video workflow primitives so the accessibility contract does not diverge between F-17 and F-18.

## Impact

- Affected specs: new `video-workflow-form-accessibility`
- Affected code: shared `ComboInput`, `CreativeBriefEditor`, `VideoParametersRow`, form-variant `ModelDropdown` naming props, video analyzer/MV page call sites, focused tests
- Related change: `improve-tool-window-accessibility` covers only the outer WinBox dialog, title-bar controls, focus lifecycle, and launcher menu; it does not cover tool-content form controls
- Preserved data/API semantics: no prompt, task, provider, record, cache, model preference, or analytics schema changes
- User-visible trade-off: keyboard users can select existing presets and close their menu with standard keys; visuals and pointer results remain equivalent

## Evidence

- Runtime measurements and screenshots: `docs/evidence/f17-video-analyzer/metrics.json` and the three PNG files in that directory.
- `packages/drawnix/src/components/shared/workflow/CreativeBriefEditor.tsx:61-145` renders sibling text labels and form controls without `for`/ID association.
- `packages/drawnix/src/components/shared/workflow/VideoParametersRow.tsx:61-105` renders model, number, and select labels without programmatic association.
- `packages/drawnix/src/components/shared/workflow/ComboInput.tsx:21-27,170-219` exposes no naming/combobox props and implements options with pointer-only generic elements.
- `packages/drawnix/src/components/ai-input-bar/ModelDropdown.tsx:163-196,933-940` has a form placeholder but no caller-supplied accessible-name contract.
- Browser sample at 1280×720, DPR 1: 10/10 controls lacked ID/name/ARIA/associated labels; the window focus remained on `BODY` (outer focus is tracked by the separate tool-window change).
- Keyboard sample: ArrowDown + Enter selected no director style; Escape did not close the open 30-option menu; input role/expanded/controls and option role/tabindex were all null.

