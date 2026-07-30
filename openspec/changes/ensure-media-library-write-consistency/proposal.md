# Change: Keep media-library writes consistent across metadata, cache, and canvas projections

## Why

Local media assets span at least two durable stores: localForage asset metadata and unified cache metadata/Cache API media. Deletion additionally updates canvas elements, playlists, task records, and React projections. Controlled failures at the current source confirmed that these writes do not share a truthful commit boundary:

- after `cacheMediaFromBlob` fulfilled, a rejected localForage `setItem` made add report failure but issued no cache compensation;
- after cache deletion fulfilled, a rejected metadata `removeItem` made remove report failure while the metadata record remained and its media had already been removed;
- with Cache API available and returning zero entries, `getAllAssets` still returned `/asset-library/` metadata because it only filters missing media when the valid-cache set is non-empty.

The diagnostic Vitest run used deterministic localForage/unified-cache/Cache API mocks under Node 24.14.0, Vitest 3.2.4, and jsdom. It exited 0 with 1/1 file and 3/3 diagnostic cases in 17 ms. The temporary diagnostic file was then removed because its assertions describe defective behavior, not the desired long-term contract.

Static reverse tracing found the same commit-boundary problem in user actions: single and batch delete remove canvas elements before durable asset deletion; partial batch failures still remove every requested dedupe group from React state and the grid clears selection because `removeAssets` resolves after warning. Subject metadata writes cache first, ignores `updateCachedMedia=false`, and can report a failed authoritative write after the cache projection has already changed.

These changes alter cache, deletion, partial-success, and recovery semantics, so implementation requires approval.

## What Changes

- Define an authoritative commit boundary for local upload, single/batch delete, and subject metadata based on asset source, with compensation or truthful partial results when another store fails.
- Do not expose a newly uploaded local asset as successful unless its media and authoritative metadata are both readable; clean only newly created, unreferenced partial cache entries on failure.
- Do not remove canvas elements or clear failed selections before the corresponding asset deletion commits. Batch deletion returns per-asset outcomes so successful items can be removed while failed items remain visible, selected, and retryable.
- Reconcile deduplicated local groups from actual remaining records instead of hiding an entire group solely because its dedupe key appeared in the request.
- Treat unified-cache-only metadata update returning `false` as failure; update local/task authoritative metadata before committing the React subject projection and reconcile cache metadata without reporting a false success.
- Distinguish an available-but-empty Cache API from an unavailable/failed Cache API. Do not display metadata as a usable local asset when its required media is confirmed absent, and do not delete metadata merely because cache availability is unknown.
- Preserve existing asset/task schemas and keys, content hashes, canvas element schemas, provider routes, and cache-warning no-cross-origin-fetch requirement.

## Impact

- Affected specs: `media-library`, related cache-warning behavior remains preserved
- Affected code: `asset-storage-service.ts`, `unified-cache-service.ts` where compensation is required, `character-asset-metadata-service.ts`, `AssetContext.tsx`, `MediaLibraryModal.tsx`, `MediaLibraryGrid.tsx`, playlist cleanup/read projection, and focused failure/recovery tests
- Related active changes: `update-video-character-asset-reuse` defines subject metadata and remains the product contract; this change only makes its existing writes truthful. `media-cache-warnings` forbids per-item cross-origin fetches and remains unchanged. `fix-media-library-selection-contract` owns insertion callback completion, not asset delete/upload transactions.
- Preserved data/API semantics: no new asset/task/cache key, serialized schema, migration version, provider request, canvas layout, or remote synchronization format
- Rollback: restore prior write ordering/projections and remove result/compensation tests; no migration is required, but any partial records produced before or after rollback must continue to be handled by the read reconciliation path

## Evidence

- `packages/drawnix/src/services/asset-storage-service.ts:332-374` writes unified cache/media before localForage metadata and has no rollback in `:387-405`.
- `packages/drawnix/src/services/unified-cache-service.ts:1251-1318` writes Cache API before unified IndexedDB metadata and throws without Cache API compensation if the later write fails.
- `packages/drawnix/src/services/asset-storage-service.ts:426-457` initializes `validCacheUrls` to an empty set and filters missing local media only when `validCacheUrls.size > 0`, conflating readable-empty with unavailable.
- `packages/drawnix/src/services/asset-storage-service.ts:584-613` deletes unified cache before local metadata.
- `packages/drawnix/src/components/media-library/MediaLibraryModal.tsx:322-341` and `MediaLibraryGrid.tsx:921-960` remove canvas elements before awaited single/batch asset deletion.
- `packages/drawnix/src/contexts/AssetContext.tsx:1211-1390` settles per-record deletion but removes every asset whose dedupe key is in `localDedupeKeys`, independent of failed record IDs, and resolves after partial-error warning.
- `packages/drawnix/src/services/character-asset-metadata-service.ts:23-57` writes cache metadata first, ignores the boolean result, then writes task/local metadata; `AssetContext.tsx:1471-1518` commits the React subject projection only after that function returns but cannot undo its earlier partial cache write.
- Controlled raw assertions: add failure → `cacheMediaFromBlob=1`, `deleteCache=0`; remove failure → `deleteCache(url)=1`, `removeItem(id)=1`, metadata fixture still readable; available Cache API `keys=[]` → `getAllAssets()` returned the stored asset.
