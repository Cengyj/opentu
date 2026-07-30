# Change: Improve provider and model settings accessibility

## Why

The reachable provider settings page visually labels its connection fields and switches, but the rendered controls do not expose those relationships. A production Chromium run found six inputs, two native selects, and three switches with no programmatic name; the switches also express their on/off state only through CSS classes rather than `aria-checked`.

The provider-scoped model-management path has the same content-level gap: model groups use a click-only `div`, discovery filters and vendor disclosures expose no selected/expanded state, and icon-only model test/remove actions rely on hover tips. The provider/model content also bypasses the existing Chinese/English context. Correcting those observable interface contracts requires approval before implementation.

## What Changes

- Associate the existing provider connection, image-compatibility, credential, and pricing fields with persistent localized labels and instructions.
- Give the existing provider-enabled and asynchronous-image switches localized names and programmatic checked state without changing their values or persistence callbacks.
- Make existing provider-scoped model group disclosures keyboard operable and expose group, discovery-filter, vendor-expansion, and icon-action state/purpose programmatically.
- Render application-authored provider/model settings and discovery copy through the existing Chinese/English provider without translating or mutating provider names, model IDs, URLs, API keys, prices, errors, presets, or catalog data.
- Preserve provider discovery, routing, health, benchmark handoff, settings durability, credential storage, analytics, shared settings navigation, and outer WinBox behavior.

## Impact

- Affected specs: `provider-model-settings-accessibility` (new delta capability)
- Affected code: `settings-dialog.tsx`, `model-discovery-dialog.tsx`, `pricing-field-group.tsx`, F-09-scoped i18n keys, focused component tests, and only necessary content styles
- Adjacent owners:
  - `add-multi-provider-profiles`, `add-runtime-model-discovery`, `fix-runtime-model-discovery-stale-response`, and `fix-runtime-model-discovery-failure-fallback` retain profile/catalog/discovery semantics.
  - `add-provider-protocol-routing`, `update-default-text-models`, and `update-kling-capability-version-routing` retain routing, binding, ordering, and capability semantics.
  - `ensure-settings-write-consistency` retains primary settings durability and failure outcomes.
  - `improve-settings-toolbar-accessibility` retains the shared application menu, toolbar More panel, and canvas-settings switch; it does not own provider-page controls.
  - `fix-tool-window-viewport-transition` and `improve-tool-window-accessibility` retain outer WinBox geometry, titlebar, and focus lifecycle.
  - F-22 benchmark changes retain benchmark launch consumption, execution, storage, and content behavior.
- Explicitly deferred: shared four-view settings navigation state, outer dialog/focus trap, compact/touch target sizing, global light/dark policy, provider health semantics, discovery races/fallback, credential encryption, and any new provider/model operation
- Data/network impact: none; no provider request, settings key/schema, encryption rule, catalog/preset/model value, cache, IndexedDB/localStorage record, analytics schema, or migration change
- Rollback: remove the F-09 content semantics, scoped i18n keys/consumers, focused tests, and necessary styles; no stored data or cache cleanup is required

## Evidence

- Production `dist/apps/web` in Chromium at 1280×720/DPR 1 rendered six provider/pricing inputs and two native selects. All eight controls had no `id`, `aria-label`, or `aria-labelledby`; nine visible `label` elements had no `for` attribute and were sibling nodes rather than wrapping the controls.
- The same run rendered three TDesign buttons with `role="switch"`. All had no `aria-label`, `aria-labelledby`, or `aria-checked`; their current state was present only in `t-is-checked` CSS classes. Switching provider selection without changing or saving data reproduced the same result for both configured profiles.
- Provider selection itself is a non-problem: its two buttons expose the current profile through `aria-pressed`, and pointer activation moves the pressed state to the selected profile.
- `settings-dialog.tsx:2170-2431` and `pricing-field-group.tsx:78-121` render visible sibling labels without control relationships. `settings-dialog.tsx:1940-1954,2260-2280` renders the three unnamed/class-state switches.
- `settings-dialog.tsx:2612-2780` renders model-group collapse on a non-focusable click-only `div` and two icon-only model actions without names. `model-discovery-dialog.tsx:253-270,302-351,403-420` renders type-filter buttons without selected state, vendor disclosure buttons without `aria-expanded`, and icon-only model test actions without names. The discovery path is reachable only after the existing provider request succeeds; no request or credential was manufactured for this audit.
- `I18nProvider` wraps Drawnix and the application menu can change its `zh`/`en` state, but the three F-09 content modules do not consume `useI18n`; their application-authored normal, empty, loading, failure, form, action, and discovery copy follows fixed Chinese branches.
- Existing before screenshot: `docs/evidence/f09-provider-model-settings/provider-settings-desktop-1280x720-before.jpg`. No after screenshot exists.

## Approval

Implementation is blocked until the user approves F-09 provider-form names/switch state, provider-scoped model-management semantics, and scoped Chinese/English application copy.
