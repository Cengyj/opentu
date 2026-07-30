# Design: Knowledge-base search index operation ownership

## Context

`KBSearchEngine` owns one in-memory projection of note metadata/content, directory names, versions, and TF-IDF state. `search()` and `getRelatedNotes()` both call `ensureIndex()`; the UI search effect, related-notes effect, and registered MCP tool all obtain the same singleton. When cold, every caller that observes `isIndexed=false` starts `buildIndex()`. When warm, every caller starts `syncIndex()`. Both operations mutate `directoryMap`, `documents`, `indexedVersions`, vectorizer/readiness state, and timestamps around per-store awaits.

The controlled interleavings show two consequences: duplicate storage work and duplicate document IDs/results. The current mixed success/failure sample also shows independent operations can give overlapping callers different index-readiness outcomes. This change defines one operation owner; it does not redesign indexing or UI query ownership.

## Goals / Non-Goals

- Goals:
  - Ensure at most one reachable build or sync mutates a `KBSearchEngine` instance at a time.
  - Make overlapping callers await the same operation and observe the same settlement.
  - Release ownership after success or failure so a later request may synchronize/retry.
  - Keep unique note IDs in results when the durable metadata set is unique.
- Non-Goals:
  - Add a worker, persistent index, search syntax, cancellation UI, background indexing, new cache, transaction, event bus, or cross-tab coordinator.
  - Change TF-IDF weights, tokenization, similarity threshold, ranking, limit, snippets, filters, or UI stale-query ownership.
  - Make a failed build/sync transactionally atomic; F-23 storage consistency changes retain their separate scope.
  - Change unused direct `buildIndex/syncIndex/clearIndex/resetKBSearchEngine` into new public product APIs.

## Decisions

- Add one private nullable in-flight Promise owned by the engine. `ensureIndex()` creates it from the current cold-build or warm-sync decision only when none exists; every overlapping caller awaits the same Promise.
- Clear the field in a guarded `finally` so the settled operation cannot erase a newer owner. Rejection propagates to every current waiter; no caller is told the index is ready when the shared operation failed.
- After settlement, the next call re-evaluates current readiness and may build or sync using the existing rules. No failure is cached permanently and no arbitrary retry/backoff is introduced.
- Keep `buildIndex()` and `syncIndex()` internals and storage order unchanged in the minimal implementation. Serialization removes the confirmed overlap without conflating this change with atomic rebuild, worker, or multi-store transaction work.
- Do not add memoization around `search()` or `getRelatedNotes()`: only index readiness is shared. Each caller still computes its own query/filter/limit result after readiness.

## Alternatives Considered

- Build into caller-local snapshots and atomically swap the latest result.
  - Rejected for this change because it also changes partial-failure state and commit arbitration; one operation owner is sufficient for the confirmed overlap.
- Give UI, related notes, and MCP separate engine instances.
  - Rejected because it guarantees duplicated storage scans and divergent readiness instead of protecting the existing shared projection.
- Deduplicate only returned arrays.
  - Rejected because duplicate rows, versions, reads and TF-IDF fitting remain in shared state.
- Cache the first Promise forever.
  - Rejected because later note updates/deletes must still enter the current incremental sync path.
- Add a generic mutex/queue abstraction.
  - Rejected because there is one narrow service boundary and no evidence for a repository-wide concurrency primitive.

## Risks / Trade-offs

- Overlapping callers now share failure rather than allowing one concurrent attempt to succeed.
  - This is explicit and approval-gated; a later request retries after ownership is released.
- A slow first caller delays other entries that previously duplicated work.
  - Measure waiters, reads and input-to-stable results with identical fixtures; do not claim browser improvement from synthetic Node samples.
- A warm sync can still partially mutate before a storage rejection.
  - Preserve this existing boundary and test retry; atomicity remains outside this change.
- `clearIndex/resetKBSearchEngine` can race an old instance in tests or future callers.
  - Current production search found no callers. Keep the contract unchanged and add a focused non-regression test without expanding user scope.

## Verification

- Cold: two and three overlapping search/related/MCP callers cause one metadata/directory scan and one content read per indexed note; all results contain unique durable note IDs.
- Warm: concurrent callers discovering the same added/updated/deleted note run one sync and leave correct unique versions/documents.
- Failure: all current waiters reject from one operation; ownership clears; the next call retries once and can succeed.
- Entry behavior: UI stale-completion behavior remains owned by its separate change; related fallback/dedupe and MCP basic-search fallback remain unchanged.
- Five same-fixture runs record storage calls and current/after latency for 0/100/1000 notes; browser measurements use real IndexedDB separately before making a performance claim.
- Run focused tests, Drawnix/full typecheck and tests, cycles, production build, size/startup, and available knowledge-base browser/E2E flows against baseline.

## Migration and Rollback

No migration, cache invalidation, index persistence, preference rewrite or user-data cleanup is required. Rollback removes the private operation owner and focused tests; the in-memory index rebuilds under existing behavior.

