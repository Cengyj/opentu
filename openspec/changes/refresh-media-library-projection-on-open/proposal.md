# Change: Refresh the media-library projection on each visible open

## Why

`AssetProvider` keeps its last successful merged projection for eight seconds. The provider outlives the conditionally mounted media-library modal, and a modal open calls the same cached `loadAssets()` operation. A controlled current-source diagnostic loaded an empty projection, committed a completed task plus matching unified-cache metadata one second later, and simulated the cache notification and next modal open. The second call returned before reading local assets, task storage, or unified-cache metadata, so the library remained empty. Only after the successful-load age exceeded eight seconds did all three sources get read and the task card appear.

This is not the local-upload path: `AssetContext.addAsset()` writes the returned asset directly into the current React projection. The confirmed stale path is a task/cache or other durable writer that does not use that Context action. `AssetContext` subscribes to neither task updates nor unified-cache changes, and modal close/open remounts only `MediaLibraryModal`; the enclosing provider and its timestamp remain mounted.

The diagnostic ran under Node 24.14.0, Vitest 3.2.4 and jsdom. It exited 0 with 1/1 file and 1/1 test in 87 ms (2.00 s total). Source-read counts were `1/1/1` after the first load, remained `1/1/1` after the one-second write and reopen, then became `2/2/2` after the age reached 8,001 ms. Visible counts were `0`, `0`, then `1`. The temporary diagnostic test was removed because it asserted the defective behavior.

Bypassing or invalidating the cache changes visible freshness and storage-read semantics, so implementation requires approval.

## What Changes

- Treat a closed-to-open media-library transition as a freshness boundary: once local/task/cache writes have committed, the next visible open reads the current durable sources instead of accepting an unqualified projection solely because it is less than eight seconds old.
- Keep `AssetProvider` startup/background reuse separate from visible-open freshness so unrelated consumers do not acquire a polling loop or unconditional repeated reads.
- Preserve the existing in-flight single-flight owner: an initialization load and visible-open request that overlap share one read/merge operation, and repeated renders while the modal remains open do not start additional loads.
- Preserve direct local-upload projection updates, source ordering, deduplication, sorting, cache keys, task and asset schemas, error messages, and the last usable asset list when a refresh fails.
- Make a failed visible refresh retryable on the next closed-to-open transition; do not stamp a failed attempt as a successful fresh projection.
- Add focused freshness, overlap, failure/retry, and unmount tests plus five-sample browser measurements for empty, ordinary, and large local fixtures before selecting the final scoped load option/invalidation implementation.

## Impact

- Affected specs: `media-library`
- Affected code: `packages/drawnix/src/contexts/AssetContext.tsx`, `packages/drawnix/src/components/media-library/MediaLibraryModal.tsx`, asset context/modal focused tests, and media-library performance evidence
- Related active changes: `ensure-media-library-write-consistency` owns whether a multi-store write is committed and truthful; this change acts only after that boundary and does not compensate or reorder writes. `fix-media-library-selection-contract` owns invocation constraints and callback completion. `fix-media-library-responsive-interaction` owns window geometry and mobile details. None owns visible-open projection freshness.
- Preserved data/API semantics: no asset/task/cache key or schema, migration, provider route, canvas element, playlist, filter, selection, or remote-sync format change
- Rollback: remove the visible-open freshness intent and its tests and restore the current cached `loadAssets()` call. No data migration or cache cleanup is required; the confirmed up-to-eight-second stale reopen behavior returns.

## Evidence

- `packages/drawnix/src/contexts/AssetContext.tsx:74,766-779` defines the eight-second TTL and returns before source reads.
- `packages/drawnix/src/contexts/AssetContext.tsx:787-897` reads and merges local assets, completed task records, and unified-cache metadata only after that guard.
- `packages/drawnix/src/contexts/AssetContext.tsx:1022-1076` directly updates the current projection for Context-owned local uploads, delimiting the confirmed issue.
- `packages/drawnix/src/components/media-library/MediaLibraryModal.tsx:71-77` calls cached `loadAssets()` on open without a freshness intent.
- `packages/drawnix/src/components/startup/DrawnixDeferredFeatures.tsx:121-133` conditionally mounts the modal, while `packages/drawnix/src/drawnix.tsx:869-936` keeps `AssetProvider` mounted outside it.
- `packages/drawnix/src/services/unified-cache-service.ts:1301-1318,1445-1468` notifies process-local listeners after metadata writes, but `AssetContext` has no subscription.
- `packages/drawnix/src/services/task-queue-service.ts:478-484,834-866` persists a completed task, invalidates the reader cache, and emits task events; no reverse caller connects those events to the asset projection.
- Controlled raw results and the precise test fixture are recorded in `docs/evidence/f13-media-library/ttl-diagnostics.md` and `ttl-metrics.json`.
