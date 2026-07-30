## Context

The Workbench is an internal React tool portaled into a WinBox. It already uses native buttons for all visible selector actions, TDesign Select/Input for several fields, and semantic `aside`/`main` containers. Benchmark data and side effects are owned by a singleton service and several pending behavior changes. This change must improve only the content contract without creating a second execution, storage, or window owner.

## Goals / Non-Goals

- Goals: expose existing selected/toggle state, create stable label/group/region relationships, localize application-owned content, and preserve every current callback/value/data boundary.
- Non-Goals: add ranking/stop/retry actions, change result status timing, change storage readiness/failure behavior, sanitize provider data, resize the WinBox, redesign shared TDesign components, define a new dark theme, or assert unmeasured compact geometry.

## Decisions

- Decision: keep native buttons and add the minimum group/state contract. Mutually exclusive modality/comparison/history filters use a consistent radio/tab/pressed-button pattern selected during implementation tests; score/favorite/reject and active-session controls expose their current programmatic state without changing click outcomes.
- Decision: use persistent visible labels and explicit `id`/`htmlFor` or `aria-labelledby` relationships around existing TDesign/native inputs. Placeholder text remains an instruction, not the sole accessible name.
- Decision: add semantic headings or labelled regions only where they describe the existing history, builder, and result areas. Do not change outer WinBox dialog/focus ownership.
- Decision: add typed F-22 strings to the existing provider and consume them from the Workbench. Provider/model/session titles, prompts, preview/result data, raw historical values, and error payloads remain byte-for-byte data; only application-authored framing is translated.
- Decision: do not add live status in this change. Running/stopping/interrupted announcements depend on the approved lifecycle state machine and stay with `control-model-benchmark-run-lifecycle`.
- Decision: do not add compact target-size or theme rules without a viewport-capable measurement and a confirmed global theme contract. Current desktop 32/34 px geometry remains evidence, not an unapproved sizing conclusion.

## Invariants

- Modality, comparison mode, selected targets, prompt preset/text, knowledge context, concurrency, ranking mode, session/entry IDs, and manual feedback values are unchanged.
- One pointer or keyboard activation produces the same current state mutation and no provider request unless the existing explicit start path is invoked.
- No new subscription, KV write, export field, analytics field, provider/model request, task, media record, or canvas element is introduced.
- Raw provider/user data is never placed into an accessible name or translation key.
- Outer WinBox titlebar, focus lifecycle, size/maximize state, and shared component defaults are unchanged.

## Risks / Trade-offs

- An incorrect tab/radio pattern can add unexpected arrow-key behavior or duplicate tab stops. Mitigation: choose one documented pattern and test pointer, Tab, Enter/Space, and any arrow behavior with exact callback counts.
- TDesign internal input IDs can drift across renders. Mitigation: own stable IDs/relationships at the F-22 wrapper rather than depending on placeholder-derived names.
- Localizing every literal can accidentally translate provider/user data or alter export columns. Mitigation: inventory strings by source and assert sentinel values/callback/export objects are unchanged.
- Result feedback state may be unavailable before a synthetic session is mounted. Mitigation: component fixtures inject local non-secret session state and do not invoke adapters or storage.

## Verification And Rollback

- Component tests cover empty and synthetic-result states, state relationships, pointer/keyboard parity, focus continuity, stable labels, and Chinese/English initial/live switch.
- Service mocks assert zero provider/storage calls during semantic and localization interactions and exact existing feedback/session callbacks where activated.
- Browser verification reuses the empty-state fixture and synthetic local data only. Compact/theme claims remain blocked until the existing browser limitation is removed.
- Rollback removes F-22 content semantics/keys/tests together. No tolerant read, migration, cache deletion, or persisted-data rollback is needed.
