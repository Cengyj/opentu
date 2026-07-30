# Change: Ensure toolbar configuration write consistency

## Why

Removing, restoring, reordering, or resetting toolbar controls updates the shared React configuration immediately, while the IndexedDB write is fire-and-forget and catches failures internally. A failed write therefore leaves the current page showing a configuration that refresh cannot restore, and no caller can show a failure or retry it. The normal path was separately verified: removing the pen persisted across refresh, and resetting from the shape context menu restored it across a second refresh.

Changing the interactive commit/failure contract is user-observable and requires approval.

## What Changes

- Give existing toolbar configuration mutations an awaitable IndexedDB commit result.
- Preserve the last durable toolbar configuration when a write fails; do not silently present a failed mutation as saved.
- Surface one localized, retryable failure outcome from existing toolbar context/More-panel actions while preserving the user's prior durable layout.
- Keep button IDs, order representation, visibility semantics, version/migration behavior, default layout, and storage key/schema unchanged.
- Limit this change to one sequential interactive success/failure outcome; the now-confirmed overlapping-write ordering race is owned by the independent `preserve-toolbar-config-mutation-order` approval change.

## Impact

- Affected specs: `toolbar-configuration` (new delta)
- Affected code: `toolbar-config-service.ts`, `use-toolbar-config.tsx`, toolbar context menu/More panel callers, focused tests
- Adjacent changes: overlapping accepted-order semantics belong to `preserve-toolbar-config-mutation-order`; accessibility behavior belongs to `improve-settings-toolbar-accessibility`; visual tokens belong to `update-ui-color-system`
- Data/migration impact: none; the existing IndexedDB key and `ToolbarConfig` shape remain unchanged
- Rollback: restore synchronous optimistic methods and remove failure UI/tests; no migration is required, but false-success behavior returns

## Evidence

- `packages/drawnix/src/services/toolbar-config-service.ts:135-220` mutates the in-memory configuration, calls a void `saveToStorage`, and catches IndexedDB rejection only to `console.error`.
- `packages/drawnix/src/hooks/use-toolbar-config.tsx:110-150` immediately publishes each returned configuration and exposes only void mutation methods, so callers have no failure branch.
- Reachable callers include `toolbar-context-menu.tsx:89-130`, `more-tools-button.tsx:454-457`, and `creation-toolbar.tsx:252-260`.
- Controlled Chromium at 1280×720 verified the success path: pen visible count 1→0 after remove and remained 0 after refresh; shape→reset restored count 1 and it remained 1 after a second refresh.
- `settings-dialog.tsx:1126-1144` is an in-project contrast for an existing setting: direct persistence failure restores UI and displays retry feedback.
- A controlled deferred-write diagnostic subsequently completed the second toolbar write before the first: current state retained the newer visible candidate, while the durable record and fresh initialization restored the older hidden candidate (1/1, exit 0). That confirmed race remains explicitly excluded here and is documented under `preserve-toolbar-config-mutation-order`.

## Approval

Implementation is blocked until the user approves awaitable durable toolbar mutations and rollback/retry feedback for failed writes.
