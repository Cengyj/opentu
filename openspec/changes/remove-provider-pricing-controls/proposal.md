# Change: Remove provider pricing controls from settings

## Why

The provider settings page exposes manual pricing URL, currency conversion, pricing-group, and “获取价格” controls. The controls are not part of provider connectivity or model selection and should no longer be user-facing. Their fetch path writes into a shared pricing cache that is also consumed by model price display and provider binding endpoint evidence, so removing the settings controls must not delete that shared runtime capability.

## What Changes

- Remove the complete provider-pricing control group from `SettingsDialog`, including its manual fetch action and conditional pricing-group selector.
- Delete the now-unreferenced pricing field component, component-only styles, and component-only pricing-group hook/service accessor.
- Preserve existing provider pricing fields, persisted pricing caches, automatic cache warmup, model price/meta display, and routing consumption of cached endpoint metadata.
- Update overlapping provider-settings accessibility evidence/specification so it no longer promises semantics or localization for controls that do not exist.

## Impact

- Affected specs: `provider-settings`
- Affected code: provider settings UI, `use-model-pricing`, and the unused `ModelPricingService.getGroups` accessor
- Data/network impact: no migration, cache deletion, settings rewrite, or new request; the settings page can no longer initiate a pricing request
- Preserved owners: model pricing calculation/cache, startup warmup, model price display, provider endpoint binding inference, model discovery, routing, and all generation flows
