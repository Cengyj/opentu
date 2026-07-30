# Change: Make Comic Creator Controls Responsive And Accessible

## Why

The comic creator runs inside a freely resizable tool window, but its compact layout is selected only by the browser viewport media query. In an in-app Chromium sample at a `1280×844` viewport with the tool window resized to `400×760`, the model input occupied `x=673..833` while the comic content ended at `x=680`; 153 CSS px extended outside the content boundary and the visible trigger collapsed to an icon fragment.

The same runtime inspection found that the story textarea, form model input, and history status select had no associated label or localized ARIA name. Shared history and favorite buttons exposed `history` and `starred`, and the history back action exposed only `←`. These controls remain pointer-reachable but are not reliably identifiable to screen-reader users.

Container-responsive layout and localized accessible names are user-observable, so implementation requires approval.

## What Changes

- Make the existing compact comic layout respond to the comic tool's own inline size, including the 400 px resizable-window case, instead of relying only on browser viewport width.
- Keep the prompt-mode controls and text-model selector inside the tool content with readable selected-model text at supported widths.
- Associate the story, model, history query/status, and other audited visible comic labels with their native or composite controls.
- Give shared workflow navigation actions caller-supplied localized accessible names while preserving their visible icons, counts, callbacks, and layout.
- Preserve prompt values, model selection/routing, task execution, generation concurrency, storage, exports, history filtering, outer WinBox geometry, and pointer behavior.

## Impact

- Affected specs: `comic-generation-workflow`
- Affected code: comic creator markup/styles, optional shared workflow navigation/model naming props, focused component/browser tests
- Dependency: `add-comic-strip-generator` defines the active base capability and should be archived or co-approved before this delta is merged.
- Related changes:
  - `fix-tool-window-viewport-transition` owns the outer window rectangle across viewport transitions, not content adaptation inside a manually narrowed desktop window.
  - `improve-tool-window-accessibility` owns the outer dialog/title bar/focus/Escape contract, not comic form fields.
  - `improve-video-workflow-form-accessibility` owns shared video/MV forms and optional form-model naming; implementation should reuse a compatible optional naming prop rather than add a competing contract.
- Preserved data/API semantics: no record/task/cache/provider/schema/migration changes

## Evidence

- Browser environment: in-app Chromium, light theme, DPR 1, viewport `1280×844`, comic WinBox `400×760`.
- Raw geometry: comic root `x=280..680`; model input `x=673..833`; horizontal overflow beyond the content boundary was 153 CSS px.
- Screenshots: `docs/evidence/f16-comic-creator/desktop-plan.png`, `narrow-window-plan-400.png`, `narrow-window-history-empty-400.png`, and `mobile-plan-390x844.png`.
- `packages/drawnix/src/components/comic-creator/ComicCreator.scss:990-1055` defines compact rules only under `@media (max-width: 640px)`.
- `packages/drawnix/src/components/comic-creator/ComicCreator.scss:310-336` keeps a two-column plan row and up-to-520 px form model field outside that viewport breakpoint.
- `packages/drawnix/src/components/comic-creator/ComicCreator.tsx:2398-2465` renders a visible creative-demand context and model row without programmatic names for the story textarea or composite model input.
- `packages/drawnix/src/components/comic-creator/ComicCreator.tsx:2987-3007` renders history query/status controls without an associated status label.
- `packages/drawnix/src/components/shared/workflow/WorkflowNavBar.tsx:32-79` uses `←`, `history`, and `starred` as accessible names.
- The window remained focused on `BODY`; that outer focus defect is already scoped to `improve-tool-window-accessibility` and is not duplicated here.

