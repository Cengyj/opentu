## Context

The current forward chain is:

`SettingsDialog -> PricingFieldGroup -> resolveProviderPricingConfig -> modelPricingService.fetchAndCache -> providerPricingCacheSettings`.

The resulting cache has independent consumers:

- `useModelPriceText` and `useModelMeta` render cached model price and documentation metadata.
- `settings-repository` reads cached `modelEndpoints` as provider binding evidence.
- `DrawnixDeferredRuntime` refreshes eligible existing caches through `warmupProfiles`.

Deleting the full pricing service or profile/cache schema would therefore change routing and model presentation outside the requested settings cleanup.

## Goals / Non-Goals

- Goals: remove every visible and interactive provider-pricing control from settings; remove code that exists only for those controls; preserve shared runtime pricing consumers.
- Non-Goals: remove model prices, cached endpoint evidence, pricing response parsers, warmup, persisted caches, provider fields used by those shared consumers, model discovery, or provider routing.

## Decisions

- Delete `pricing-field-group.tsx` instead of hiding it with CSS or a feature flag.
- Remove the `PricingFieldGroup` import/render site and its exclusive `pricing-group`/`pricing-row` styles.
- Remove `usePricingGroups` and `ModelPricingService.getGroups`, because their only production consumer is the deleted component.
- Keep `PricingGroup`, cache `groups`, `pricingUrl`, `cnyPerUsd`, and `pricingGroup` persistence. They remain part of the shared cached-pricing contract and allow existing profiles/caches to continue operating without migration.
- Keep the shared `settings-dialog__button--fetch` style because the live “获取模型” action also uses it.
- Do not replace the removed button with automatic requests; that would expand network behavior beyond this change.

## Compatibility And Rollback

- Existing profiles and caches load unchanged; no tolerant writer, migration, or destructive cleanup is added.
- Existing cached model prices, metadata, groups, and endpoint evidence remain available.
- Provider type, authentication, catalogs, model selection, routing, generation, and retry/recovery are unchanged.
- Rollback restores the component, import/render site, styles, and component-only group accessors; no data restoration is needed.

## Verification

- Source contract test proves the removed labels/action/component reference and exclusive styles do not return.
- Existing model-pricing tests prove response parsing, CNY conversion, cache behavior, groups, and endpoints remain intact.
- Provider-routing/settings-repository tests prove cached endpoint evidence and routing remain intact.
- Typecheck, targeted lint, cycle detection, and `git diff --check` verify the deletion leaves no dead imports or cycles.
