## Context

`SettingsDialog` owns drafts for provider profiles and presets, reads profile-scoped runtime discovery state, and saves through the existing settings manager. The provider page already uses native inputs/selects/buttons and TDesign switches, while `ModelDiscoveryDialog` uses native buttons and checkboxes. The confirmed problem is the content contract around these existing controls, not their data owners or operations.

Several active changes already own discovery concurrency/fallback, route/binding identity, storage durability, benchmark handoff, outer WinBox behavior, and shared settings-menu behavior. This change must not create a second owner for any of those boundaries.

## Goals / Non-Goals

- Goals: give existing provider fields and provider-enabled switches stable localized names/state, make existing model disclosures and icon actions operable and perceivable without hover, and make F-09 application copy follow the mounted Chinese/English context.
- Non-Goals: add providers/models/actions, change discovery or health behavior, alter settings save timing, redesign the page, migrate/encrypt credentials, change routing or sorting, resize the window, repair the shared four-view navigation, or claim unmeasured compact/theme/performance improvement.

## Decisions

- Decision: use stable `id`/`htmlFor`, wrapping labels, or explicit `aria-labelledby`/`aria-describedby` relationships owned by the F-09 content. Placeholder text remains instruction/example text and is never the sole accessible name.
- Decision: name each remaining provider-enabled TDesign switch at its rendered interactive element and verify that its programmatic checked state changes with the existing value. Do not add a second hidden checkbox or wrapper control that could fork focus, state, or callbacks.
- Decision: separate each model-group collapse trigger from the adjacent benchmark action. The collapse portion becomes a native button with `aria-expanded` and a stable controlled-region relationship; the benchmark button remains a separate sibling so no interactive element is nested inside another.
- Decision: keep discovery filters as existing native buttons and expose exactly one current filter with one consistent pressed/tab/radio contract selected by focused tests. Vendor header buttons expose `aria-expanded` and controlled content without changing the existing single-expanded-vendor behavior.
- Decision: give model test/remove actions localized purpose at the button itself. Names may use the already displayed provider/model identity for row disambiguation, but never API keys, credential-shaped data, provider response bodies, raw URLs, prompts, errors, or analytics payloads.
- Decision: add typed F-09 strings to the current i18n provider and consume them only in provider/model settings and discovery content. Provider/profile names, model IDs, endpoint URLs, API keys, numeric prices, error values, catalog/preset data, and user-authored values remain byte-for-byte data.
- Decision: do not absorb the shared settings navigation or outer WinBox. Their missing current/focus/dialog contracts remain adjacent F-26/F-15 evidence and require their own owner decision.
- Decision: do not add live announcements or retry controls. Discovery loading/failure and settings-save feedback already belong to behavior/storage changes; this change can label existing status content but cannot redefine lifecycle semantics.

## Invariants

- Provider profile IDs, enabled values, connection fields, image compatibility, API-key masking/reveal, capabilities, catalogs, selected model IDs, presets, and active routes are unchanged.
- One pointer or keyboard activation produces exactly the existing callback/state mutation and no additional provider, health, price, benchmark, storage, analytics, task, media, or canvas side effect.
- Discovery request URL/header/body, error propagation, ordering, stale-response/fallback behavior, catalog persistence, and selection reconciliation are unchanged.
- Raw provider/user/private data is not copied into translation keys, fixed accessible names, logs, snapshots, or analytics.
- Shared settings navigation, WinBox titlebar/focus lifecycle, TDesign defaults outside this content, storage/encryption formats, and migration logic are unchanged.

## Risks / Trade-offs

- TDesign may not forward every ARIA prop to its interactive node. Mitigation: render tests inspect the actual `role="switch"` element for name and `aria-checked`, not only React props or wrapper markup.
- Replacing the click-only group header can reduce its pointer hit area or accidentally trigger the benchmark sibling. Mitigation: preserve the existing visual hit region and test exact collapse/benchmark callback counts, keyboard focus, and no nested interactive content.
- A tab/radio pattern can introduce unexpected arrow-key behavior. Mitigation: select one documented pattern and test pointer, Tab, Enter/Space, and any arrow behavior explicitly.
- Localized English copy can overflow the provider form or discovery dialog. Mitigation: verify long-copy layout at the available desktop size and defer compact claims until a viewport-capable runner is available.
- Model identifiers can be long or arbitrary. Mitigation: keep visible truncation behavior and never use credentials, URLs, prompts, or raw errors as labels.

## Verification And Rollback

- Component tests cover provider fields, selects, provider-enabled switches, profile switching, API-key masking/reveal, model-group disclosure, discovery filters/vendors, and model test/remove actions with pointer and keyboard input.
- Tests assert exact existing values/callbacks, no additional discovery/price/health/benchmark/storage calls, and byte-for-byte preservation of provider/model/private sentinel values.
- Chinese/English tests cover initial render and live language change for normal, empty, loading, failure, and discovery content without resetting drafts, selected profile/model, open groups, or focus.
- Browser verification uses no real credential or provider call. Empty/default settings can be checked in production; populated discovery states use local synthetic fixtures only after approval.
- Rollback removes F-09 semantics/keys/tests/styles together. No tolerant reader, migration, cache deletion, credential rewrite, or data restoration is needed.
