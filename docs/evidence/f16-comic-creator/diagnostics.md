# F-16 Comic Creator Browser Diagnostics

## Scope and method

- Feature: a user opens “多图生成”, prepares a multi-page prompt plan, views history, and later generates or exports available page images.
- Browser surface: Codex in-app Chromium, light theme, Chinese UI, DPR 1, no explicit network or CPU throttling.
- Samples: one controlled observation per recorded state. These observations establish deterministic geometry and DOM semantics; they are not performance samples.
- Source limitation: this directory has no Git metadata, so the exact commit and worktree cleanliness cannot be established.
- Full raw geometry and DOM attributes are in `metrics.json`.

## Reproduction: F16-NARROW-CONTROL-004

1. Open “多图生成” in a desktop viewport of `1280×844`.
2. Resize its WinBox to `400×760` while leaving the browser viewport unchanged.
3. Stay on the planning step and inspect the comic root and the text-model input rectangles.

Observed:

- Comic root: `x=280..680`, width `400` CSS px.
- Text-model input: `x=673..833`, width `160` CSS px.
- The input extends `153` CSS px beyond the comic root's right edge.
- Document and comic root horizontal overflow both reported `0`, so no horizontal scrollbar exposes the displaced control.
- Screenshot: `narrow-window-plan-400.png`.

Expected: every primary planning control remains within the tool content boundary at the existing compact-layout threshold, while preserving the selected model identity and values.

Evidence classification: confirmed runtime UX/layout defect. The current SCSS activates its compact layout from browser viewport width, while the tool can be narrowed independently. Implementation is gated by `improve-comic-creator-responsive-accessibility`.

## Reproduction: F16-FORM-A11Y-005

1. In the same planning state, inspect the story textarea, text-model composite input, and shared navigation buttons.
2. Open history and inspect the query input, native status select, and back action.

Observed:

- Story textarea: no `id`, `name`, `aria-label`, `aria-labelledby`, or associated label.
- Text-model input: no useful ID/name/ARIA association; its labels collection contained one empty label.
- History query input: only a placeholder; no ID/name/ARIA or associated label.
- History status select: no ID/name/ARIA or associated label.
- Shared navigation exposes the literal English tokens `history` and `starred`; the history back button exposes only `←`.
- The scenario select and page-count input do have programmatic labels, so they are recorded as non-problems.
- Outer tool focus remained on `BODY`; that separate defect is owned by `improve-tool-window-accessibility` and is not duplicated in F-16.

Expected: each visible field and icon-only navigation action exposes one stable localized accessible name without including prompts, task IDs, credentials, cached media, or full records.

Evidence classification: confirmed runtime accessibility defect. Implementation is gated by `improve-comic-creator-responsive-accessibility`; any form-model naming prop must be compatible with `improve-video-workflow-form-accessibility`.

## History empty state and mobile boundary

- At the 400 px tool width, the history query, status filter, and “暂无记录” empty state remain visually contained; screenshot: `narrow-window-history-empty-400.png`.
- The `390×844` screenshot records the existing outer-window viewport-transition behavior. Outer WinBox geometry is not owned by F-16 and remains scoped to `fix-tool-window-viewport-transition`.
- Dark theme, exact 640/720 px geometry, long English values, complete Tab/Enter/Escape behavior, screen-reader announcements, touch targets, and reduced-motion behavior remain unverified until the accessibility proposal is approved and implemented.

## Evidence artifacts

- `desktop-plan.png`: default desktop planning reference, `1280×720`.
- `narrow-window-plan-400.png`: confirmed model-control displacement, `1280×844` viewport and 400 px tool width.
- `mobile-plan-390x844.png`: outer-window mobile boundary, `390×844`.
- `narrow-window-history-empty-400.png`: history empty state at 400 px tool width.
- `metrics.json`: raw rectangles, DOM naming attributes, environment, and claim limits.

The four files initially contained JPEG bytes under `.png` names. They were converted losslessly in dimensions to actual PNG format; no resize or visual redesign was applied.
