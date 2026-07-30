# Tasks: Stabilize knowledge-base search index initialization

## 1. Evidence and approval

- [x] 1.1 Trace UI search, related notes and MCP registration through the shared singleton, storage reads, index mutations and final consumers.
- [x] 1.2 Reproduce two overlapping cold searches with controlled content-read completion and record duplicate reads/results/final index state.
- [x] 1.3 Reproduce two overlapping warm syncs discovering the same note and record duplicate reads/results/final index state.
- [x] 1.4 Record mixed failure propagation and five synthetic cold samples at 0/100/1000 notes; separate Node/jsdom data from browser claims.
- [ ] 1.5 Obtain explicit user approval before modifying runtime code or permanent tests.

## 2. Failing tests and implementation

- [ ] 2.1 Add failing cold-build tests for two/three search, related-note and MCP waiters with unique results and one storage scan.
- [ ] 2.2 Add failing warm-sync tests for added, updated and deleted notes under overlapping callers.
- [ ] 2.3 Add failure/retry tests proving shared rejection, guarded owner cleanup and one later successful retry.
- [ ] 2.4 Add the minimum engine-local in-flight build-or-sync owner in `ensureIndex()`.
- [ ] 2.5 Preserve per-query scoring/filter/limit/snippet work, readiness decisions, incremental version checks and direct reset behavior.

## 3. Verification and documentation

- [ ] 3.1 Run focused engine, KnowledgeBaseContent, KBRelatedNotes and knowledge MCP tests with exact exits/counts/timings.
- [ ] 3.2 Measure five identical 0/100/1000-note current/after sequences and overlapping call counts; report medians/ranges and trade-offs.
- [ ] 3.3 Verify empty, no-match, added/updated/deleted, slow, failed, retry, directory-filter, Chinese and English queries.
- [ ] 3.4 Run Drawnix/full typecheck, full tests, cycles, production build, size/startup and available smoke/feature/visual/responsive flows against baseline.
- [ ] 3.5 Rewalk UI/related/MCP forward and result/error/index reverse chains; update F-23 evidence, ledger and rollback notes.

