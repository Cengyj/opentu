# F-30 Mermaid/Markdown conversion diagnostics

Date: 2026-07-30 (Asia/Shanghai)

Status: fact modeling complete; runtime implementation blocked on three independent OpenSpec approvals.

## Scope and user intent

The user opens Mermaid or Markdown conversion from the creation toolbar, more-tools surface, or command palette; edits text; observes loading/preview/failure; inserts the current result into the current board; and expects normal board history/autosave. This loop owns those two converter dialogs and their insertion handoff. It does not own ordinary shape/text creation (F-05), command-palette search/navigation (F-31), AI generation dialogs (F-08), workspace backup/recovery (F-03), or new diagram types.

Applicable states: initial example, converter loading, parse pending, success, empty result, failure, correction/retry-by-edit, keyboard submit, pointer submit, close/cancel, reload after a successful board insertion, compact layout and zh/en. No existing UI exposes a persisted draft, explicit parse cancellation, offline retry or separate recovery action; those are not inferred as requirements.

## Current forward chain

1. Reachable entry:
   - creation toolbar metadata and handler: `packages/drawnix/src/components/toolbar/creation-toolbar.tsx:211-221,557-560`;
   - more-tools metadata and handler: `packages/drawnix/src/components/toolbar/more-tools-button.tsx:83-103,424-428`;
   - command targets: `packages/drawnix/src/components/command-palette/command-registry.ts:393-406`.
2. `useDrawnix.openDialog` adds `DialogType.mermaidToDrawnix` or `markdownToDrawnix` to the `openDialogTypes` Set using a functional state update: `packages/drawnix/src/hooks/use-drawnix.tsx:15-20,84-134`.
3. `TTDDialogComponent` projects the Set to controlled Floating UI dialogs and lazily mounts the converter component: `packages/drawnix/src/components/ttd-dialog/ttd-dialog.tsx:45-46,51-60,689-721`.
4. Textarea input is a controlled string. `onChange` calls `setText`; both converters trim it through `useDeferredValue`: Mermaid `mermaid-to-drawnix.tsx:64-90,213-221`, Markdown `markdown-to-drawnix.tsx:156-190,242-250`.
5. Each component dynamically imports its conversion package. Mermaid input/output is `string -> Promise<{elements: PlaitElement[]}>`; Markdown is `string -> MindElement` after the package Promise resolves: Mermaid `:23-33,41-63`, Markdown `:21-33,132-155`.
6. The conversion effect owns `value: PlaitElement[]` and `error: Error | null`. `TTDDialogOutput` always mounts a readonly Plait `Wrapper/Board`, overlays the error if present, and fades the retained preview to opacity `0.15`: `ttd-dialog-output.tsx:8-51`.
7. Button and Ctrl/Cmd+Enter both call the converter's `insertToBoard`; the shortcut listener is `ttd-dialog-input.tsx:21-42`. The function deep-clones retained `value`, selects the existing smart or type-specific default point, calls `board.insertFragment(..., paste)`, schedules viewport reveal, and closes the dialog: Mermaid `:92-145,213-237`; Markdown `:192-234,242-266`.
8. The Plait board operation triggers React Board after-change. `Wrapper` forms `BoardChangeData` and calls the App callback at `packages/react-board/src/wrapper.tsx:87-97,191-193`. `App.handleBoardChange` updates local state and calls `WorkspaceService.saveCurrentBoard` at `apps/web/src/app/app.tsx:721-769`. The service updates elements/viewport/theme, writes through `workspaceStorageService.saveBoard`, and emits `boardUpdated` at `packages/drawnix/src/services/workspace-service.ts:951-989`.
9. Final UI is the normal canvas rendering of inserted elements; history/undo and reload persistence remain the Plait/workspace owners. F-30 adds no network request, task, cache key, analytics event or draft storage.

## Reverse trace

- A converted diagram visible on the canvas can be written by both F-30 `insertToBoard` functions through `board.insertFragment`; each is called only from its panel button or controlled textarea shortcut in these components.
- A conversion-dialog preview is written only by the corresponding conversion effect's `setValue` in Mermaid `:82-84` or Markdown `:179-183`. Error is written by dynamic-import and conversion catches.
- The two `DialogType` values are opened by the three entry families above and consumed by the two controlled dialogs. Current registry coverage found no fourth UI entry.
- Successful insertion is cloned and durable through normal board history/autosave. Pending/error/cancel paths have no dedicated persistence record. Refresh while the dialog is open therefore has no specified draft recovery, and no current evidence justifies adding one.

## State, defaults, side effects, and invariants

- State owner: component-local React state for converter module, `text`, deferred trimmed input, `value`, and `error`; application context only owns whether the dialog is open.
- Defaults: one fixed Mermaid example; one locale-specific Markdown example; no saved user default.
- Transformations: input is trimmed; after the first parser rejection both components retry once after replacing every double quote with a single quote. Markdown resets the returned mind-map root point to `[[0,0]]`.
- Concurrency: Mermaid parser completions can settle out of order. No request token, abort signal, converter generation, mounted guard or result/input identity exists.
- Side effects: dynamic import, console error on import failure, board insertion/history, viewport reveal and dialog close. Successful board changes enter workspace persistence; preview changes do not.
- Privacy: current conversion components add no analytics. The Markdown import catch logs the caught error but does not add input/output content. This audit used no real board, storage, network, clipboard or provider request.
- Invariants to preserve: supported syntax/packages, quote fallback unless independently approved, type-specific insertion geometry, deep cloning, Plait paste/history, viewport reveal, dialog close after successful insertion, serialized formats and existing autosave.

## Evidence environment

- Component diagnostics: fixed Node `/Users/macos/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node` reporting v24.14.0; Vitest 3.2.4; jsdom; React Testing Library; `packages/drawnix/vite.config.ts`; controlled parser/import/language/board mocks.
- Browser: existing `dist/apps/web`; loopback HTTP; in-app Chromium; zh-CN; DPR 1; desktop 1280×720 and temporary compact 390×844; viewport reset afterward. Tabs and local server were closed.
- Safety: no Insert action was activated in the production browser. No paid/provider task, file picker, download, storage, clipboard, real network mutation or user board was used.
- Screenshot evidence: `mermaid-desktop-success-before.jpg`, `markdown-desktop-success-before.jpg`, `mermaid-desktop-error-before.jpg`, and `mermaid-compact-success-before.jpg` in this directory.
- Raw values and command outcomes: `metrics.json`.

## Confirmed findings

### [CONVERSION-FRESHNESS-001]

Status: confirmed fact.

User impact: after rapid Mermaid edits, an older slow conversion can replace the preview for the newer text. The user can then read or insert a result that no longer corresponds to the current input.

Reproduction: mount the real Mermaid component with a controlled parser; complete the initial parse; change input to `older request`, then `newer request`; resolve `newer request` with element `newer-result`; resolve `older request` with `older-result`. The preview changes from `newer-result` to `older-result`; parser call order remains older then newer.

Current versus expected: current behavior commits every completion. Expected behavior is that only the current normalized input may own preview/error/insertion state.

Evidence and strength: deterministic mounted-component result plus the missing ownership guard at `mermaid-to-drawnix.tsx:70-90`; high confidence. The first diagnostic run did not reach this path because the test mock omitted two platform constants; the corrected run passed 4/4 diagnostics. That fixture failure is not a product failure.

Call chain: textarea `onChange` -> `setText` -> `useDeferredValue(text.trim())` -> conversion effect -> `parseMermaidToDrawnix` Promise -> unconditional `setValue(elements)` -> readonly preview -> potential Insert.

Root cause: conversion state contains no request token, input identity, converter generation or stale-completion check.

Impact range: current Mermaid dialog. Markdown shares the same state shape at the lazy-module boundary, but an out-of-order Markdown parser result was not reproduced and is not claimed.

Candidate and alternative: approval-only `stabilize-text-conversion-preview-state` adds current-input identity and ignores obsolete completion. Serializing requests was rejected because it delays current input; clearing the preview alone does not stop a late completion.

Risk, verification, rollback: test obsolete success/failure, fallback, Strict Mode/remount and unmount; compare exact preview IDs. Roll back the request identity and tests together; no data recovery is required.

### [CONVERSION-INSERT-002]

Status: confirmed fact.

User impact: after a successful preview, editing to a still-pending or invalid definition leaves the previous preview insertable. Activation inserts stale elements, closes the dialog and sends the mutation to history/autosave.

Reproduction: component diagnostic completed `preview-from-previous-input`, changed to `current input still pending`, kept the new Promise pending and clicked Insert. `insertFragment` received the previous ID once and `closeDialog('mermaidToDrawnix')` ran. Production reproduction changed the current build to invalid `flowchart TD\nA -->`; it showed a parse error, old preview opacity `0.15`, and enabled Insert. Production Insert was not activated.

Current versus expected: current mutation guard checks only `value.length`. Expected behavior is no button/keyboard insertion and no close unless a non-empty result belongs to the current input.

Evidence and strength: deterministic mutation/close capture, current production DOM/style, and source at Mermaid `:92-145,213-237`, Markdown `:192-234,242-266`, shortcut `ttd-dialog-input.tsx:24-42`; high confidence.

Call chain: new text -> current parse pending/fails -> previous `value` retained -> panel button or Ctrl/Cmd+Enter -> `insertToBoard` -> deep clone -> `board.insertFragment` -> Plait after-change -> App save -> workspace storage -> dialog close.

Root cause: preview data is not tagged with its source input, and the button/shortcut/mutation function share no current-result eligibility predicate. Error and pending state are not passed to `panelActionDisabled`.

Impact range: both conversion dialogs retain `value` and use the same length-only mutation guard; the controlled mutation was reproduced on Mermaid.

Candidate and alternative: approval-only preview-state change gates all three activation boundaries. Removing the shortcut or hiding the preview would not correct pointer/programmatic activation.

Risk, verification, rollback: verify loading/pending/error/empty/valid for button and shortcut, board operation count, exact inserted ID, close count and autosave adjacency. Rollback is code/test-only; already inserted elements remain normal user content.

### [MARKDOWN-DRAFT-003]

Status: confirmed fact.

User impact: changing the application language while the Markdown converter remains open discards the user's draft and replaces it with the other built-in example.

Reproduction: mount the real Markdown component in zh, type `# User-authored draft`, rerender the same mounted component with language en. The textarea becomes `# Getting Started with Milkdown` and no longer contains the draft.

Current versus expected: `markdown-to-drawnix.tsx:162-165` unconditionally replaces text on language change. Expected behavior is to localize only an untouched injected example while preserving authored input.

Evidence and strength: deterministic mounted-component result and direct setter; high confidence.

Call chain: application i18n state -> `useI18n().language` -> language effect -> `setText(getMarkdownExample(language))` -> deferred parse -> preview replacement.

Root cause: no distinction between an injected pristine example and explicit user editing.

Impact range: mounted Markdown conversion sessions during zh/en change. Close/reopen still has session-only state; no persistence expectation is inferred.

Candidate and alternative: approval-only `preserve-markdown-conversion-draft-feedback` tracks last injected example plus explicit edit state. Removing the language effect preserves drafts but strands untouched examples in the old language.

Risk, verification, rollback: test pristine, edited, repeated toggles, edited text equal to example and close/reopen. Revert dirty/example state and tests; no stored data exists.

### [MARKDOWN-LOAD-FEEDBACK-004]

Status: confirmed fact.

User impact: if the Markdown converter chunk fails, the dialog and console identify the failure as Mermaid, directing recovery/diagnostics at the wrong dependency.

Reproduction: controlled rejection of `@plait-board/markdown-to-drawnix` while mounting the real component. Output error text was `dialog.error.loadMermaid`; first console argument was `Failed to load mermaid library:`.

Current versus expected: Markdown catch at `markdown-to-drawnix.tsx:141-152` reuses Mermaid copy. Expected behavior is localized Markdown-specific feedback without logging user input/output.

Evidence and strength: deterministic import-rejection component result plus the only i18n key at `i18n.tsx:112,304,493`; high confidence.

Call chain: dialog mount -> dynamic import -> rejection -> console diagnostic + `setError` -> error overlay.

Root cause: copied Mermaid diagnostic/key and no Markdown load-error translation contract.

Impact range: Markdown converter chunk-load failure in both locales.

Candidate and alternative: dedicated typed zh/en Markdown key and diagnostic category under the draft/feedback change. A generic “converter failed” key was not selected because the failing reachable tool is known and specific.

Risk, verification, rollback: controlled zh/en import rejection, exact UI/console label and no-content assertion. Roll back key/catch/tests together.

### [CONVERSION-DIALOG-A11Y-005]

Status: measured runtime result.

User impact: screen-reader users encounter an unnamed modal; the visible syntax label is not programmatically associated with the textarea; parse failure is not live-announced; closing from the command-result path leaves no named active control.

Reproduction: open each converter from the production command path at 1280×720. For both dialog roots `aria-label=null` and `aria-labelledby=null`. For both textareas `aria-label=null` and `aria-labelledby=null`; their placeholder is exposed as the current name. Initial focus is the textarea. The Mermaid error node has `role=null`, `aria-live=null`. Escape closes the dialog, after which the accessibility snapshot marks no control active.

Current versus expected: the shared primitive supplies a dialog role/focus containment but F-30 mounts no `DialogHeading`/trigger; panels render `<label>` without `htmlFor`; error is generic. Expected behavior is localized named modal/input/error and deterministic focus return.

Evidence and strength: production DOM/focus plus source at `ttd-dialog.tsx:689-721`, `dialog.tsx:137-203`, `ttd-dialog-panel.tsx:30-36`, `ttd-dialog-input.tsx:44-52`, `ttd-dialog-output.tsx:8-16`; high confidence.

Call chain: ephemeral/persistent entry -> open Set -> controlled Dialog without reference/heading -> FloatingFocusManager -> autoFocus textarea -> generic error -> controlled close -> entry already unmounted/no reference -> focus has no named owner.

Root cause: F-30 does not use the heading/description/reference contracts provided by the dialog primitive, and shared panel/input/output do not exchange label/live-state IDs.

Impact range: both F-30 dialogs; error announcement applies their shared output. F-31 retains ownership of palette search/navigation rather than this result dialog.

Candidate and alternative: approval-only `improve-text-conversion-dialog-interface` uses visible headings, native label association, a narrow live error, and connected opener/fallback focus. Standalone `aria-label` and whole-dialog `aria-live` were rejected because they drift from visible text or announce too much.

Risk, verification, rollback: component and production checks for one named modal, label/name equality, focus trap/Escape/return for all three entry families, one error announcement and no input/preview live region. Revert semantic/focus wiring and tests; no data effect.

### [CONVERSION-DIALOG-COMPACT-006]

Status: measured runtime result.

User impact: on a 390×844 compact viewport, the complete Insert action is below the visible/scrollable modal region in both valid and invalid Mermaid states. A touch user cannot see the whole action and the locked body provides no recovery scroll.

Reproduction: set the in-app Chromium viewport to 390×844, open Mermaid conversion, observe both invalid and corrected valid input. Raw values in both states: dialog top `97.90625`, bottom `773.09375`, height `675.1875`, clientHeight `675`, scrollHeight `779`, overflowY `visible`; body clientHeight/scrollHeight `844/844`, overflowY `hidden`; Insert top `828.90625`, bottom `868.90625`, height `40`.

Current versus expected: child content overflows a capped modal into a scroll-locked body. Expected behavior is that the complete action is reachable inside the modal while background scroll remains locked.

Evidence and strength: same-build screenshot plus DOM geometry and source CSS at `ttd-dialog.scss:90-134,169-224,322-370`; high confidence for 390×844. Other compact viewports remain unmeasured.

Call chain: viewport <=480 -> max-height/margin rules -> stacked panels -> fixed 10 rem input + 400 px preview + headers/action -> child overflow beyond dialog -> overlay body scroll lock -> clipped action.

Root cause: compact max-height is not paired with modal-owned vertical overflow or viewport-relative panel sizing.

Impact range: F-30 stacked conversion layout at the measured viewport; both valid/error states. Markdown uses the same panels/styles, but compact Markdown geometry was not separately measured and remains to be verified.

Candidate and alternative: approval-only interface change adds scoped internal scroll or bounded sizing. Unlocking body scroll and indiscriminately shrinking previews were rejected because they break modal/background behavior or do not handle short landscape/error text robustly.

Risk, verification, rollback: measure 320×568, 375×667, 390×844, 640×360, tablet/desktop; assert complete button reachability, modal scroll, locked body, focus and same-state screenshots. Revert scoped CSS/tests; no data effect.

## Hypotheses and unknowns retained without runtime change

- The Markdown placeholder parser returns `null`, while the effect writes `mind.points` before checking `mind` at `markdown-to-drawnix.tsx:132-139,179-184`. A transient initial caught error is statically reachable, but no visible flash was reproduced in the current production build. Validate with a deliberately delayed module load before classifying.
- `TTDDialogOutput.loaded` is accepted but unused. A blank/empty preview may appear during slow chunk loading, but no throttled-network measurement exists and no loading UX requirement is inferred.
- The quote-replacement fallback changes every double quote after any first parse error. No fixture has established content corruption or a required alternative; do not change it without parser-specific evidence.
- No five-sample parse/render/commit measurement was collected, so there is no F-30 performance-bottleneck or improvement claim. Candidate metrics are input-to-preview latency, parser CPU/long tasks, React commits and preview memory under fixed examples.
- Dark theme, English layout, 320/375 widths, tablet, landscape, high-DPI, reduced-motion, offline cache and successful insert/reload were not fully exercised in this loop. They remain verification tasks, not inferred failures.

## OpenSpec gate and conflict matrix

| Change | Capability | Confirmed owner | Neighbor/non-overlap | Approval state |
| --- | --- | --- | --- | --- |
| `stabilize-text-conversion-preview-state` | `text-conversion-preview-consistency` | sole active owner | F-05 owns base creation; F-31 owns palette shell; no schema/cache/parser package change | waiting for explicit approval |
| `preserve-markdown-conversion-draft-feedback` | `markdown-conversion-draft-feedback` | sole active owner | preview freshness and interface semantics stay in their separate F-30 changes; locale persistence unchanged | waiting for explicit approval |
| `improve-text-conversion-dialog-interface` | `text-conversion-dialog-interface` | sole active owner | F-28 retains cross-feature evidence; F-31 retains palette search/navigation; shared dialog defaults unchanged unless opt-in proven | waiting for explicit approval |

Manual validation found 3/11, 2/7 and 4/11 requirement/scenario counts respectively; all nine requirement names occur exactly once across formal/active specs; each capability has one active owner. OpenSpec CLI remains unavailable, so no CLI validation is claimed.

## Test and browser outcomes

- Initial diagnostic command: exit 1, 3/3 files and 4/4 tests failed before product-path collection because the test's full `@plait/core` mock omitted `IS_IOS`/`IS_APPLE`. Classified as diagnostic fixture failure.
- Corrected diagnostic command: exit 0, 3/3 files, 4/4 tests; test durations 440, 491, 656 and 140 ms; total 2.19 s. Temporary diagnostics were deleted.
- Production browser: desktop Mermaid success, Markdown success and Mermaid error inspected; compact Mermaid success/error measured. No production mutation was performed. Viewport reset, tabs closed, local server stopped.
- Permanent focused conversion tests found: zero. No runtime/permanent test/CSS/i18n/parser/storage change was made before approval.

## Rollback and exit status

There is no Git metadata, so rollback is patch-based: delete the three new change directories and this F-30 evidence, reverse the F-30 ledger/F-28/activity-matrix edits, and delete the generated screenshots. There is no migration, cache or user-data recovery.

F-30 has completed fact modeling but has not met the feature exit standard: three runtime/interface corrections require approval, successful insert/history/reload and the full state/locale/theme/viewport matrix are not yet verified, and no performance conclusion is claimed. F-31 command-palette shell can proceed independently while F-30 remains approval-blocked.
