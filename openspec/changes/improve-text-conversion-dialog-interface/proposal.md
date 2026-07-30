# Change: Improve text-conversion dialog interface

## Why

The current production Mermaid and Markdown conversion surfaces expose a dialog role but no accessible name: both `aria-label` and `aria-labelledby` are absent because the mounted `DialogContent` contains no `DialogHeading`. Each visible syntax label is a standalone `<label>` without `htmlFor`; the textarea has no `aria-label` or `aria-labelledby` and is named only by its placeholder. The initial focus correctly enters the textarea, but closing from a command result leaves no active named control. A Mermaid parse error has neither `role` nor `aria-live`, while the old preview remains underneath it.

At 390×844, the current production dialog measured `clientHeight=675`, `scrollHeight=779`, `overflow-y: visible`; the locked page body measured `scrollHeight=844`, `overflow-y: hidden`. In both valid and invalid Mermaid states, Insert was at `top=828.90625`, `bottom=868.90625`, so the 40 px action extended beyond the 844 px viewport and was not fully reachable by touch. Correcting dialog naming, input/error semantics, focus return and compact reachability changes observable interface behavior and requires approval.

## What Changes

- Give Mermaid and Markdown conversion dialogs localized visible headings that programmatically name their modal dialog roots.
- Programmatically associate each visible syntax label with its textarea; keep placeholder text as a hint rather than the only name.
- Announce the current conversion error through a narrowly scoped live error node without announcing the full preview or user input.
- Keep the existing initial focus in the textarea, preserve modal focus containment/Escape dismissal, and return focus to the connected opener or a defined stable owner control when the ephemeral opener has unmounted.
- Make the stacked compact layout internally scrollable or otherwise size it so its action is fully reachable at the supported compact viewports without unlocking/background-scrolling the canvas.
- Coordinate Insert disabled state with the separate current-result eligibility contract; do not redefine parser ownership here.
- Preserve theme variables, desktop two-column layout, visible content hierarchy, element insertion semantics, data formats and z-index ownership.
- Add component and responsive browser coverage for zh/en, light/dark, initial/success/error/loading, keyboard, focus, 320/390 widths and landscape.

## Impact

- Affected specs: new `text-conversion-dialog-interface`
- Affected code: `packages/drawnix/src/components/ttd-dialog/{ttd-dialog,ttd-dialog-input,ttd-dialog-output,ttd-dialog-panel,ttd-dialog.scss,mermaid-to-drawnix,markdown-to-drawnix}.tsx/scss`, `packages/drawnix/src/i18n.tsx`, entry focus wiring and focused tests/evidence
- Related boundaries: `stabilize-text-conversion-preview-state` owns Insert eligibility; `preserve-markdown-conversion-draft-feedback` owns Markdown draft/load copy; F-31 owns command-palette search/navigation/execute shell, while this change owns focus entry/return for the resulting conversion dialog
- Data/storage impact: none. No element, `.drawnix`, workspace, cache, backup, task, preference or migration format changes.
- Visual impact: compact overflow/action reachability and visible headings change; desktop composition and theme tokens remain.
- Rollback: revert dialog semantic/layout/focus wiring, translations and tests together. No migration/cache cleanup is required; rollback restores the verified unnamed and clipped interface.

## Evidence

- Dialog construction: `packages/drawnix/src/components/ttd-dialog/ttd-dialog.tsx:689-721` mounts both `DialogContent` instances without `DialogHeading`/`DialogDescription`; the shared primitive only populates `aria-labelledby` when a heading mounts at `packages/drawnix/src/components/dialog/dialog.tsx:137-181`.
- Input label: `packages/drawnix/src/components/ttd-dialog/ttd-dialog-panel.tsx:27-29` renders a generic label; `ttd-dialog-input.tsx:38-46` renders the textarea without an ID or accessible-name relationship.
- Error: `ttd-dialog-output.tsx:9-15` renders a generic error div without live-region semantics; `:35-40` retains the preview beneath it.
- Compact layout: `ttd-dialog.scss:90-134,169-224,322-370` stacks a 10 rem input and 400 px preview inside a capped dialog but does not give the dialog an internal vertical overflow contract.
- Production browser: existing `dist/apps/web`, loopback HTTP, in-app Chromium, DPR 1, zh-CN. Desktop 1280×720 confirmed both unnamed dialog roots, placeholder-only textarea names, initial textarea focus and enabled Insert. Invalid Mermaid input confirmed one generic error node, no role/live attribute, enabled Insert and preview opacity `0.15`. Compact 390×844 confirmed the raw geometry above for both success and failure. No insertion, file, storage, clipboard or provider action was triggered.

