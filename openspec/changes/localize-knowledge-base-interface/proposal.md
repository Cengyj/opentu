# Change: Localize the existing knowledge-base interface

## Why

Drawnix explicitly supports `zh` and `en` through `useI18n`, but the reachable knowledge-base feature does not read that context. A source scan of the knowledge-base components and manifest records 340 Chinese text matches across visible labels, placeholders, messages, confirmations, dates, empty/error states, tooltips, and default action text. The tool adapter passes only `initialNoteId`.

Switching those surfaces to the selected application language changes visible behavior and persisted default titles for newly created notes, so implementation requires approval. Existing user directory/note/tag names and Markdown are data and must never be translated or migrated.

## What Changes

- Add typed Chinese/English knowledge-base strings to the existing i18n source and consume them across reachable knowledge-base UI surfaces.
- Localize visible labels, placeholders, tooltips, confirmations, errors, counts, storage text, dates, editor modes, extraction/related states, and accessible names.
- Keep canonical stored default-directory names and internal routing identifiers stable while displaying localized aliases for system directories.
- Localize default titles only for notes newly created under the active language; do not rename existing notes, directories, tags, Skills, imports, or source metadata.
- Verify Chinese/English length, sorting/date behavior, search of stored data, imports/exports, compact layout, and accessibility.

## Impact

- Affected specs: `knowledge-base-localization`
- Affected code: `i18n.tsx`, reachable knowledge-base components/tool manifest/adapters, date/format helpers, focused i18n and visual tests
- Shared dependency: accessible names from `improve-knowledge-base-accessibility` and compact controls from `fix-knowledge-base-responsive-layout` must use this one message source if changes are approved together
- No stored directory IDs/names, existing note/tag/Skill content, IndexedDB schema, asset protocol, backup format, cache, task, or migration changes
- User-visible trade-off: a newly created untitled note uses the active-language default title; existing user data remains unchanged and can contain mixed-language names
- Rollback restores hard-coded strings and removes keys/tests; newly created user titles are ordinary user data and are not renamed on rollback

## Current Evidence

- `packages/drawnix/src/i18n.tsx:1-5,197+` defines the supported `zh/en` context and typed translations.
- `drawnix.tsx:1048` consumes the active language for other reachable surfaces.
- No knowledge-base component imports `useI18n`, and the tool adapter supplies no language prop.
- The 340-match scan is an inventory signal; each implementation replacement still requires a visible/accessible consumer check and must not mechanically translate comments, data, identifiers, or provider content.
