## Context

The project has one static model catalog and a runtime discovery store. Text selectors currently combine selected runtime models with `DEFAULT_DISPLAY_MODEL_IDS.text` unconditionally. Persisted selections can then pin a static model back into the list even after the user has fetched and selected a provider-scoped catalog.

The implementation must distinguish default recommendation changes from user-data migration. The former is in scope; the latter is explicitly out of scope.

## Goals / Non-Goals

- Goals:
  - Make the three GPT-5.6 IDs visible in fresh text selectors.
  - Make `gpt-5.6-sol` the new fallback default for new/empty state.
  - Keep user-selected old and custom-provider models usable and visible.
  - Keep runtime provider models visible after the user explicitly selects them.
  - Keep recommendation actions aligned with the new default display list.
  - Once a current provider catalog exists, expose only models explicitly selected under enabled providers.
  - Keep selector state, presets, and request routing aligned with the same visible selection set.
- Non-Goals:
  - Do not migrate any persisted model ID.
  - Do not alter provider catalogs, presets, history, tasks, or workflows.
  - Do not delete old model definitions.
  - Do not add model aliases or request-layer translation.

## Decisions

- Decision: Treat the main `model-config.ts` catalog as the source for the three new built-ins.
  - The selectors and runtime discovery already consume this catalog.
- Decision: Replace only `DEFAULT_DISPLAY_MODEL_IDS.text` and `DEFAULT_TEXT_MODEL_ID`.
  - This changes fresh/default behavior without rewriting stored user choices.
- Decision: Use two selector presentation modes.
  - `builtin-fallback` applies only when no enabled provider has an authoritative catalog and exposes `DEFAULT_DISPLAY_MODEL_IDS`.
  - `provider-selection` applies after discovery/key management and exposes only selected models from enabled provider catalogs.
- Decision: Permit explicit static text-model pinning only in built-in fallback mode.
  - In provider-selection mode an unscoped static selection is replaced by an explicitly selected provider model of the same type.
- Decision: Resolve persisted and route selections against the active presentation mode before pinning.
  - A provider-backed model may be pinned only while it remains selected in its authoritative catalog.
  - Discovered-but-unselected and unscoped static models are not pinned in provider-selection mode.
- Decision: Define “recommended models” from the default-display IDs.
  - Keeping all static models as recommended would re-promote the legacy GPT entries.
- Decision: Preserve provider-aware selection keys and runtime source metadata.
  - A user-selected provider model must not be replaced by a static built-in with the same ID.

## Risks / Trade-offs

- Risk: New GPT-5.6 API metadata is not fully verified.
  - Mitigation: Add only confirmed identity/type/vendor/display metadata; do not invent pricing, limits, or capabilities.
- Risk: Entering provider-selection mode can invalidate a previously selected built-in model.
  - Mitigation: Reconcile current selections and preset routes to the first valid selected model of the same type, and show an actionable empty state when no replacement exists.
- Risk: Existing global model ordering has a separate baseline mismatch.
  - Mitigation: Assert the new three-item order directly and keep unrelated sort fixes separate unless tests require them.

## Migration Plan

No provider catalog or history migration is performed. Existing static definitions remain intact. Current UI selections and preset routes may be reconciled when they reference a model that is not part of the enabled providers' selected model set.

## Rollback

Revert the static catalog/default-display changes and the display pinning changes. Because no persisted data is rewritten, rollback does not require transforming user settings.

## Open Questions

- Confirm final product copy and capability flags for the three GPT-5.6 models before adding optional metadata.
- Confirm each target ID is accepted by the configured provider before enabling production traffic.
