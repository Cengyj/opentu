# Change: Make `.drawnix` file transfer outcomes truthful and recoverable

## Why

The existing application-menu, hotkey and command-palette file actions do not consistently consume asynchronous failure:

- `SaveToFile` calls `saveAsJSON` without returning, awaiting or catching its Promise.
- `OpenFile` registers only `.then`; invalid-file, filesystem and media-load rejection has no user feedback path.
- hotkey and command-palette saves also call `saveAsJSON` without a rejection handler.
- image export catches internally but always shows a hard-coded Chinese failure message, including in an English session.

The embedded-media boundary also converts partial failure into apparent success. A deterministic diagnostic showed that a missing cache Blob produces a normal `.drawnix` JSON result containing the virtual URL but no `embeddedMedia`. A second diagnostic showed that an embedded-media cache write rejection logs once but `loadFromBlob` still resolves with the imported data. Users cannot distinguish a complete portable file/import from a partial result or retry deliberately.

Correcting completion, partial-success and localized feedback changes visible file-operation behavior and internal result contracts, so implementation requires approval.

## What Changes

- Define typed save/load media outcomes that distinguish complete, partial, cancelled and failed results without changing the version-1 `.drawnix` fields.
- Keep user cancellation silent and non-mutating.
- Catch non-cancellation open/save failures at every reachable application-menu, hotkey and command-palette entry and show localized, actionable feedback without exposing raw file content or URLs.
- Allow the current best-effort partial export/import to complete, but report how many referenced media items could not be embedded or restored and keep the existing action available for manual retry.
- Keep invalid-file/import failure from replacing the current board; keep successful structural import behavior and existing history reset/autosave chain.
- Localize image-export failure through the existing language owner and make command-palette save copy identify the actual `.drawnix` file action rather than “Save as JSON”.
- Add focused completion/error/partial/cancel tests for all entry points and same-locale browser verification. Do not add a new file manager, retry queue, migration, background sync, or file-format field.

## Impact

- Affected specs: new `drawnix-file-transfer-recovery`
- Affected code: `data/{json,blob,embedded-media}.ts`, application-menu file items, command registry, hotkey integration, image export feedback, i18n keys, and focused F-29 tests/evidence
- Related boundaries: `stabilize-drawnix-file-export-snapshot` owns point-in-time consistency; `prevent-network-failure-media-cleanup` owns cleanup deletion classification; F-03 backup/GitHub flows and F-06/F-13 cache production are not changed
- Data/API impact: internal return types may become richer, but version-1 `.drawnix`, board, workspace, cache, backup, task, asset and migration formats remain unchanged. Existing external package exports must be audited before changing any exported TypeScript signature.
- Rollback: revert typed outcomes, caller handlers, translations and tests together. No migration/cache cleanup is required; rollback restores silent failures, partial-result ambiguity and the fixed Chinese image error.

## Evidence

- `packages/drawnix/src/components/toolbar/app-toolbar/app-menu-items.tsx:38-96` contains unobserved save and fulfil-only open handlers.
- `packages/drawnix/src/plugins/with-hotkey.ts:168-176` and `packages/drawnix/src/components/command-palette/command-registry.ts:356-372` invoke save without a failure consumer.
- `packages/drawnix/src/utils/image.ts:67-86` catches export failure but uses the literal `导出图片失败，请稍后重试` instead of i18n.
- `packages/drawnix/src/data/embedded-media.ts:97-139` skips missing/rejected export media and returns only successful items; `:145-169` catches each import cache failure and resolves `void`.
- `packages/drawnix/src/data/blob.ts:11-25` awaits restoration but cannot observe its partial outcome; `app-menu-items.tsx` cannot report it.
- Current translation contract has menu labels and cleanup feedback but no open/save/image-export/partial-media failure keys: `packages/drawnix/src/i18n.tsx:74-95,266-286,455-475`.
- Promise-observation diagnostic: Save called once, returned Promise-like `.then` observed 0 times, menu callback returned `undefined`, error feedback 0; Open called once, fulfil `.then` 1, reject `.catch` 0, callback returned `undefined`, error feedback 0. Exit 0, 1/1 file and 2/2 tests, 60/8 ms, 1.64 s report.
- Partial-media diagnostic: export cache miss retained the virtual URL, omitted `embeddedMedia`, warned once and resolved; import cache-write rejection called the cache writer once, logged once and resolved the parsed data. Exit 0, 1/1 file and 2/2 tests, 3/18 ms, 1.23 s report.
- Diagnostics used Node `v24.14.0`, Vitest `3.2.4`, jsdom and synthetic data only; no file picker, real storage, real network, clipboard or user board was accessed. Both temporary files were deleted.

