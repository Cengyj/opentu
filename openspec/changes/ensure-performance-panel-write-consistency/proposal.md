# Change: Ensure performance-panel write consistency

## Why

Performance-panel pin and position mutations update React state even when their shared localStorage write throws. A controlled quota-failure diagnostic started from durable `pinned: true`; after unpin, the UI showed unpinned while localStorage still contained `pinned: true`, so refresh would restore the opposite state.

Changing durable commit, rollback, drag-save, and failure feedback semantics is user-observable and requires approval.

## What Changes

- Commit pin/unpin state only when the existing localStorage record accepts the write; otherwise retain the last durable UI state and show localized retry guidance.
- Keep drag position transient while the pointer moves, then persist once at drag end; on failure restore the last durable position and show one non-repeating retryable outcome.
- Maintain an explicit last-durable snapshot so a rejected write cannot be presented as saved.
- Preserve the localStorage key/schema, default/read fallback, panel visibility thresholds, actions, pointer bounds, and component API.
- Do not add a queue, migration, cross-tab protocol, or performance claim.

## Impact

- Affected specs: `performance-panel-settings-consistency` (new delta)
- Affected code: PerformancePanel setting state/write/drag-end feedback and focused tests
- Related changes: shared settings and toolbar consistency changes own different stores/managers; performance-panel accessibility owns semantics/keyboard movement
- Data/API impact: no key/schema/migration change; pointer movement no longer performs a localStorage write for every move event
- Rollback: restore optimistic catch-and-ignore writer and per-move persistence; existing records remain compatible

## Evidence

- Reader and default: `PerformancePanel.tsx:84-104`.
- Shared writer catches failure and still returns updated React state: `:116-130`.
- Pointer movement and pin toggle call that writer: `:225-261`.
- Controlled jsdom diagnostic: 1 file/2 tests passed, exit 0; forced `QuotaExceededError` produced UI `pinned: false` with durable `pinned: true`.
- Full evidence: `docs/evidence/f27-diagnostics-observability/diagnostics.md`.

## Approval

Implementation is blocked until the user approves commit-before-publish pin behavior, drag-end position persistence, rollback, and localized retry guidance.
