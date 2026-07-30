## Context

Music Analyzer record state is projected into React by `useWorkflowRecords`, but durability is owned by one localForage/IndexedDB array value. Page-local autosave, dedicated task subscribers, the shared workflow subscriber, history actions, and multiple windows can all call the same helpers. React state therefore cannot serialize every writer. Task restoration is independently deferred and currently has no readiness signal at the domain consumer.

## Goals / Non-Goals

- Goals:
  - Preserve every accepted same-runtime Music Analyzer mutation in accepted order.
  - Reconcile all relevant restored terminal tasks exactly once per reconciliation wave.
  - Keep the currently selected unrelated record stable during background recovery.
  - Report durable-write failure without discarding the optimistic edit or leaking private content.
- Non-Goals:
  - Provide cross-tab distributed transactions or recover already-lost fields.
  - Change the record schema, 50-record policy, task schema, cache lifecycle, provider routing, cancellation, retry, or generation concurrency.
  - Add a Music Analyzer-specific task-storage poller.

## Decisions

- Add a storage-key-scoped mutation chain at the accepted write boundary. Each add/update/delete loads after the previous accepted mutation settles, and a rejected mutation does not permanently poison later mutations.
- Keep pruning/deletion cleanup inside the ordered mutation so cache side effects cannot run for a record that another older write restores.
- Consume the one application-owned task-storage-ready signal, then run a filtered Music Analyzer reconciliation over terminal tasks. Reuse task-ID singleflight/idempotency with live events.
- Do not select a recovered record when the user is editing another record; update the matching record projection only.
- Persistence feedback carries an operation label and safe storage category, never prompt, lyrics, filename, media URL, task ID, provider body, credential, or stack.
- Sequence feedback by accepted mutation so a late older failure cannot replace a newer success or vice versa.

## Invariants

- Accepted mutations for the Music Analyzer key commit in accepted order or report failure.
- Record normalization, 50-record pruning, starred retention, source snapshot shape, and cleanup callbacks remain unchanged.
- Live event plus readiness scan yields one durable projection per task result.
- Refresh recovery does not create a new task, provider request, canvas insertion, or current-record switch.

## Risks / Trade-offs

- Serialization can add latency during burst completion.
  - Measure 1/10/50 concurrent accepted mutations over five runs; require zero lost fields and report median/min/max without claiming a speedup.
- A failed mutation followed by success can confuse feedback.
  - Test failure→success, success→late failure, and rapid autosave sequencing.
- Readiness scan can overlap a live completion.
  - Share task-ID singleflight and test both interleavings with the first restored task unrelated to Music Analyzer.
- Shared readiness work overlaps other approved-boundary proposals.
  - Implement the global owner once; each domain registers a filtered consumer only after its own approval.

## Verification And Rollback

- Red tests: update/update, add/add, task/edit, favorite/delete, rejection recovery, live+restored duplicate, unrelated-first restored map, and current-selection preservation.
- Performance samples: 0/10/50 records × 1/10/50 mutations, five runs, zero lost accepted mutations; report latency median/range and queue depth.
- Browser: one/two windows, autosave/task completion/favorite/delete, storage rejection/retry, refresh, offline, cancelled/failed tasks.
- Run focused tests, Drawnix/full typecheck and lint, full test/cycles/build/size/startup, and available responsive/feature flows against baseline.
- Rollback the key-scoped chain, readiness consumer, feedback state, and tests together. No migration or cache deletion is required.

