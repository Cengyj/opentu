## Context

`AudioPlaylistService` owns two localForage stores in the same named database: playlist metadata and per-playlist item arrays. Public mutations are async but independent; React Context reloads metadata/items after each mutation. Environment backup exports/restores the two durable stores. There is no mutation queue, transaction owner, recovery record, or reload generation.

## Goals / Non-Goals

- Goals: no within-runtime lost updates or duplicate-name races, truthful success/failure across both stores, deterministic recovery from interrupted/failed two-store writes, and no stale UI projection.
- Non-Goals: no new playlist feature, sharing/export UI, ordering UI, cross-tab distributed lock, cloud sync, asset-deletion ownership change, task/media migration, or legacy-store deletion.

## Decisions

- Use one service mutation chain for create/rename/delete/add/remove/favorite and cleanup operations. Every uniqueness check and read-modify-write happens inside that chain against the latest completed mutation.
- Add a private `audio_playlist_operations` localForage store. A journal record contains an operation ID, target playlist, privacy-safe operation kind, before/after metadata and item snapshots, phase (`prepared` or `committed`), and timestamp; it contains no media URL, prompt, credential, provider body, or arbitrary UI error.
- Operation sequence: write `prepared`; apply metadata/items in a deterministic order; write `committed`; only then resolve success; remove the committed journal record. Failure before commitment restores the before snapshots and retains a recoverable record if cleanup cannot finish.
- Initialization recovers journal entries before ensuring favorites or serving reads: `prepared` converges to before state; `committed` converges to after state; verified entries are removed. Re-running recovery is idempotent.
- The private journal is not user playlist content and is not exported. Replace restore clears it before importing the existing metadata/item backup; initialization then recreates/validates favorites. Existing v2/v3/v4 backup compatibility and the two exported fields remain unchanged.
- Give `loadPlaylists` a monotonically increasing request ID and apply collections/errors/loading only for the current load. Serialized mutations still reload through the same owner.

## Invariants

- A resolved mutation is present in both durable stores; a rejected mutation converges to its before state or remains explicitly recoverable instead of being reported as success.
- Two mutations accepted by one service runtime are applied in acceptance order; neither uses a snapshot older than the preceding committed mutation.
- Custom playlist names remain unique under concurrent calls in one service runtime.
- Favorites ID/system behavior, playlist and item record shapes, list ordering, asset/note reference semantics, active playback queues, and backup fields remain compatible.
- `ensure-media-library-write-consistency` continues to own cleanup only after committed asset deletion; this change owns the playlist mutation/recovery mechanism it calls.

## Risks / Trade-offs

- Serializing all playlist mutations can increase burst latency; correctness is primary and five-run latency/queue-depth data must report the cost.
- Journal snapshots duplicate one playlist's items temporarily and can increase write volume for large lists; size and recovery time require measurement.
- Browser termination at every phase must be tested; an incorrect phase transition could roll back a committed user action or retain stale recovery records.
- This design fixes only proven single-runtime races. Cross-tab simultaneous mutation remains unknown and must not be claimed as solved without a separate reproduction/coordination proposal.

## Verification And Rollback

- Mock/fake-IDB tests cover concurrent create/rename/add/remove/favorite, duplicates, every store/journal write failure, rollback failure, prepared/committed startup recovery, idempotence, favorites, cleanup, and backup replace clear.
- React tests cover reverse reload completion, overlapping mutations, success/error messages, latest loading/error, unmount, and both music-player/media-library consumers.
- Browser uses isolated synthetic playlists/assets only and checks create/rename/delete/add/remove/favorite, failure/retry/reload/restore without provider calls.
- Before rollback, run recovery until no prepared/committed journal remains; then remove the new store use/coordinator/context owner/tests. Existing metadata/item stores require no migration or deletion.
