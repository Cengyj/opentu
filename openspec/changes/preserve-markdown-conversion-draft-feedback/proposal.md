# Change: Preserve Markdown conversion drafts and feedback

## Why

The Markdown conversion dialog initializes a localized example and then unconditionally calls `setText(getMarkdownExample(language))` whenever the application language changes. A deterministic mounted-component diagnostic typed `# User-authored draft`, rerendered the existing dialog with the language changed from Chinese to English, and recorded that the textarea became `# Getting Started with Milkdown`; the authored draft was gone.

The same component catches a failed dynamic import with the console prefix “Failed to load mermaid library” and exposes the only localized key `dialog.error.loadMermaid`. A controlled import rejection displayed `dialog.error.loadMermaid` for the Markdown dialog and recorded the Mermaid-specific prefix. Preserving authored text and reporting the correct converter change visible language/failure behavior and require approval before implementation.

## What Changes

- Preserve user-authored Markdown input across in-place application language changes while the dialog remains open.
- Continue localizing the built-in example when the current text is still the untouched example injected by the dialog.
- Add a dedicated localized Markdown converter load-failure message in Chinese and English.
- Classify the console diagnostic as Markdown loading without logging draft contents, parser input, converted content, credentials or URLs.
- Preserve the current session-only lifetime: closing and reopening still starts from the localized example unless another approved change specifies draft persistence.
- Add focused tests for pristine and edited language switches, repeated toggles, text equal to an example, load failure, error recovery/remount and zh/en output.
- Do not add autosave, localStorage, IndexedDB, backup fields, a draft-recovery feature or a new converter.

## Impact

- Affected specs: new `markdown-conversion-draft-feedback`
- Affected code: `packages/drawnix/src/components/ttd-dialog/markdown-to-drawnix.tsx`, `packages/drawnix/src/i18n.tsx`, focused tests and F-30 evidence/documentation
- Related boundaries: preview request/insert eligibility belongs to `stabilize-text-conversion-preview-state`; dialog naming/live error semantics belong to `improve-text-conversion-dialog-interface`; application-wide locale persistence remains unchanged
- Data/storage impact: no stored draft, schema, cache key, workspace, backup, task or migration change
- Privacy impact: corrected aggregate diagnostic category only; user Markdown text and converter output remain absent from console/analytics additions
- Rollback: revert dirty/example tracking, translation keys, diagnostic label and tests together. No migration or data cleanup is required; rollback restores the verified draft-loss and mislabeled-error behavior.

## Evidence

- Source: `packages/drawnix/src/components/ttd-dialog/markdown-to-drawnix.tsx:156-165` initializes the example and replaces text on every language change.
- Source: the same file `:141-152` reports Markdown import failure as Mermaid in both console and localized UI.
- Translation ownership: `packages/drawnix/src/i18n.tsx:97-112,289-304,478-493` contains Mermaid title/error keys and Markdown description/input/preview/insert keys, but no Markdown title or load-error key.
- Component diagnostic environment: Node `v24.14.0`, Vitest `3.2.4`, jsdom and controlled language/import mocks; no real storage, network, clipboard or user draft. Corrected diagnostic run: exit 0, 3/3 files and 4/4 tests; the relevant tests took 491 ms and 440 ms, total report 2.19 s. Temporary files were deleted.

