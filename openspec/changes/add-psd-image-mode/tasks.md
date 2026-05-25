## 1. OpenSpec
- [x] 1.1 Create proposal, design, tasks, and spec delta for `add-psd-image-mode`.
- [x] 1.2 Validate `add-psd-image-mode` with `openspec validate add-psd-image-mode --strict` and fix all issues.

## 2. Dialog Mode Integration
- [x] 2.1 Extend the AI image window mode union to include `psd` with safe localStorage normalization.
- [x] 2.2 Add PSD header tab/title wiring without creating a new top-level dialog.
- [x] 2.3 Route PSD mode to the lazy-loaded `ai-psd-generation` component and pass image model selection props.

## 3. PSD UI Component
- [x] 3.1 Add `ai-psd-generation.tsx` reusing image-generation controls and shared components.
- [x] 3.2 Add `ai-psd-generation.scss` for the two-pane PSD prompt/layer-plan layout.
- [x] 3.3 Display a right-side PSD layer plan / preview panel.

## 4. Compatibility And Verification
- [x] 4.1 Keep first-version PSD work on `TaskType.IMAGE` / existing image asset flows; do not add PSD task or asset enums.
- [x] 4.2 If `ActionButtons` needs new labels or quantity visibility, add only backward-compatible optional props.
- [x] 4.3 Run focused lint, tests, typecheck, and mode wiring checks for single/batch/psd mode switching.
