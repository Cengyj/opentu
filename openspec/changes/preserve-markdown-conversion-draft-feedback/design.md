## Context

The Markdown dialog owns its text only for the mounted session. It injects `getMarkdownExample(language)` in the state initializer and again on every language change. There is no dirty/pristine identity, so the language effect cannot distinguish the dialog's example from user-authored content. The dynamic import catch reuses the Mermaid error key and diagnostic prefix.

## Goals / Non-Goals

- Goals:
  - Never replace user-authored Markdown solely because the application locale changes while the dialog is open.
  - Keep the untouched built-in example aligned with the current locale.
  - Give Markdown converter load failure correct localized, non-sensitive feedback and diagnostic classification.
  - Keep dialog close/reopen and storage behavior unchanged.
- Non-Goals:
  - Persist drafts, add recovery/versioning, change examples, parse semantics or supported Markdown.
  - Change application-wide language persistence or other dialog translations.
  - Own request freshness, insertion eligibility, dialog semantics or responsive CSS.

## Decisions

- Track the identity of the last example injected by the dialog, not merely a generic boolean. On language change, replace text only if the current text still equals that injected example and no user edit has made it authored content.
- Treat an explicit textarea change as authored even when the resulting text coincidentally equals an example string after editing. The test contract must prevent later locale toggles from erasing that edit.
- Keep the state mounted-session-only. Closing the dialog discards it exactly as today; reopening computes the current locale's example.
- Add `dialog.error.loadMarkdown` for both locales and use a Markdown-specific aggregate console prefix. Log the caught error object according to current diagnostic policy, but never add input or output content.
- Let the preview consistency change decide when loading/parsing begins and whether insertion is eligible.

## Alternatives Considered

- Remove the language effect and always preserve current text.
  - Rejected because an untouched built-in example would remain in the old language and contradict the existing localization intent.
- Always replace text on locale changes.
  - Rejected because the deterministic diagnostic proves authored content loss.
- Persist the draft before switching languages.
  - Rejected as a new recovery/storage feature with schema, privacy and lifecycle questions outside this correction.
- Reuse the Mermaid error text because both are diagram converters.
  - Rejected because the visible tool and failing chunk are Markdown-specific and the current message is factually wrong.

## Risks / Trade-offs

- Dirty-state tracking can drift if updates bypass the textarea handler.
  - Keep example identity and edit handling local to the component and cover rerender/repeated-toggle paths.
- Exact example text can be pasted by a user.
  - Explicit edit state takes precedence over value equality so authored text is preserved.
- Existing i18n type requires every key in both dictionaries.
  - Add the key to the type and both locales in one patch; typecheck verifies completeness.

## Verification

- Component: pristine zh→en and en→zh examples update; authored draft survives both directions and repeated toggles; edited text equal to either example remains authored; close/reopen gets current localized example.
- Failure: controlled Markdown import rejection shows the dedicated localized message in zh/en, records a Markdown-specific aggregate prefix, and includes no input/output content.
- Adjacency: preview/insert state remains owned by the preview-consistency contract; no storage read/write is added.
- Run focused tests, Drawnix typecheck/lint comparison, full typecheck/test comparison, cycles, production build, size/startup and relevant browser suites.

## Migration and Rollback

No migration, cache invalidation or user-data cleanup is required. Rollback removes mounted-session dirty/example tracking and the dedicated translation/diagnostic label.

