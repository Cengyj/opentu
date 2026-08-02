## 1. Investigation And Specification

- [x] 1.1 Trace pricing controls through profile drafts, explicit fetch, pricing cache persistence, warmup, model price/meta display, and binding endpoint consumers.
- [x] 1.2 Define the deletion boundary that removes the settings feature without deleting shared pricing or routing capabilities.
- [ ] 1.3 Strictly validate this change with OpenSpec CLI. (The local
      `openspec` executable is unavailable; both direct and `pnpm exec`
      validation attempts fail before reading the change.)

## 2. Production Cleanup

- [x] 2.1 Remove `PricingFieldGroup` from provider settings and delete its source file.
- [x] 2.2 Remove component-only pricing group hooks/accessors and exclusive styles while retaining shared model pricing and the live model-fetch button style.
- [x] 2.3 Update overlapping accessibility scope and historical evidence annotations without changing unrelated accessibility work.

## 3. Tests And Verification

- [x] 3.1 Add a regression test proving the provider-pricing settings controls and source references are absent.
- [x] 3.2 Run provider settings, model pricing, settings repository, and provider routing tests.
- [x] 3.3 Run typecheck, targeted lint, cycle detection, `git diff --check`, and protected-file audit.
