# F-13 media-library visible-open freshness diagnostics

Date: 2026-07-30 (Asia/Shanghai)

## Boundary and classification

**User scenario**: the user closes the media library after a successful load, a generation task and its unified-cache metadata commit during the next eight seconds, and the user reopens the library expecting the committed result to be listed.

**In scope**: the persistent `AssetProvider`, conditional media-library modal mount, `loadAssets` single-flight/TTL boundary, local asset/task/unified-cache readers, Context-owned upload projection, task completion persistence/event emission, cache notification, closed-to-open behavior, failure retry and source-read cost. **Out of scope**: whether multi-store writes commit truthfully (`ensure-media-library-write-consistency`), selection callback semantics, window geometry, asset merging/filtering changes, live polling while an already-open library remains visible, provider execution and cross-tab push notifications.

**Classification**: the former hypothesis `F13-LOAD-TTL-STALE-HYP-001` is superseded by confirmed issue `F13-LOAD-TTL-STALE-002`. Evidence is strong for the deterministic same-provider/task-cache/reopen sequence and source-read suppression. Real-browser frequency, actual IndexedDB latency at scale, live-open product intent and cross-tab notification behavior remain unmeasured or unspecified.

**Approval gate**: changing visible freshness or storage-read semantics requires approval. `refresh-media-library-projection-on-open` has been created with 3 requirements, 6 scenarios and 20 tasks, 4 evidence tasks checked. No runtime or permanent-test implementation has been made.

## Complete call chain

### Forward trace

1. Drawnix mounts one persistent `AssetProvider` around the application at `packages/drawnix/src/drawnix.tsx:869-936`.
2. `DrawnixDeferredFeatures` mounts `MediaLibraryModal` only while `mediaLibraryOpen` is true at `packages/drawnix/src/components/startup/DrawnixDeferredFeatures.tsx:121-133`. Closing/remounting the modal therefore does not reset provider refs.
3. On each false-to-true modal open, `MediaLibraryModal.tsx:71-77` calls `loadAssets()` and `checkStorageQuota()`.
4. `AssetContext.tsx:766-775` first reuses an in-flight promise. If none exists, `:767-779` computes the age of the last successful load and returns when it is below `LOAD_ASSETS_CACHE_TTL_MS=8000` (`:74`). This return happens before any durable-source read or loading/error state change.
5. An eligible load reads localForage local assets (`:787-788`), completed/archived asset tasks from IndexedDB (`:790-800`) and unified-cache IndexedDB metadata (`:802-807`), then merges source metadata, groups local duplicates, preserves AI results, sorts by `createdAt`, writes React `assets`, advances `lastSuccessfulLoadRef`, and publishes the global map (`:808-897`).
6. `MediaLibraryGrid` consumes the Context projection through its existing filters and renders `AssetItem` cards. The card count therefore cannot include a record that never reached `assets`.

### External writer and reverse trace

1. Task execution reaches a completed `Task` in `task-queue-service.ts:834-864`; `persistTask()` starts `persistTaskInternal`, whose durable write settles before `taskStorageReader.invalidateCache()` at `:472-484`. The service emits `taskUpdated` at `:865`.
2. Media cache writers store Cache API data and unified IndexedDB metadata; `unified-cache-service.ts:1301-1318` notifies process-local listeners after `putItem()` succeeds.
3. Reverse search from `AssetContext` finds no `observeTaskUpdates`, `subscribe`, visibility, focus, storage-event or BroadcastChannel registration. The cache hook on an already-rendered individual card subscribes at `useUnifiedCache.ts:39-45`, but it cannot create a missing asset card.
4. The local Context upload path is a negative control: `AssetContext.addAsset()` awaits the storage service and directly calls `setAssets(prev => mergeVisibleAsset(prev, asset))` at `AssetContext.tsx:1022-1076`. It does not need a reopen read to appear in the same provider.
5. Reverse trace from the missing card therefore terminates at the TTL return: neither the task event nor the cache notification writes the merged asset projection, and the next modal open invokes the suppressed cached load.

### Types, state, side effects and recovery

- Input: `loadAssets(): Promise<void>` has no current freshness parameter. Modal open has `isOpen:boolean`; durable readers return `Asset[]`, `AssetTaskRecord[]` and `CachedMedia[]`.
- Output: React `assets`, global `Map<assetId, Asset>` and `idle/loading/ready/error` projection status.
- State owners: provider owns `assets`, loading/error, filters/selection, `loadAssetsPromiseRef`, and `lastSuccessfulLoadRef`; local/task/cache services own their separate durable records.
- Defaults/conversion: TTL is 8,000 ms; task records become one or more `Asset` values; source-specific metadata is merged before descending `createdAt` sort.
- Concurrency: one in-flight promise is shared. The confirmed issue occurs after that promise settles and before TTL expiry, not during overlapping loads.
- Timeout/cancel/retry: asset loading has no abort/timeout. A failed load leaves `lastSuccessfulLoadRef` unchanged; current cached opens can still return until its old success ages out. The proposal makes closed-to-open failure retry explicit without adding automatic retry.
- Persistence/cache: no schema or key change is proposed. The TTL is in-memory only and is lost on full page refresh; modal remount is insufficient because the provider persists.
- Offline/multi-tab: a full page refresh rebuilds from available local stores. Relevant services expose no asset-projection BroadcastChannel/storage-event path. A second-tab commit followed by visible open is included in approval-time tests; no current cross-tab frequency claim is made.
- Errors/privacy: source failures use the existing Context error, message and console paths. The diagnostic used synthetic IDs/URLs and no network, provider, user file, credential or real storage.

## [F13-LOAD-TTL-STALE-002]

**Status**: confirmed correctness/UX defect; implementation blocked by `refresh-media-library-projection-on-open` approval.

**User impact**: a committed generation result can be absent when the user quickly reopens the media library. In the controlled one-second sequence it remained absent for the remaining seven seconds of the reuse window unless another eligible load occurred. The result exists in task/cache storage but the visible library communicates an older snapshot without a loading or stale indication.

**Reproduction**:

1. Mount the real `AssetProvider` with deterministic mocked local/task/unified-cache readers and a Context probe.
2. Set `Date.now()` to 10,000 ms; let initialization finish with all three sources empty.
3. At 11,000 ms, add one completed image task and matching unified-cache metadata to the mocked durable sources.
4. Deliver every registered unified-cache listener, then call the Context `loadAssets()` exactly as the modal-open effect does.
5. Record source-read counts and final `assets`.
6. Advance time to 18,001 ms and call the same operation again.

**Current versus expected**: after step 4 the current projection remained empty and source reads remained at their initial counts. After step 6 it contained the task and each source had been read twice. Expected behavior for the candidate contract is that data committed before a closed-to-open load begins is reflected in that open's settled projection; background callers may retain scoped reuse.

**Raw evidence**:

| Checkpoint | Clock | Local reads | Task reads | Cache reads | Visible assets | Cache subscribers owned by provider |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Initial successful load | 10,000 ms | 1 | 1 | 1 | 0 | 0 |
| Committed task/cache + notification + reopen | 11,000 ms | 1 | 1 | 1 | 0 | 0 |
| Reopen after successful-load age reached 8,001 ms | 18,001 ms | 2 | 2 | 2 | 1 (`task-new`) | 0 |

Command: fixed bundled Node on the repository Drawnix test target, `pnpm --dir packages/drawnix test src/contexts/AssetContext.ttl.diagnostic.test.tsx`. Exit 0; 1/1 file, 1/1 test, test 87 ms, Vitest total 2.00 s, wall 3.30 s. The temporary test was removed immediately after recording the result.

**Root cause**: the same unqualified `loadAssets()` API serves persistent-provider background reuse and a user-visible modal-open freshness boundary. Its eight-second success timestamp has no source generation/invalidation and external writers do not update the merged projection.

**Impact range**: confirmed for task/cache records committed outside `AssetContext.addAsset` and the next reopen in the same provider. The static chain applies to any durable writer that does not directly update `assets`. Direct Context upload is excluded. Already-open live refresh, occurrence frequency, and cross-tab delivery are not included in the confirmed claim.

**Evidence strength**: high for source and deterministic controlled behavior; unknown for production frequency and IndexedDB-scale performance.

**Candidate solution**: add a scoped visible-open freshness intent to the existing load owner. Evaluate/share the in-flight promise first, bypass the success-age return for a real closed-to-open transition, preserve ordinary background TTL reuse, and advance the success timestamp only after merge success.

**Alternatives**: global TTL removal expands unmeasured reads; cache-only subscription misses task/local writes and can reload on metadata churn; task-event payload projection can precede durable commit; polling adds an unapproved live feature; provider remount discards shared state. None is selected.

**Risks**: extra three-source reads on each real reopen, StrictMode/effect duplication, initialization/open snapshot timing, and failure over a usable old projection. The design limits reads to one wave, preserves prior cards, and defines an approval-time five-sample 0/100/1,000-asset browser matrix. If 1,000 assets exceed 250 ms median or any 50 ms browser long task appears, implementation stops for a separate measured optimization decision rather than weakening freshness.

**Validation**: permanent red/green provider and modal tests for task/cache/local records, overlap, StrictMode, source-read counts, failure/retry and external-writer equivalence; browser same-state card evidence; desktop/tablet/compact, themes/locales; Drawnix/full gates; rewalk refresh/offline/multi-tab boundaries. No performance improvement will be claimed without before/after raw values.

**Rollback**: remove the scoped freshness input, modal call and focused tests. No data/cache/schema migration or cleanup is required; the prior stale reopen behavior returns.

## Remaining hypotheses and blockers

- An already-open library has no automatic writer for a newly committed task/cache card. This absence is statically confirmed, but whether existing product behavior promises live appearance without close/reopen is unspecified; it is not folded into the approved-open candidate.
- Task events are emitted after starting fire-and-forget persistence, not after the caller awaits a public durable settlement. Using those events as an authority would overlap `ensure-media-library-write-consistency` and needs a separate contract.
- Actual IndexedDB/Cache API costs at 0/100/1,000 items have not been measured in a browser. The 87 ms unit case is test duration, not product-load performance.
- OpenSpec CLI remains unavailable (`openspec validate refresh-media-library-projection-on-open --strict` exit 127). Manual structure is 3 requirements, 6 scenarios, 6 WHEN, 6 THEN, 20 tasks/4 checked; all three requirement names are unique across formal and active specs. The `media-library` capability deliberately has four focused active changes whose ownership is separated above.
