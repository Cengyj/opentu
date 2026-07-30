# Tasks: Keep knowledge-base search results current

## 1. Evidence and approval

- [x] 1.1 Trace search input, debounce, index reads, semantic results, tag projection, and tree output.
- [x] 1.2 Reproduce a controlled A→B completion inversion and retain exact test counts and timing.
- [x] 1.3 Confirm scoring, index, storage, debounce, and result limits can remain unchanged.
- [ ] 1.4 Obtain user approval for stale-result suppression.

## 2. Implementation

- [ ] 2.1 Add failing tests for late success, late error, query clear, directory change, and unmount.
- [ ] 2.2 Add the minimum request-identity guard in `KnowledgeBaseContent`.
- [ ] 2.3 Preserve search scoring, filters, note selection, and index synchronization.

## 3. Verification

- [ ] 3.1 Run focused search/content tests with exact counts, duration, and exit code.
- [ ] 3.2 Measure at least five identical search sequences before/after and report calls and stable-result latency median/range.
- [ ] 3.3 Verify empty, no-match, slow, failure, clear, tag, directory, Chinese, and English queries.
- [ ] 3.4 Run Drawnix/full typecheck, full tests, cycles, build, size, startup, and available browser flows.
- [ ] 3.5 Rewalk the search path and update the F-23 ledger/spec documentation.
