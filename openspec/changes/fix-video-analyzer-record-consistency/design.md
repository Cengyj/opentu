## Context

The durable value is one array under `video-analyzer:records`. Record creation, patching, deletion, task result synchronization, script autosave, generation updates, and history actions all use the same key. The current helper reads an array, mutates a private copy, and writes the whole array. Correctness therefore depends on exclusive mutation, but no exclusive boundary exists.

Task snapshots are loaded after startup idle. A workflow tool can mount before that read completes. The task-sync hook's initial memory scan then sees an empty or partial map, while the later restore event represents only one restored task rather than the whole restored set.

## Goals / Non-Goals

- Goals:
  - Preserve every video-analyzer record mutation accepted in one page runtime in deterministic order.
  - Reconcile every relevant completed task after task storage becomes ready.
  - Make persistence failure visible without discarding the user's current in-memory edit.
  - Keep result reconciliation idempotent across local and shared subscribers.
- Non-Goals:
  - Do not change video batch serial/parallel, frame chaining, failure retry, provider, or cancellation semantics.
  - Do not change record/task schemas, storage keys, history cap, migrations, caches, or source snapshots.
  - Do not claim cross-tab atomicity without a separate controlled multi-tab design and measurement.
  - Do not automatically select a recovered historical record over an unrelated current edit.

## Decisions

- Decision: add one video-analyzer-owned mutation queue around every write to `video-analyzer:records`.
  - Each operation reads only after all previously accepted operations have settled, then performs its existing add/update/delete/save logic.
  - A failed operation rejects its own caller but does not poison the queue for later attempts.
  - Alternative: change the shared record helper globally.
  - Rejected for this change because the other workflow tools have not yet completed their own functional audits and a global behavior change would cross unrelated feature loops.
- Decision: establish one explicit task-storage-ready reconciliation pass for the shared workflow task-sync consumer, with video-analyzer filtering and existing task-ID idempotency.
  - The final implementation must coordinate with `fix-main-thread-workflow-recovery-sync`; it may reuse one readiness signal, but it must not introduce a second global workflow owner.
  - Alternative: rescan all tasks after every task event.
  - Rejected because repeated full scans scale with retained task count and do not express the actual restoration boundary.
- Decision: persistence feedback uses the existing page error/message surfaces and contains only an operation label plus a safe storage error summary.
  - Current edit state remains mounted. A later successful save clears only the storage warning, not unrelated task errors.

## Invariants

- Same-runtime record mutations are applied in acceptance order.
- Two completed analysis tasks with distinct IDs can both create records, subject only to the existing 50-record retention rule.
- Replaying a completed task ID does not create a second record or rewrite version.
- Recovery never selects a record unless it was already current or an explicitly approved selection rule is added later.
- A successful save means the returned record array reflects all earlier accepted video-analyzer mutations.
- Record/task shapes, IDs, timestamps, source snapshots, provider inputs, and cache references are unchanged.
- Errors and analytics do not include prompt bodies, cached media, credentials, or full stored records.

## Risks / Trade-offs

- Serialized writes increase completion latency when many task results arrive together.
  - Mitigation: serialize only the one video-analyzer key; do not add arbitrary delay or copy unrelated storage domains.
- A storage-ready reconciliation pass can duplicate a simultaneous live completion event.
  - Mitigation: keep task-ID singleflight plus stored `analyzeTaskId`/pending rewrite guards and test both event orders.
- A shared readiness signal can conflict with the pending WorkZone recovery change.
  - Mitigation: approve and design one owner before implementation; do not land parallel global coordinators.
- A late failed autosave can overwrite a newer success warning state.
  - Mitigation: associate feedback with mutation sequence numbers and let only the latest relevant result update the visible save state.

## Verification and Performance Thresholds

- Red/green deterministic tests for concurrent add/add, patch/patch, add/delete, task-sync/local-edit, and failure-then-success sequences.
- Restoration tests with an initially empty memory queue, multiple persisted completed tasks, a non-video first task, and simultaneous live completion.
- Component tests inject autosave and generation-write rejection and verify visible safe feedback, preserved edit state, and clearing after successful retry.
- Run 5 samples each for 1, 10, and 50 concurrently accepted mutations over 0, 10, and 50 stored records. Report raw values, median, and min/max. Correctness requires zero lost mutations in every run; no claim of faster writes is permitted.
- Existing single-write interaction must not add more than one extra storage read or write. No budget may be increased.

## Rollback

Remove the video-analyzer mutation queue, storage-ready reconciliation, feedback state, and focused tests together. Existing stored arrays remain readable because no key or schema changes. No cache clearing or data migration is required.

