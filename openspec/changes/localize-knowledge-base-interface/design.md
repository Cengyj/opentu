# Design: Knowledge-base localization

## Decisions

- Extend the existing typed `Translations` map rather than introduce a second i18n provider. Group keys by knowledge-base tree, editor, tags, search/sort, import/export, related/extraction, status/error, and accessibility surfaces.
- Treat persisted directory/note/tag names, imported frontmatter, Markdown, source metadata, prompt templates, and Skill bodies as user/content data. Never translate them.
- Map canonical default directory names such as the stored `笔记` and `Skill` values to localized display labels at render time. Internal navigation and directory lookup continue using canonical values.
- Generate localized default names only when creating a new note/Skill in the active UI language. Uniqueness checks operate on the actual stored title and do not rename older records.
- Use locale-aware date/number formatting based on active language while preserving stored numeric timestamps and sort order.
- Pass message access through context/hooks or focused props; do not store translated UI text in service-layer error contracts when a stable code can be mapped at the UI.

## Alternatives rejected

- Machine-translate every Chinese source match: comments, identifiers, default-directory keys, and user content are not UI strings.
- Rename existing default directories to English: breaks routing, imports, and user data and requires a migration with conflict rules.
- Create a knowledge-base-only global dictionary: duplicates the typed application i18n owner.
- Infer language from browser locale inside services: diverges from the user's selected application language.

## Verification

- Unit tests verify all new keys exist in zh/en, dynamic interpolation, canonical-directory display mapping, default-title generation, and locale formatting.
- Browser checks cover every initial/empty/loading/success/partial/failure/cancel/retry/import/export/search/tag/editor/details state in both languages.
- Compare desktop/tablet/mobile screenshots with identical fixtures for overflow, truncation, wrapping, and control bounds. Accessibility snapshots must expose the matching language.
- No performance improvement is claimed. Record bundle delta and render behavior, and run standard typecheck/test/cycles/build/size/startup gates.

## Rollback

Remove scoped keys/hooks/props and restore prior literals. Do not rename any note created under either language before rollback.
