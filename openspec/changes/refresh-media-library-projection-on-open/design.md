## Context

`AssetProvider` is mounted for the Drawnix lifetime. Its projection merges localForage asset records, terminal task records, and unified-cache IndexedDB metadata. `MediaLibraryModal` is mounted only while open and currently invokes the same TTL-qualified `loadAssets()` used by provider initialization. That makes the provider timestamp, rather than the user's visible-open intent, decide whether a newly committed external result is discoverable.

The current `loadAssetsPromiseRef` correctly prevents overlapping read/merge waves. The issue is not concurrent duplication: the TTL guard follows the in-flight check and suppresses a later visible reopen even though a writer outside `AssetContext.addAsset()` has committed new source data.

There is no cross-store browser transaction and no existing settled projection-change event shared by localForage, task storage and unified-cache metadata. This change must not invent a general event bus or treat a task event emitted before its fire-and-forget persistence settles as proof of durable commit.

## Goals / Non-Goals

- Goals:
  - Make the next visible media-library open reflect all source writes that committed before that open.
  - Preserve one in-flight load owner and avoid effect/render-driven duplicate reads.
  - Preserve the last usable projection on read failure and allow the next open to retry.
  - Measure the read/merge cost before and after under controlled asset counts.
- Non-Goals:
  - Add live polling or a new background synchronization feature while the library stays open.
  - Define when a task/cache/local multi-store operation is committed; that belongs to `ensure-media-library-write-consistency` and existing task storage.
  - Add cross-tab push notifications, service-worker task execution, or a general storage event bus.
  - Change asset merging, deduplication, sorting, filtering, selection, cache availability, deletion, or subject metadata semantics.

## Decisions

- Add a scoped freshness intent to the existing load operation rather than deleting the TTL globally. Provider initialization/background callers retain the current reuse path; the modal's false-to-true open transition requests current durable data.
- Evaluate the in-flight promise before freshness. If initialization is already reading the sources when the modal opens, the visible request awaits that same operation. It must not launch a second wave solely because it is marked visible.
- Bind the visible request to a closed-to-open transition. React rerenders, filter changes, selection changes, StrictMode effect replay, and an unchanged `isOpen=true` must not cause repeated source reads.
- A successful source merge is the only operation that advances the successful-load timestamp. A rejected visible refresh preserves the prior `assets` array, exposes the existing error path, and leaves the next open eligible to read again.
- Do not subscribe `AssetContext` directly to the task queue for this fix. Current task events can precede durable persistence settlement, and projecting the event payload would create a second authority and overlap the pending write-consistency change.
- Do not use unified-cache notifications alone as the freshness owner. They do not cover localForage-only or task-only writes and would make cache metadata churn trigger full three-source reloads.

## Alternatives Considered

- Remove the eight-second cache from every `loadAssets()` caller.
  - Rejected because only visible-open staleness is confirmed; widening all background read semantics has no evidence or measurement.
- Subscribe to every unified-cache notification and immediately reload all sources.
  - Rejected because cache listeners are process-local, do not cover every source, and can fire for updates to already visible cards.
- Subscribe to task completion and merge its event payload directly into React state.
  - Rejected because the current event can be emitted before fire-and-forget storage persistence settles, which would expose a card not yet recoverable after refresh.
- Poll while the library is open.
  - Rejected because no live-refresh requirement or storage-read budget has been established.
- Remount `AssetProvider` with the modal.
  - Rejected because the provider also supplies independent canvas/tool roots and remounting would discard shared selection/filter/projection state.

## Risks / Trade-offs

- Every real reopen performs one local/task/cache read wave even when no source changed. Measure five reopen samples each at 0, 100 and 1,000 projected assets in an isolated browser origin, recording source reads, open-to-ready latency, main-thread long tasks and React commits.
- An initialization load may have started before a writer committed. Sharing that operation is correct for its snapshot but could still miss the later commit. The focused overlap fixture must place commits before and after the read boundary and document the invariant; do not claim discovery of writes that commit after the visible-open snapshot begins.
- StrictMode or modal lifecycle changes could call the effect twice. Test source-read counts, not only final cards.
- A forced read can fail while a valid older projection exists. Preserve the old cards and current error feedback; do not clear the projection or delete data.

## Acceptance Thresholds

- Correctness: a task/cache/local source record committed before a closed-to-open load begins appears in that open's settled projection; no stale-TTL early return is allowed for that transition.
- Concurrency: at most one local/task/cache read wave is in flight; initialization/open overlap and duplicate effect delivery settle from one wave.
- Failure: zero data deletion, the prior projection remains readable, and the next closed-to-open transition performs a new attempt.
- Performance: exactly one source read per source for a non-overlapping reopen; five raw samples at 0/100/1,000 assets must be retained. If the 1,000-asset median open-to-ready exceeds 250 ms or produces a browser long task of 50 ms or more, implementation pauses for a separately approved optimization instead of weakening freshness.
- Visual/UX: no intentional layout or styling change. Before/after card-state evidence uses the same viewport, theme and fixture; the only accepted visual delta is the committed card becoming present on the first reopened settled state.

## Rollback

Revert the scoped freshness input, modal call and focused tests together. No serialized data, Cache API entry, task record, localForage record, selection, or board element needs migration or cleanup. The old TTL-based visible reopen behavior will return.
