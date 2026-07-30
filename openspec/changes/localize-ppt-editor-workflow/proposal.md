# Change: Localize PPT Editor Workflow

## Why

`FramePanel` reads the active `zh`/`en` language, but most reachable PPT search, toolbar, outline, status, confirmation, empty-state, slideshow, and add-dialog copy is hard-coded Chinese. `AddFrameDialog` and `FrameSlideshow` do not consume language state. Consequently, English mode still emits Chinese UI strings along this existing workflow.

Changing visible copy and newly created default page names is user-observable and requires approval.

## What Changes

- Move existing PPT editor, outline generation, add dialog, slideshow, status, confirmation, error, tooltip, and empty-state copy into the project's existing Chinese/English localization boundary.
- Localize new default PPT page names while preserving every existing stored custom/default name exactly as saved.
- Keep user-authored titles/prompts, provider errors, model names, filenames, board data, task data, and cache entries unchanged.
- Add focused Chinese/English render and behavior tests, including long English labels and responsive overflow checks.
- Do not introduce another i18n library or add any product action.

## Impact

- Affected specs: `ppt-editing`, `ppt-outline-generation` behavior presentation only through the `ppt-editing` delta
- Affected code: `FramePanel.tsx`, `AddFrameDialog.tsx`, `FrameSlideshow.tsx`, current Drawnix i18n catalog/helpers, focused tests
- Data/migration impact: no migration; existing stored page names remain byte-for-byte unchanged, while newly created default names follow active language
- Rollback: restore inline copy/default-name generation and remove keys/tests; existing decks require no rewrite

## Evidence

- `packages/drawnix/src/components/project-drawer/FramePanel.tsx:1081` reads `language`, but examples at `:1760-1800`, `:1883-1942`, `:3498-3536`, and `:3557-4170` remain Chinese except for isolated model/history branches.
- `packages/drawnix/src/components/project-drawer/AddFrameDialog.tsx:145-234` hard-codes dialog, custom-size, action, and shortcut copy and has no language input/context.
- `packages/drawnix/src/components/project-drawer/FrameSlideshow.tsx:760-939` hard-codes exit guidance, tooltips, and navigation copy and has no language input/context.
- Static control-flow proof is sufficient to show those literal branches are rendered independent of `language`; an English runtime screenshot remains pending because the current controlled board state/viewport did not provide a reliable full workflow capture.

## Approval

Implementation is blocked until the user approves the Chinese/English copy boundary and active-language naming for newly created default PPT pages.
