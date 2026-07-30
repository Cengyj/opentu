# Change: Keep knowledge-base search results owned by the current query

## Why

Knowledge-base semantic search debounces only calls that have not started. It has no request identity after `KBSearchEngine.search()` begins. A deterministic controlled-promise diagnostic at the current source (Node 24.14.0, Vitest 3.2.4, jsdom) passed 1/1 current-behavior assertion in 93 ms: query A started, query B started and returned first, B rendered, then A returned late and replaced the visible tree while the input still contained B. The diagnostic was removed after the run.

Suppressing stale completion changes visible search behavior and needs an independent approval.

## What Changes

- Assign an identity to every query-and-directory-filter search request.
- Commit results or errors only when the completion still belongs to the latest query/filter identity.
- Invalidate in-flight ownership when the query is cleared, the selected directory changes, or the component unmounts.
- Preserve the existing 300 ms debounce, TF-IDF scoring, result limit/order, tag filtering, note selection, index format, and storage behavior.
- Add controlled A→B, filter-change, clear, error, and unmount tests.

## Impact

- Affected specs: `knowledge-base-search-consistency`
- Affected code: `KnowledgeBaseContent.tsx` and focused search/UI tests
- No IndexedDB, search-index, cache, note, task, provider, or migration format changes
- Rollback removes request ownership and tests; no data cleanup is required

## Current Evidence

- `KnowledgeBaseContent.tsx:316-336` cancels only `searchTimerRef` and unconditionally calls `setSemanticResults` after the awaited search.
- `KBSearchEngine.search()` awaits index build/sync and per-note reads before returning, so two started calls can settle in a different order.
- The controlled diagnostic proves the late-write sequence and visible A-after-B result; it is not inferred from the use of async code alone.
