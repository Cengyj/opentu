## 1. OpenSpec

- [x] 1.1 Create proposal, design, tasks, and spec delta for `update-psd-workbench-ux-quality`.
- [ ] 1.2 Validate with `openspec validate update-psd-workbench-ux-quality --strict` when the CLI is available.

## 2. PSD Workbench Model And Services

- [x] 2.1 Add internal PSD draft/layer task status types.
- [x] 2.2 Add helpers for draft creation and immutable layer edits.
- [x] 2.3 Add helpers for per-layer task status mapping and retry target selection.
- [x] 2.4 Move PSD-ready workspace package entrypoint behind a narrow service module.

## 3. Workflow Behavior

- [x] 3.1 Stop automatic layer image task creation after analysis.
- [x] 3.2 Add explicit analyze, review, generate assets, and export states.
- [x] 3.3 Add layer rename, prompt edit, and include/exclude controls.
- [x] 3.4 Add single-layer retry and retry-all-failed actions.
- [x] 3.5 Allow partial-success workspace download and record failed layers in manifest.

## 4. UI Quality

- [x] 4.1 Add compact step rail copy for upload, analysis, review, layer generation, and export.
- [x] 4.2 Update primary and export button labels to avoid native PSD claims.
- [x] 4.3 Show per-layer status and errors directly in the layer panel.
- [x] 4.4 Improve responsive layout and text fit for the PSD workbench controls.
- [x] 4.5 Restore source image selection from the media library while preserving upload, drag, and paste paths.

## 5. Tests

- [x] 5.1 Add unit tests for draft creation, layer task mapping, retry targets, and package manifest failure metadata.
- [x] 5.2 Update component tests for review-before-generation, layer edits, retry, partial export, and export wording.
- [x] 5.3 Run the focused PSD Vitest target.
- [x] 5.4 Cover media-library source image selection in the PSD workbench component test.
