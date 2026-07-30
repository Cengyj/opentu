# Change: Preserve toolbar configuration mutation order

## Why

Toolbar visibility, order, and reset actions each persist the entire `ToolbarConfig` through an independent fire-and-forget promise. The shared service has no accepted-operation sequence owner. A controlled deferred-write diagnostic accepted “hide freehand” and then “show freehand”, completed the newer write first and the older write last, and deterministically produced a split: the current in-memory configuration showed freehand, while the durable record and a fresh `initializeAsync()` restored it as hidden.

The existing `ensure-toolbar-config-write-consistency` change intentionally owns only one sequential mutation's success/failure contract. Preserving intent across overlapping mutations changes execution and recovery semantics and therefore requires a separate approval.

## What Changes

- Preserve the acceptance order of overlapping existing toolbar visibility, reorder, show/hide, and reset operations.
- Serialize only this domain's semantic mutations so each candidate is derived from the last successfully committed toolbar configuration, not from a stale whole-record snapshot.
- Let a failed operation report its existing bounded failure outcome without poisoning later accepted operations; successful later operations continue from the last durable configuration.
- Keep the current storage key, `ToolbarConfig` shape/version, button IDs, default layout, migration, and single-tab UI actions compatible.
- Do not add a repository-wide write queue, cross-tab locking, mutation coalescing, unload durability, new toolbar actions, or a storage-engine migration.

## Impact

- Affected specs: `toolbar-configuration` (new delta requirement)
- Affected code: `toolbar-config-service.ts`, `use-toolbar-config.tsx`, existing toolbar mutation callers, focused tests
- Dependency: implementation requires the separately approved awaitable outcome contract in `ensure-toolbar-config-write-consistency`; this change does not absorb its sequential rejection/feedback ownership
- Data/migration impact: none; the existing IndexedDB key and serialized record remain compatible
- Risk: serial commits can increase visible latency for bursty actions, so five-operation timing and pending-state continuity must be measured before acceptance
- Rollback: remove the domain-local sequencing and overlap tests; no data cleanup is needed, but out-of-order durability becomes possible again

## Evidence

- `toolbar-config-service.ts:135-220` replaces the in-memory whole record for every mutation and starts an independent `kvStorageService.set` without returning or sequencing it.
- `use-toolbar-config.tsx:110-150` immediately publishes every candidate; context menu, More panel, and drag-drop have no pending-operation owner.
- `use-drag-sort.ts:159-188` emits one reorder per drop, but a later drop or another toolbar action is not gated on the prior write. The service is also exported from both package entrypoints.
- Controlled Vitest diagnostic, fixed Node 24.14.0/jsdom: 1/1 test passed, exit 0, test 6 ms, Vitest 1.20 s/process 1.69 s. Reversing two deferred `kvStorageService.set` completions left current `freehand.visible=true`, durable `false`, and fresh initialization `false`.
- The temporary diagnostic file was removed after capture. No runtime code, persistent browser data, or user toolbar configuration was changed.
- Actual Chromium IndexedDB incidence/frequency was not measured and is not claimed; the evidence proves the current service contract is vulnerable when its asynchronous boundary legally settles out of acceptance order.

## Approval

Implementation is blocked until the user approves domain-local toolbar mutation sequencing and its interaction with the separately proposed durable outcome/pending feedback contract.
