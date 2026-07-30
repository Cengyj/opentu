# Change: Define Music Analyzer Upload Cache Ownership

## Why

Music Analyzer caches an uploaded audio blob before it creates the analysis task. The only current cleanup is attached to deletion or pruning of a successfully created Music Analyzer record. If task creation throws, or analysis fails/cancels before a record is created, the cache URL has no record owner and no cleanup path.

The existing analysis executor rejects files larger than 20 MB only after it reads the cached blob. The reachable Create page therefore writes the complete oversized file first and reports the limit later. This is a deterministic ordering/ownership gap; the frequency and aggregate quota cost have not been measured, so no storage-volume claim is made.

Cleaning immediately on failed/cancelled task would break the existing task-panel retry path, while retaining every orphan forever is not an ownership contract. Size validation, retry ownership, and deletion cleanup change cache/recovery semantics and require approval.

## What Changes

- Enforce the existing 20 MB analysis limit before writing the upload cache, using one shared limit definition with the executor.
- If cache succeeds but task creation does not, remove that newly created cache entry before reporting failure.
- Treat an accepted analysis task as the cache owner while it remains retryable, including failed/cancelled terminal states.
- Transfer/retain ownership through the Music Analyzer record when task synchronization creates the source snapshot.
- When the last owning task or record is deleted/pruned, remove the cache entry; never remove a cache entry still referenced by another owner.
- Preserve task retry, record/source snapshot schemas, cache URL format, 50-record cap, and provider request semantics.

## Impact

- Affected specs: `audio-generation`
- Affected code: Music Analyzer Create page/audio-source cache/storage/task sync, task deletion/retention cleanup boundary, shared size constant, focused tests
- Related changes: `fix-music-analyzer-record-consistency` orders record cleanup; `fix-task-queue-external-cancellation` owns cancellation propagation but not cache ownership
- User-visible trade-off: oversized files fail before cache write; failed/cancelled accepted tasks retain their source until task deletion so existing retry remains possible
- Rollback: remove preflight/ownership cleanup and tests; no schema migration, but caches already removed after explicit task/record deletion cannot be recreated without the original upload

## Evidence

- `CreatePage.tsx:380-429` calls `cacheAudioSource()` before `createTask()` and has no cleanup in the catch path.
- `audio-source-cache.ts:18-45` writes a unique cache URL for the whole File without a size check.
- `task-queue-service.ts:1518-1530` reads the blob and only then rejects `>20MB`.
- `music-analyzer/storage.ts:38-54` cleans source cache only for a record prune/delete.
- A failed/cancelled pre-record analysis task has no record, while its params retain `audioCacheUrl` for retry; task removal has no Music Analyzer cache cleanup hook.

