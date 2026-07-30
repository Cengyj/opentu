## Context

`ToolbarConfigService` owns one in-memory `ToolbarConfig` and persists the whole object through `kvStorageService`. The provider exposes synchronous void operations, so context-menu, drag, and More-panel callers cannot observe persistence. Initialization already has a separate async path and falls back to defaults on read failure; this change focuses on user-initiated mutations after readiness.

## Goals / Non-Goals

- Goals: make an interactive mutation's durable outcome observable, keep UI and durable state consistent after failure, provide retry feedback, and preserve the current data format.
- Non-Goals: new toolbar controls, toolbar redesign, cross-tab synchronization, a new storage engine, migration/version changes, accessibility wiring, or the confirmed overlapping-write ordering state machine now owned by `preserve-toolbar-config-mutation-order`.

## Decisions

- After initialization, each interactive service method prepares a candidate from the last committed configuration and returns an awaitable result.
- Publish the candidate to the shared context only after `kvStorageService.set` succeeds. On rejection, retain the last committed configuration and return a bounded safe failure; callers show localized retry feedback.
- Keep drag/reorder pointer behavior and button actions disabled or pending only for the operation whose durable outcome is unresolved; exact pending presentation must reuse existing toolbar patterns and be verified before implementation.
- The failure error must not include serialized toolbar contents, board data, settings/provider values, URLs, credentials, or internal storage payloads.
- Do not add a mutation queue in this change. The controlled diagnostic confirmed reverse durable order, and the separate `preserve-toolbar-config-mutation-order` change owns any domain-local sequencing after independent approval.

## Invariants

- `TOOLBAR_CONFIG_VERSION`, storage key, button IDs, visibility/order rules, migration, and default layout remain compatible.
- A successful user action produces the same toolbar configuration and persists it once.
- A failed user action does not replace the last durable/shared configuration or claim success.
- Initialization fallback behavior and unrelated board/settings storage remain unchanged.

## Risks / Trade-offs

- Persist-before-publish adds storage latency to visible toolbar changes. Measure five sequential mutations before/after; do not claim acceptable latency without data.
- Callers currently typed as void must be updated together to avoid floating promises or duplicate feedback.
- Drag gestures can emit frequent reorder intents; focused profiling must confirm the actual call frequency before choosing pending UI or coalescing.

## Verification And Rollback

- Add service/provider tests for sequential remove/show/reorder/reset success, each write failure, retry, unchanged committed state, and safe errors.
- Keep the completed overlapping-write diagnostic and its separately proposed ordering owner synchronized without broadening this sequential failure contract.
- Browser checks remove/reset/reorder from context and More panel, inject one storage failure, verify feedback/refresh, and repeat success operations at least five times for latency.
- Rollback restores the synchronous methods and caller types/tests. No data migration or cache cleanup is needed.
