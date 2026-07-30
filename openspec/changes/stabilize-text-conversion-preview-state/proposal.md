# Change: Stabilize text-conversion preview state

## Why

The reachable Mermaid conversion dialog parses deferred input asynchronously but does not associate a parse completion with the input that started it. A deterministic component diagnostic started `older request`, then `newer request`, resolved the newer parse first, and finally resolved the older parse. The preview first showed `newer-result` and was then overwritten by `older-result`. A second diagnostic completed the initial preview, changed the input while its new parse remained pending, and activated Insert. The dialog inserted `preview-from-previous-input` and closed even though that preview did not represent the current text.

The production build confirms the same insertion eligibility boundary: after invalid Mermaid input displayed a parse error and faded the previous preview to opacity `0.15`, the Insert button remained enabled. Both the button and Ctrl/Cmd+Enter call `insertToBoard`, which checks only that the retained preview array is non-empty. Insertion enters the normal board history, autosave and workspace persistence chain, so a stale result can become durable canvas content. Correcting parse ownership and insertion eligibility changes visible pending/error behavior and requires approval before implementation.

## What Changes

- Give each conversion request an explicit current-input identity and ignore completions from obsolete input or converter generations.
- Model converter loading, parsing, success and failure so the preview and error belong to the current normalized input.
- Permit button and Ctrl/Cmd+Enter insertion only when the current input has a successful non-empty conversion result.
- Keep pending and failed input non-inserting: no board mutation and no dialog close.
- Preserve the existing successful insertion position, deep-clone, Plait paste/history, viewport reveal, close and workspace autosave contracts.
- Add focused component/integration tests for out-of-order completion, input changes while pending, failure after a prior success, fallback parse attempts, empty results, keyboard submission, dialog close/unmount and exact inserted-result identity.
- Do not add a worker, cache, persisted draft, new parser, new diagram type, automatic retry, network request or analytics event.

## Impact

- Affected specs: new `text-conversion-preview-consistency`
- Affected code: `packages/drawnix/src/components/ttd-dialog/mermaid-to-drawnix.tsx`, `markdown-to-drawnix.tsx`, shared input/panel state wiring, focused tests and F-30 evidence/documentation
- Related boundaries: `preserve-markdown-conversion-draft-feedback` owns Markdown language/dynamic-import feedback; `improve-text-conversion-dialog-interface` owns naming, live status and compact layout; F-31 owns the command-palette shell rather than the conversion result
- Data/storage impact: no element schema, `.drawnix`, workspace, backup, task, cache, localStorage, IndexedDB or migration format change. Only future eligibility for inserting the retained in-memory preview changes.
- Performance impact: no performance claim and no parser execution-model change. The request guard must be constant-space per mounted dialog and must not add parses or retries.
- Rollback: revert request ownership, eligibility wiring and focused tests together. No migration or cache cleanup is required, but rollback restores the verified stale-result insertion risk.

## Evidence

- Entry/state owner: creation toolbar `packages/drawnix/src/components/toolbar/creation-toolbar.tsx:557-560`, more-tools toolbar `packages/drawnix/src/components/toolbar/more-tools-button.tsx:424-428`, command registry `packages/drawnix/src/components/command-palette/command-registry.ts:393-406`, and dialog set updates `packages/drawnix/src/hooks/use-drawnix.tsx:99-131`.
- Async conversion: `packages/drawnix/src/components/ttd-dialog/mermaid-to-drawnix.tsx:70-90` awaits the parser and commits every completion without a request/version/cancel guard.
- Retained preview insertion: Mermaid `:92-145,213-237` and Markdown `packages/drawnix/src/components/ttd-dialog/markdown-to-drawnix.tsx:192-234,242-266` guard only on `value.length`; both pointer and keyboard paths call the same function.
- Component diagnostic environment: Node `v24.14.0`, Vitest `3.2.4`, jsdom, React Testing Library, controlled parser promises and mocked board only; no real board, storage, network or clipboard. Corrected diagnostic command with `packages/drawnix/vite.config.ts`: exit 0, 3/3 files and 4/4 tests; relevant Mermaid tests took 656 ms and 140 ms, total report 2.19 s. The temporary files were deleted.
- Production environment: existing `dist/apps/web`, loopback HTTP, in-app Chromium, zh-CN, 1280×720, DPR 1. Invalid `flowchart TD\nA -->` displayed a parse error, retained the old preview at opacity `0.15`, and left Insert enabled. No insertion was activated.

