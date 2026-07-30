# Design: Knowledge-base search result ownership

## Decision

Capture a monotonically increasing request id together with the normalized query and directory filter when scheduling each search. Increment it on every dependency change and cleanup. After success or failure, update `semanticResults` only if the id is still current. This mirrors the existing note-selection request guard without changing `KBSearchEngine` scoring or cancellation semantics.

The engine call itself is not aborted because its IndexedDB/index work has no abort contract. Stale work may finish, but it cannot mutate the current UI. Adding a generic cancellation framework or worker is outside this bug fix.

## Preserved behavior

- 300 ms debounce, search terms, limit 50, TF-IDF/cosine scoring, directory/tag filtering, result order, and empty-query behavior remain unchanged.
- Index synchronization and note storage remain owned by `KBSearchEngine` and `knowledge-base-service`.
- No new search mode, syntax, server request, persistence, or analytics payload is introduced.

## Risks and verification

- A stale failure must not clear a newer success.
- Clearing the query or changing directory during an in-flight call must invalidate the old completion.
- Request ids must not trigger extra searches or retain results after unmount.
- Run deterministic deferred-promise tests for A→B success, A failure after B success, clear, filter change, and unmount.
- Measure at least five input-to-stable-result samples before/after with identical note fixtures and record engine-call count, latency median/range, and result identity. No performance improvement is claimed.

## Rollback

Remove the request-id guard and focused tests. No stored state or migration changes.
