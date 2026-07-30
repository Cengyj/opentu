# Change: Fix deferred version-update notification delivery

## Why

The staged Service Worker update path emits one sw-update-available DOM event, while the only consumer mounts after a five-second plus idle delay. A controlled current-component diagnostic proved that the event produces no prompt and no version fetch when emitted before mount, while the same event after mount produces the prompt. Bootstrap also suppresses repeat delivery for the same pending version, and reverse search found no replayable page state.

This is a correctness change to the existing update prompt, not a new updater. It changes when an already-ready update becomes visible, so implementation requires approval.

## What Changes

- Add one typed, page-local pending-version readiness owner at the existing bootstrap/UI boundary.
- Publish current readiness before the event notification and allow the deferred prompt to consume the current value when it mounts.
- Clear or replace the page-local value from authoritative runtime version state.
- Preserve version.json validation, active-task hiding, explicit user confirmation, waiting-worker resolution, COMMIT_UPGRADE, activation and safe reload behavior.
- Add race, deduplication, clear/replace, task, missing-worker, refresh and multi-tab tests.

## Impact

- Affected specs: version-update-notification-delivery
- Affected code: apps/web/src/app/bootstrap.tsx, the smallest typed runtime/window boundary, packages/drawnix/src/components/version-update/version-update-prompt.tsx, focused tests and flow documentation
- Preserved data/API semantics: no IndexedDB, Cache API, localStorage, sessionStorage, task, workspace, provider, public package, Service Worker message, version record or migration schema change
- User-visible result: an already-ready staged update is eventually shown even if readiness preceded the deferred UI mount
- Performance claim: none; normal-startup bootstrap bytes and delayed mount timing must be measured and must not regress the pending startup budgets

## Evidence

- apps/web/src/app/bootstrap.tsx:358-388 stores only lastPendingVersionNotified and suppresses same-version re-dispatch.
- packages/drawnix/src/drawnix.tsx:677-701 defers the non-critical UI.
- packages/drawnix/src/components/startup/DrawnixDeferredFeatures.tsx:167-170 mounts the sole consumer.
- packages/drawnix/src/components/version-update/version-update-prompt.tsx:15-73 has no mount-time replay source.
- Controlled raw result: before mount promptVisible=false/fetchCalls=0; after mount promptVisible=true/fetchCalls=1; exit 0, 2/2 tests.
- Full evidence: docs/evidence/f01-startup-recovery-ui/diagnostics.md.

## Approval Gate

Implementation is blocked until the user approves the page-local readiness lifetime, clear/replace ordering and race acceptance criteria. This change must not be implemented by moving the update UI into the initial startup graph.
