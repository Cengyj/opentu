# F-09 Provider And Model Settings Interface Diagnostics

## Feature Loop

**Feature / user scenario**: a user opens Settings, selects or creates a provider profile, edits its connection and pricing fields, enables or disables it, fetches a provider-scoped model catalog, filters/selects models, saves the profile/preset state, and later uses the same profile/model binding in generation or Chat. The user must be able to understand and operate the existing controls in Chinese or English without exposing credentials or changing routing behavior.

**Scope**: the provider-page content in `SettingsDialog`; `PricingFieldGroup`; provider profile selection and switches; provider form fields and feedback; model summary/search/type groups; `ModelDiscoveryDialog`; empty/loading/failure states; application-owned F-09 copy; existing settings/discovery/persistence/routing call-chain boundaries; desktop production DOM and one before screenshot.

**Out of scope**: the shared four-view settings navigation, outer WinBox titlebar/dialog/focus lifecycle, compact/touch sizing, global theme policy, discovery request ownership/fallback, runtime registry identity, model sorting/routing, health semantics, settings durability, credential encryption, price/health network correctness, benchmark lifecycle/content, and any new provider/model capability.

**Specs / active changes**: formal `provider-routing` and `runtime-model-discovery`; active `add-multi-provider-profiles`, `add-runtime-model-discovery`, `add-provider-protocol-routing`, `update-default-text-models`, `update-kling-capability-version-routing`, `fix-runtime-model-discovery-stale-response`, `fix-runtime-model-discovery-failure-fallback`, `ensure-settings-write-consistency`, `improve-settings-toolbar-accessibility`, and F-22 benchmark changes. A new approval-only change, `improve-provider-model-settings-accessibility`, owns only F-09 content names/state/keyboard/localization. It contains 3 requirements, 11 scenarios, and 7 of 28 checked evidence/validation tasks. No runtime implementation is authorized before approval.

## Environment And Method

- Date/time zone: 2026-07-30, Asia/Shanghai.
- Build under test: current `dist/apps/web`, served locally at `http://127.0.0.1:7395/?sw=0`.
- Browser: Codex-controlled Chromium, 1280×720 CSS px, DPR 1, no configured network/CPU throttle.
- Samples: one deterministic desktop DOM/accessibility/geometry state and one screenshot. This is not a performance sample.
- State safety: no browser storage was read; no API key/token value was read or printed; no provider enable switch, asynchronous-endpoint switch, form field, save control, “获取模型”, “获取价格”, health control, or benchmark action was activated.
- The `codex` provider row was selected once to confirm the same content contract, then the `default` row was restored. Profile selection is component-local draft/UI state and caused no settings write or provider call.
- Responsive limitation: the current Browser binding does not expose viewport emulation. Formal Playwright remains blocked by the repository's missing `chromium_headless_shell-1200`; tablet/mobile/high-DPI/theme claims were not manufactured.

## Forward Call Chain

1. Application menu/settings action sets `appState.openSettings`; `drawnix.tsx` mounts `SettingsDialog` inside the shared `WinBoxWindow`.
2. `settings-dialog.tsx:863-958` loads cloned provider profiles/presets and legacy model defaults into component draft state. `selectedProfileId`, `profilesDraft`, runtime discovery subscription, compact mode, model search, collapsed groups, and API-key reveal are local UI owners.
3. Provider row activation at `:789-805,1885-1958` changes the selected profile. The existing selector button exposes `aria-pressed`; its sibling TDesign switch calls `handleProviderEnabledChange()` and persists existing profiles only through the current settings boundary.
4. Provider fields at `:2072-2475` update only the selected draft. The async-image switch additionally calls the existing `providerProfilesSettings.update`; pricing fields call `PricingFieldGroup` and the current price service only on explicit fetch/group actions.
5. Explicit model fetch at `:1445-1507` first persists pending drafts, trims/normalizes Base URL and key, then calls `runtimeModelDiscovery.discover(profileId, baseUrl, apiKey)`. That store owns loading/error/ready state, `/models` fetch, adapted models, profile catalog persistence, and observable updates.
6. On success, `ModelDiscoveryDialog` receives `discoveredModels` and selected IDs at `:3217-3236`. Its local state owns search, type filter, draft selection, and expanded vendor. Confirm calls `handleApplySelectedModels()` at `:1509-1591`, which updates only the current profile catalog and reconciles presets through existing services.
7. The model summary at `:2511-2808` renders profile-scoped selected models, search, group collapse, benchmark shortcuts, remove actions, and current empty/error text. It does not own provider execution.
8. Existing model selectors read the shared runtime store; route creation retains `profileId + modelId`; the provider planner/adapter/transport chain owns final endpoint/auth/body. This proposal does not change that chain.

## Reverse Trace

- Final provider field values originate in `profilesDraft`; the only durable writers remain `providerProfilesSettings` and `settingsManager.updateSettings` on existing switch/save paths.
- Final selected model rows originate in one profile catalog's selected IDs. Their writer is `runtimeModelDiscovery.applySelection()` through the discovery confirmation or current remove action.
- Final discovery filter/vendor/group visual state has one component-local writer each: `setActiveType`, `setExpandedVendors`, and `setCollapsedGroups`. No storage writer exists for those transient states.
- Final switch visual state comes from `profile.enabled` or `preferAsyncImageEndpoint`, but production TDesign output encodes it only in `t-is-checked` class and omits `aria-checked`.
- Final accessible field names have no writer: all eight rendered input/select elements lack `id`, `aria-label`, and `aria-labelledby`; their nine nearby labels have no `for`, and the fields are siblings rather than label descendants.
- Final F-09 application copy comes from fixed literals/constants in the three content modules. The mounted `I18nProvider` owns `zh`/`en`, but those modules do not consume its context, so provider/model content has no language-dependent branch.

## Inputs, State, Side Effects, And Recovery

- **Inputs/outputs**: `ProviderProfile` drafts include IDs, name, URL/key/auth/provider type, compatibility, capabilities, pricing and enabled values. Discovery maps provider data to `RuntimeModelDiscoveryState`, then persists a profile-scoped catalog and produces `ModelConfig` selectors.
- **Defaults/transforms**: the first existing profile is selected on open; missing Base URL uses the configured default only at fetch/save normalization; names/URLs/keys are trimmed at save; the discovery dialog resets query/type/draft/expanded vendor every open.
- **State owners**: React owns drafts and transient content state; settings manager owns durable settings/localStorage and its existing IndexedDB mirror; runtime discovery owns catalog state/events; i18n context owns only language; WinBox owns the outer window.
- **Side effects**: settings/localStorage/IndexedDB writes, `/models` fetch, pricing fetch, benchmark launch, analytics, and UI messages occur only on existing explicit callbacks. No such callback was invoked in this audit.
- **Concurrency/races**: stale discovery and fallback are already confirmed under separate approval changes. This interface change cannot alter request ownership or catalog acceptance.
- **Timeout/cancel/retry**: discovery has no content-owned cancel action; retry is the existing fetch button. This change does not add lifecycle controls.
- **Persistence/migration/cache**: no schema, key, migration, encryption, cache, or recovery behavior belongs to the interface change. Drafts reload from current settings when Settings opens.
- **Error path/privacy**: current discovery errors flow to a message and inline empty/error branch. The audit did not inspect real errors or credentials; private/provider values must remain outside fixed names/translation keys.
- **Tests**: F-09 already has pure tests for model-discovery utilities, profile draft/reconciliation, help links, runtime discovery, settings, routing, adapters, health, sort/grouping, preference, selector, and retry. There is no permanent component test for the confirmed content relationships yet; adding one is approval-gated.

## Issues

### [F09-PROVIDER-FORM-A11Y-007]

**Status**: 已证实事实，待审批. **Evidence strength**: production DOM/accessibility state plus exact JSX relationship trace.

**User impact**: keyboard and assistive-technology users encounter six provider/pricing inputs, two selects, and three switches without persistent purpose. The switches also do not expose whether they are on or off, even though the visual state is present.

**Reproduction**: open Settings → provider page in the production build at 1280×720. Query the six content inputs and two selects: each has `id=null`, `aria-label=null`, and `aria-labelledby=null`. Query nine nearby `label` elements: every `for` is null and the controls are sibling nodes. Query the three `role=switch` buttons: every name relationship and `aria-checked` is null; two enabled-provider switches use `t-is-checked`, while the async switch does not. Select `codex`, observe the same result, and restore `default` without saving.

**Current vs expected**: current purpose depends on visual position or placeholder and current switch state depends on CSS. The proposed expected behavior associates each existing visible label/instruction and exposes the current checked state on the actual switch, while keeping all values and callbacks unchanged.

**Call chain/root cause**: Settings entry → draft/profile selection → JSX visible `label` sibling → input/select or TDesign switch → DOM. The content renders label-shaped elements but supplies neither native containment/`for`/ID nor ARIA relationships. TDesign receives `value`, renders checked classes, and the current call sites supply no name/state contract.

**Affected range**: provider name/type/image compatibility/async preference/icon URL/Base URL/API key/pricing URL/rate/group; default and custom provider enabled switches. The API-key reveal button already has a name and is a non-problem.

**Candidate/alternative**: `improve-provider-model-settings-accessibility` proposes stable native/ARIA relationships and tests the actual switch node. Placeholder-only naming was rejected because it disappears as an instruction and does not label fields with no placeholder. Adding hidden duplicate controls was rejected because it would fork focus/state/callback ownership.

**Risk/validation/rollback**: incorrect TDesign prop forwarding could name a wrapper but not the switch; converting labels could alter click focus or switch twice. Tests must inspect actual nodes and exact pointer/keyboard callback counts, API-key masking, draft/persistence values, and private sentinels. Roll back relationships/keys/tests/styles; no data migration or cleanup.

### [F09-MODEL-MANAGEMENT-A11Y-008]

**Status**: 已证实静态控制流，运行时 populated-state 受凭据阻塞，待审批. **Evidence strength**: reachable success branch plus exhaustive current JSX/state-writer trace; no fabricated provider call.

**User impact**: after a successful existing model discovery, keyboard users cannot focus or toggle model-type group headers; assistive technology cannot identify the current discovery type or vendor expansion; icon-only model test/remove actions have no non-hover purpose.

**Reproduction/static proof**: `settings-dialog.tsx:2612-2662` attaches group collapse only to a `div onClick`; `:2741-2778` gives icon buttons only `HoverTip`. `model-discovery-dialog.tsx:253-270` changes `activeType` and CSS class without programmatic selected state; `:302-351` toggles vendor content without `aria-expanded`; `:403-420` renders an unnamed icon test button. The success branch is reached only after `handleFetchModels()` completes and opens the dialog. Current configured profiles expose zero model entries and the fetch action requires a credential, so no request was triggered to manufacture a populated production state.

**Current vs expected**: current pointer/CSS/hover behavior works visually. The proposed expected behavior makes the same actions focusable/named/stateful, preserves one current filter and vendor expansion, and keeps benchmark/removal callbacks separate.

**Call chain/root cause**: provider fetch → runtime discovered models → discovery local filter/vendor/selection state → dialog DOM → confirmation → catalog/preset → settings summary → group collapse/test/remove DOM. State owners exist, but their DOM projections omit native disclosure/selection/action relationships; the summary header combines a click-only container with a nested sibling action.

**Affected range**: populated model summary and discovery dialog only. Model checkbox rows are already wrapped by native labels and are a non-problem. Search names can be included in the same field-label implementation; discovery ordering/routing are excluded.

**Candidate/alternative**: use separate native disclosure and benchmark buttons, consistent current-filter state, vendor `aria-expanded`/controls, and direct localized icon-action names. Adding key handlers to the `div` was rejected because it would still recreate button semantics and conflict with the nested action. Hover text alone was rejected because it is not a programmatic name.

**Risk/validation/rollback**: split headers can change hit geometry or double-run benchmark/collapse; group semantics can add unexpected arrow behavior. Synthetic component tests must assert focus, pointer/Enter/Space, exact callbacks, current/expanded state, unchanged search/order/selection, and zero external calls. Roll back semantic markup/keys/tests/styles; catalog data is untouched.

### [F09-PROVIDER-I18N-009]

**Status**: 已证实静态控制流，待审批. **Evidence strength**: mounted language-owner trace plus no-consumer/exact rendering branches; English runtime screenshot unavailable.

**User impact**: selecting the application's existing English language leaves provider/model settings application copy in Chinese, including form purposes, loading/failure/empty framing, discovery controls, and actions.

**Reproduction/static proof**: `drawnix.tsx:870-938` mounts the workbench under `I18nProvider`; `i18n.tsx:599-631` updates context language and only context-dependent strings can branch. `settings-dialog.tsx`, `pricing-field-group.tsx`, and `model-discovery-dialog.tsx` neither import nor consume `useI18n`; their system copy is rendered from fixed Chinese literals across the reachable branches. Opening the language menu was possible in the same production run, but the already-recorded shared submenu keyboard defect and absence of a safe direct context control prevented a matched English screenshot; no storage mutation was used as a workaround.

**Current vs expected**: current F-09 content has no language input. The proposed expected behavior localizes application-authored framing and accessible names through the existing provider while preserving provider/model/private data byte-for-byte.

**Call chain/root cause**: language menu → `I18nProvider` context state → only consumers receive language-dependent output → F-09 modules have no consumer/prop → fixed Chinese DOM. Outer WinBox/tool title localization and shared settings navigation remain separate.

**Affected range**: F-09 provider form, pricing, model summary, discovery dialog, existing safe feedback and accessible names. Provider/profile names, model IDs, URLs, API keys, numeric prices, raw errors, catalogs, presets, routes, and analytics metadata are data and must not be translated.

**Candidate/alternative**: add typed F-09 zh/en strings to the current provider and consume them at content owners. A second localization store or browser-locale inference was rejected because it would fork the established owner. Translating provider/error/private data was rejected.

**Risk/validation/rollback**: long English copy may overflow, and changing language can accidentally reset local state or focus. Tests must cover initial/live language, normal/empty/loading/failure/synthetic discovery states, byte preservation, focus/drafts/expansion, and zero extra side effects. Roll back keys/usages/tests; no persistence migration.

## Adjacent Observations And Non-Problems

- **Shared settings navigation**: four view buttons expose the active view only through `settings-dialog__nav-item--active`; all have null `aria-current`, `aria-pressed`, and `aria-selected`. This is a confirmed DOM fact but spans provider, presets, canvas, and speech; it is not assigned to the F-09 change. Ownership must be decided with F-26 before implementation.
- **Outer settings content**: the `[data-testid=settings-dialog]` root has no role/name/label, and the initial production open left focus on `BODY`. The shared WinBox/focus contract belongs to F-15/F-26 and is not reclassified as an F-09 content fix.
- **Provider selection non-problem**: `default`/`codex` provider buttons expose the selected profile with `aria-pressed`; the production pointer transition moved pressed state correctly and was restored.
- **API-key reveal non-problem**: the button exposes `查看 API Key`/`隐藏 API Key`; no key value was read.
- **Discovery checkbox non-problem**: each model checkbox is inside its visible row label. Populated production verification remains credential-blocked.
- **Performance/visual**: no runtime code/style changed, no five-run before/after sample exists, and no after screenshot exists. No performance or visual-improvement claim is made.

## OpenSpec And Verification State

- `openspec validate improve-provider-model-settings-accessibility --strict`: exit 127, `openspec` command unavailable. It was not installed and strict validation is not claimed.
- Manual structure check: proposal/design/tasks/delta files present; 1 ADDED operation; 3 requirements; 11 `#### Scenario:` blocks; 11 WHEN and 11 THEN lines; all three requirement names unique across current specs/changes; the new capability has one active owner.
- Screenshot: `provider-settings-desktop-1280x720-before.jpg`, JPEG 1280×720, 64,850 bytes, SHA-256 `5a6f4f6395ce7a39e37cddf1498ffad2f48bdaf7e7ecd88334c1d2cc3b3d54f7`.
- Focused pure regression: direct Vitest invocation of the three settings-dialog utility files plus `runtime-model-discovery.test.ts` passed 4/4 files and 25/25 tests, exit 0, duration 2.05s. An initial package-script invocation forwarded an extra separator and therefore ran the full Drawnix suite instead of four files; it exited 1 with 184 passed/4 failed/1 skipped files and 1161 passed/3 failed/1 skipped tests in 90.86s. The four failure clusters are the same cached-image, GPT Blob mock, Sora duration, and PPT settings mock baseline clusters already recorded before this documentation-only pass; none is an F-09 focused failure.
- Cleanup: the Browser tab was closed, the local server received Ctrl-C and exited 0, no provider/pricing/health request or settings save was triggered, and no temporary diagnostic source file remains.

## Exit Assessment

This pass closes the previously missing feature-local F-28 evidence/owner gap for F-09, not the entire F-09 behavior loop. The three content findings have one approval-only owner and no implementation. Existing discovery race/fallback/registry proposals and health/retry decisions remain blocked as previously recorded. Shared settings navigation, outer focus, compact/touch, theme/high-DPI, English runtime, populated discovery runtime, after visual evidence, and all post-approval semantic tests remain open. Therefore F-09 does not meet the feature exit standard.
