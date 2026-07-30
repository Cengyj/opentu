# F-23 knowledge-base search index concurrency diagnostics

Date: 2026-07-30 (Asia/Shanghai)

## Feature boundary and user scenario

**Scenario**: immediately after opening, importing or changing knowledge-base notes, a user searches in the knowledge-base window, views related notes, or invokes the registered `search_notes` MCP tool. Every entry uses the same current note projection, produces unique results, reports its own existing success/failure surface, and does not multiply IndexedDB reads merely because another entry overlaps.

**Scope**: `KBSearchEngine` cold build/warm sync readiness; UI search, related-note and MCP callers; note/directory/content reads; shared in-memory documents, version map, directory map, vectorizer/readiness/time state; result/error projection and refresh/retry boundary. **Out of scope**: UI latest-query ownership (`fix-knowledge-base-search-result-ordering`), TF-IDF/search product semantics, F-23 multi-store write consistency, persisted/background indexes, workers, cross-tab coordination, new cancellation/retry UI, real user storage and provider requests.

**Approval gate**: preventing overlapping index operations changes shared failure and wait semantics. `stabilize-knowledge-base-search-index-initialization` has been created with 3 requirements, 9 scenarios and 15 tasks, 4 evidence tasks checked. Runtime/permanent tests remain unchanged until explicit approval.

## Complete current call chain and invariants

1. **Knowledge-base UI search**: query/directory state → 300 ms timer `KnowledgeBaseContent.tsx:316-336` → singleton `getKBSearchEngine()` → `search(query, {limit:50, filter})` → `ensureIndex()` → cold `buildIndex()` or warm `syncIndex()` → all note metadata/directories plus sequential per-note content reads → query vector/scoring/sort/result mapping → `semanticResults` → tag filter/order/unique `allNotes` projection → tree. UI catch restores `semanticResults=null`; a separate approved change owns late A/B UI commits.
2. **Related notes**: selected note → `KBRelatedNotes.tsx:34-47` → the same singleton → `getRelatedNotes(noteId,10)` → the same readiness boundary → similarity results → component-level related-ID/seen-ID dedupe or tag/title fallback → right panel. Catch projects an empty engine result and retains fallback behavior.
3. **MCP**: `mcp/index.ts:82-98` registers `knowledgeBaseTools` → `search_notes` validates non-empty query → `knowledge-base-tool.ts:69-121` calls the same singleton with default caller limit 10, optional directory filter, `includeContent:false`, snippet 200 → directly maps every engine result to tool data; empty semantic results fall back to basic search and rejection becomes `{success:false,error}`.
4. **Storage and state**: `knowledge-base-service.ts:33-72,157-163,257-287` owns localForage directory/meta/content records. The search index is not persisted. `KBSearchEngine.ts:80-86` owns mutable documents/vectorizer/directory/version/readiness/time. `buildIndex :91-123` clears shared collections, awaits each content, appends and marks ready; `syncIndex :128-177` compares versions and mutates the same collections; `ensureIndex :182-188` has only the readiness boolean and no in-flight owner. `search :193-239` defaults to limit 20/minimum 0.1/no filter/no content/snippet 200; related notes defaults to limit 5. Singleton/reset is `:401-416`.
5. **Recovery/privacy/tests**: a page/singleton restart rebuilds from local stores; every warm request currently scans metadata/directories and changed contents. No network, Cache API, task, analytics, log or migration side effect occurs in the index. Diagnostics use synthetic IDs/text only and inspect no browser storage or credential. No permanent `KBSearchEngine`, related-notes or knowledge MCP search test was found.

## [F23-SEARCH-INDEX-CONCURRENCY-002]

**Status**: confirmed correctness defect plus measured duplicate work; implementation blocked by `stabilize-knowledge-base-search-index-initialization` approval. Evidence strength is high for the deterministic service concurrency/result contract and unknown for real-browser incidence/performance.

**User impact/current versus expected**: overlapping UI/related/MCP requests can build or synchronize the shared index twice, append the same durable note more than once, and return duplicate result IDs. The MCP path directly exposes every row, so duplicated engine rows can become duplicated tool results. Expected behavior is one current build/sync owner per engine, one index row per unique durable note ID, and entry-specific query projection after the shared readiness operation.

**Reproduction and raw evidence**:

- Cold success: one stored note, start two searches before either content read resolves, resolve the second then first. Current reads meta/directory/content `2/2/2`; second result IDs are `[note-0]`; later first IDs are `[note-0,note-0]`; final stats are `documentCount=2,isIndexed=true`. Corrected diagnostic exit 0, 1/1 file and 3/3 tests; concurrency test 7 ms, total tests 581 ms, Vitest 1.99 s, process 3.25 s.
- Warm success: index `base`, expose durable `new`, start two searches, resolve second content then first. Current reads meta/directory `2/2`, content IDs `[new,new]`; second results `[base,new]`; later first `[base,new,new]`; final `documentCount=3` for two notes. Exit 0, 1/1 file and 1/1 test, test 9 ms, Vitest 1.89 s, process 3.59 s.
- Mixed cold outcome: resolve the second build and reject the first. The first receives `synthetic first build failure`; the second returns `[note-0]`; final stats are one document/indexed true. This proves current overlapping callers can observe different readiness outcomes and defines the approval trade-off; it is not reported as a separate failure defect.
- First direct invocation used the workspace-root path with the package include and exited 1 before collection with “No test files found”; 0 tests. Correcting to `--root packages/drawnix` produced the results above. The first run is tool invocation error, not product failure.

**Root and complete mutation chain**: two callers both observe `isIndexed=false` (or true) at `ensureIndex :182-188` → both enter build (or sync) → both clear/read/mutate the same `documents/indexedVersions/directoryMap` across content awaits at `:91-177` → each appends the same note → `search :193-239` maps every shared row → direct MCP map or UI/related projection. The root is absent in-flight ownership; result dedupe alone would leave state/reads/vector fitting corrupted.

**Candidate and alternatives**: preferred is one engine-local nullable in-flight Promise created by `ensureIndex`, shared by overlapping build/sync waiters, cleared in guarded `finally`, with a later call re-evaluating build/sync. Query scoring still runs per caller. Local snapshot/atomic swap would also change partial-failure commit semantics; separate engines multiply work/diverge; result-only dedupe hides the sink but not the root; a generic mutex/event bus has no evidence. These alternatives are not selected.

**Risk and trade-off**: all overlapping callers will share one storage failure instead of allowing a parallel attempt to succeed, and a slow first operation will delay other entries. A later request must retry after owner cleanup. Warm sync can still partially mutate on storage rejection; this change does not claim transactional indexing. `clearIndex/resetKBSearchEngine` has no production caller in current source and remains a focused non-regression boundary.

**Validation and rollback**: permanent tests must cover 2/3 mixed entry waiters, cold/warm added/updated/deleted notes, one read set, unique IDs, shared failure, later retry, guarded cleanup, reset, filters/limits/scoring/snippets and UI/related/MCP sinks. Measure five same-fixture current/after samples and separately measure real IndexedDB/browser behavior before claiming speed. Rollback removes the private owner/tests; no store/cache/schema/migration/user-data recovery is required, but duplicate overlap returns.

## Current performance measurements, visual state and exit

Fixed workspace Node 24.14.0, Vitest 3.2.4, jsdom, synthetic in-memory store functions, no network/CPU throttle, five cold samples per size:

- 0 notes: raw `[0.062040,0.018862,0.026849,0.036322,0.017370]` ms; median 0.026849; range 0.017370–0.062040; reads per sample meta/directory/content `1/1/0`.
- 100 notes: raw `[10.734929,9.648805,10.985242,7.223440,6.826579]` ms; median 9.648805; range 6.826579–10.985242; reads `1/1/100`.
- 1000 notes: raw `[122.866666,114.167862,108.902224,85.909839,88.857162]` ms; median 108.902224; range 85.909839–122.866666; reads `1/1/1000`.

These values bound current pure indexing/search work in this diagnostic only. They exclude real IndexedDB, React, browser scheduling and rendering, and there is no after implementation. No faster/lower-memory/browser-bottleneck claim is made. No UI/CSS changed, so visual evidence and before/after screenshots are not applicable to this sub-loop.

Both temporary diagnostic files were deleted; production/runtime/permanent-test changes are zero. The existing F-23 focused baseline then passed 9/9 files and 41/41 tests, exit 0, tests 1.24 s, Vitest 4.44 s, process 5.70 s. Browserslist age output and pnpm's ignored project-auth-setting warning are tool/configuration noise; no credential value or `.npmrc` content was read or printed. OpenSpec CLI validation exited 127 because the CLI is unavailable. Manual structure check found all four files, 3 unique requirement names, 9 Scenario/WHEN/THEN groups, 15 tasks/4 checked and one capability owner. F-23 remains incomplete: this confirmed issue and the six earlier user-observable changes await independent approval.
