# F-18 MV Creator Browser Diagnostics

## Scope and method

- Feature: open “爆款MV生成”, select or create music, configure a creative brief, generate/edit a storyboard, generate media, restore history, and export or insert results.
- Browser surface: Codex in-app Chromium, current Vite source, light theme, Chinese UI, DPR 1, no explicit network or CPU throttling.
- Samples: one controlled observation per recorded state. These establish deterministic geometry and DOM semantics; they are not performance samples.
- No provider credential was used. There was no reachable MV record fixture, so Script/Generate runtime states and the new subject-selection button were verified through red/green component integration tests rather than fabricated browser storage.
- The directory has no Git metadata, so the exact commit and worktree cleanliness cannot be established.

## Runtime reachability

1. Open the toolbox.
2. Activate “爆款MV生成”.
3. The registered 680×700 internal tool opens and renders Analyze, Script, Generate, history, and starred navigation; Script and Generate remain disabled until a storyboard exists.
4. The Analyze page exposes music generation/reuse, creative brief, knowledge context, storyboard model, and task submission.

This confirms `built-in-manifests.tsx → registry.tsx → tools/tools/mv-creator/index.tsx → MVCreator.tsx → AnalyzePage.tsx` is reachable.

## F18-TOOL-WINDOW-RESPONSIVE-004

At desktop `1280×720`:

- WinBox: `x=300..980`, `680×700`.
- MV root: `x=300..980`, `680×652`.

After applying the browser viewport capability at `390×844` while keeping the open tool:

- WinBox: `x=300..700`, width `400`.
- MV root: `x=300..689`, width `389`.
- Only `90` CSS px of the tool is horizontally visible and `299` px extend past the viewport.
- `body clientWidth` and `scrollWidth` are both `390`, so there is no document-level horizontal recovery path.

The defect is in the outer WinBox transition and remains owned by the approved-boundary proposal `fix-tool-window-viewport-transition`. F-18 does not add a competing responsive implementation.

## F18-FORM-NAV-A11Y-005

Desktop DOM inspection found:

- All four visible creative-brief inputs have no ID, name, ARIA name, `aria-labelledby`, or associated label.
- The storyboard model form input likewise has no programmatic label; its accessible fallback is only the placeholder.
- Shared navigation exposes literal `history` and `starred`; the history back action exposes only `←`.
- The outer WinBox focus/dialog lifecycle remains owned by `improve-tool-window-accessibility`.

The shared form defect is already explicitly scoped to F-17/F-18 by `improve-video-workflow-form-accessibility` and waits for approval. The navigation localization issue is recorded separately; it is not silently added to the form or F-16 proposals.

## F18-SUBJECT-PICKER-SPEC-001 browser limitation

The active `update-video-character-asset-reuse` delta requires subject selection on the MV Script page. Before the fix, static tracing and the red DOM test proved that `ScriptPage → CharacterDescriptionList` exposed only a description textarea, while the only existing subject picker was in Generate step 3.

The fix adds an optional visible “选择主体素材” action, opens the existing media library in image/subject-first selection mode, and maps only subject name, description, and URL back to the existing character. Red/green evidence:

- Before: one file, three tests; two passed and the new subject-action test failed because no named button existed.
- After: `CharacterDescriptionList`, subject mapping, and `ScriptPage` integration; three files, six tests, all passed.

A browser Script page could not be reached without an existing MV record or provider task. No record was fabricated through browser internals. The after-state is therefore supported by the active product delta, component DOM test, integration persistence test, TypeScript, and source line evidence; a real browser Script/subject-modal flow remains an explicit test gap.

## Artifacts and limits

- `desktop-analyze.png`: reachable default Analyze page at `1280×720`.
- `mobile-analyze-390x844.png`: outer-window viewport-transition defect at `390×844`.
- `desktop-history-empty.png`: history empty state and back/toggle names.
- `metrics.json`: raw geometry and naming summary.

The browser returned JPEG-encoded screenshot bytes. They were converted to real PNG files without resizing or visual redesign. A pre-existing failed task panel is visible behind the tool in the screenshots; it is unrelated to F-18 and no conclusion is drawn from its message.
