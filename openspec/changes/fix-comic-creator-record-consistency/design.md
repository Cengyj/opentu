## Context

The durable value is one array under `comic-creator:records`. Record creation, page/common-prompt edits, generation status/result writes, task recovery, favorites, and deletion all rewrite that array. Correctness therefore depends on exclusive mutation, but the only existing queue is scoped to one `ComicCreator` mount.

Comic task snapshots are restored after startup idle. A comic tool can mount and scan an empty task map before restoration. The later generic queue event does not represent every restored task.

## Goals / Non-Goals

- Goals:
  - Preserve every comic record mutation accepted in one runtime in deterministic order.
  - Reconcile all relevant terminal comic tasks after task storage is ready.
  - Keep reconciliation idempotent across local waits, live events, multiple windows, and restoration.
  - Make record durability failures visible without discarding the current in-memory edit.
- Non-Goals:
  - Do not claim cross-tab atomicity without a separate multi-tab design and measurement.
  - Do not change generation mode, concurrency, prompt construction, model routing, exports, history cap, record/task schema, or caches.
  - Do not replace an unrelated record the user is editing when historical task recovery runs.

## Decisions

- Decision: add one comic-owned mutation queue around every add/update/delete/save operation for `comic-creator:records`.
  - Each operation begins its read only after previously accepted comic mutations settle.
  - A rejected operation rejects its caller but does not poison later mutations.
  - Alternative: change the shared whole-array helper globally.
  - Rejected because other workflow storage domains have not completed their own feature audits.
- Decision: use one shared task-storage-ready signal, then run one filtered comic reconciliation pass.
  - Coordinate ownership with `fix-video-analyzer-record-consistency` and `fix-main-thread-workflow-recovery-sync`; do not add parallel global readiness services.
  - Alternative: rescan all tasks after every task event.
  - Rejected because it repeats work with retained-task count and still does not model the restoration boundary.
- Decision: use task-ID singleflight plus existing pending/task ID guards for live/restored event overlap.
- Decision: persistence feedback carries only an operation label and safe error summary. It keeps the optimistic edit mounted and clears after the latest later success.

## Invariants

- Same-runtime comic record mutations are applied in accepted order.
- Two distinct page-task results can both survive in the same project.
- Replaying one terminal task ID does not add a duplicate image variant or replace an unrelated selected record.
- A successful mutation returns an array reflecting all earlier accepted comic mutations.
- Record/task shapes, IDs, timestamps, provider inputs, cache references, and image variant deduplication remain unchanged.
- Errors and analytics do not include prompt bodies, cached media, credentials, or full stored records.

## Risks / Trade-offs

- Serialization increases completion latency when many results finish together.
  - Mitigation: serialize only the comic record key and measure 1/10/50 accepted mutations.
- A readiness scan can overlap a live completion event.
  - Mitigation: task-ID singleflight plus persisted pending/task ID guards and both event-order tests.
- A late rejection can overwrite a newer success indicator.
  - Mitigation: sequence feedback updates and let only the latest relevant operation change visible durability state.
- The readiness boundary overlaps pending changes.
  - Mitigation: approve one owner and reuse it; no feature change may introduce another global coordinator.

## Verification And Performance Thresholds

- Deterministic red/green tests for concurrent update/update, task-result/edit, add/delete, failure-then-success, and multiple tool instances.
- Restoration tests with an initially empty task map, multiple persisted terminal tasks, a non-comic first task, and simultaneous live completion.
- Component tests inject edit/history/task-sync persistence rejection and verify safe feedback, preserved edit state, and later clearing.
- Run five samples for 1, 10, and 50 accepted mutations over 0, 10, and 50 stored records. Correctness requires zero lost mutations; report raw latency, median, and min/max without claiming speedup.
- Existing single-mutation paths add no more than one storage read and one storage write.

## Rollback

Remove the comic mutation queue, readiness reconciliation, feedback state, and focused tests together. Stored arrays remain readable because no schema/key/migration changes are introduced.

