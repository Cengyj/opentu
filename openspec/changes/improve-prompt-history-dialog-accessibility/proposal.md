# Change: Improve Prompt History Dialog Accessibility

## Why

The prompt history tool renders its create/edit surface as a fixed overlay containing a `<form>`, but the surface has no dialog role, accessible modal state, or programmatic label. Opening it leaves focus on the background "新建提示词" or row action button. Escape does not close it, and background controls remain in the accessibility tree.

A controlled browser sample at 1280×720 and 390×844 confirmed the same behavior: before and after Escape, `document.activeElement` was the background `aria-label="新建提示词"` button, the form remained mounted, and both `[role="dialog"]` and `[aria-modal="true"]` counts were zero. Correcting keyboard and screen-reader behavior is user-observable, so implementation requires approval.

## What Changes

- Give the create/edit surface dialog semantics, an accessible title, and modal state.
- Move initial focus into the dialog, keep keyboard focus within the open dialog, close it on Escape, and restore focus to the invoker after close.
- Preserve pointer dismissal, Cancel/Save behavior, validation, field values, prompt storage, filtering, task history, analytics, and visual layout.
- Respect existing reduced-motion behavior; this change does not add animation.

## Impact

- Affected specs: `prompt-history`
- Affected code: `packages/drawnix/src/components/prompt-history/PromptHistoryTool.tsx`, focused component tests, and F-14 browser evidence
- Preserved data/API semantics: no prompt/task schema, IndexedDB write, backup format, archive, filter, provider, cache, generation, or analytics payload change
- User-visible trade-off: while the dialog is open, Tab/Shift+Tab remain inside it and Escape closes it; keyboard focus no longer remains on or advances through obscured background controls

## Evidence

- `packages/drawnix/src/components/prompt-history/PromptHistoryTool.tsx:973-1106` renders the overlay as `role="presentation"` and the content as an unlabeled form without dialog/modal semantics or keyboard handling.
- `packages/drawnix/src/components/prompt-history/PromptHistoryTool.tsx:506-543` opens the dialog by setting React state without moving focus.
- `packages/drawnix/src/components/prompt-history/PromptHistoryTool.tsx:545-547` closes it by clearing state without an explicit focus restoration contract.
- Manual in-app Chromium sample, local source on `http://127.0.0.1:7200/`, 1280×720: open create dialog → active element remains the background `新建提示词` button; press Escape → form count remains 1; dialog-role and aria-modal counts remain 0.
- The 390×844 screenshot shows that the visible layout fits the viewport, so the proposed scope is accessibility behavior rather than a visual redesign: `docs/evidence/f14-prompt-history/mobile-create-dialog-390x844.jpg`.

