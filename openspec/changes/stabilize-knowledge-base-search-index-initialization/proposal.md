# Change: Stabilize knowledge-base search index initialization

## Why

The existing UI search, related-notes surface, and `search_notes` MCP tool share one `KBSearchEngine` singleton. `ensureIndex()` has no in-flight operation owner: overlapping cold calls both run `buildIndex()`, and overlapping warm calls both run `syncIndex()`, while both methods mutate the same document/version/directory collections across storage awaits.

Controlled current-source diagnostics confirmed user-relevant corruption rather than inferring it from async syntax. With one stored note, two cold searches performed two metadata, directory, and content reads; the later completion returned duplicate `note-0` results and left `documentCount=2`. With one indexed note and one newly stored note, two warm searches both read the new content, the later completion returned `base,new,new`, and the final index held three documents for two notes. Because the MCP tool directly maps engine results, duplicate index rows can become duplicate user-visible tool results. Making overlapping callers share one index operation and failure outcome changes concurrency/recovery behavior and requires approval.

## What Changes

- Give the shared engine exactly one in-flight build-or-sync operation owner.
- Make overlapping UI search, related-note, and MCP callers await the same current index operation instead of mutating the index concurrently.
- Share that operation's success or failure with all current waiters, release ownership on settlement, and allow the next request to retry/synchronize.
- Preserve current TF-IDF/tokenization/scoring, filters, limits, snippets, directory metadata, storage records, incremental version checks, and entry-specific result presentation.
- Add deterministic cold-build, warm-sync, mixed-entry, failure, retry, and unique-result tests.

## Impact

- Affected specs: new `knowledge-base-search-index-consistency`
- Affected code: `packages/drawnix/src/services/kb-search-engine.ts`, focused service/entry tests, and F-23 evidence
- Neighbor boundary: `fix-knowledge-base-search-result-ordering` still owns which completed UI query may commit visible state; this change owns only shared index readiness and cannot replace that request identity guard
- Storage/data impact: none. No localForage store, note/directory/tag/content record, backup/GitHub format, cache key, task payload, schema, version, or migration changes
- Rollback: revert the in-flight owner and focused tests together. No data cleanup is required; overlapping calls can again duplicate scans and index rows.

## Evidence

- Shared mutable state and operations: `packages/drawnix/src/services/kb-search-engine.ts:80-123,128-188`.
- Search/related consumers: `kb-search-engine.ts:193-276`; shared singleton `:401-416`.
- UI search: `components/knowledge-base/KnowledgeBaseContent.tsx:316-336`.
- Related notes: `components/knowledge-base/KBRelatedNotes.tsx:34-47`.
- MCP registration and direct result mapping: `mcp/index.ts:82-98`; `mcp/tools/knowledge-base-tool.ts:69-121,333-338`.
- Storage reads: `knowledge-base-service.ts:157-163,257-287`.
- Cold diagnostic: 1/1 file, 3/3 tests, exit 0, tests 581 ms, Vitest 1.99 s, process 3.25 s. Two successful calls read meta/directory/content 2/2/2; second result IDs `[note-0]`, first `[note-0,note-0]`, final count 2. Mixed outcome: first error `synthetic first build failure`, second `[note-0]`, final count 1/indexed true.
- Warm diagnostic: 1/1 file, 1/1 test, exit 0, test 9 ms, Vitest 1.89 s, process 3.59 s. Reads 2/2 with content IDs `[new,new]`; second result `[base,new]`, first `[base,new,new]`, final count 3.
- Synthetic in-memory cold baselines, five samples each: 0 notes median 0.026849 ms/range 0.017370–0.062040; 100 notes median 9.648805/range 6.826579–10.985242; 1000 notes median 108.902224/range 85.909839–122.866666. These are fixed Node 24.14.0/Vitest 3.2.4/jsdom measurements, not IndexedDB or browser-performance claims.

