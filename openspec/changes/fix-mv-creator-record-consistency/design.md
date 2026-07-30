## Context

MV records use one capped array value. React state and latest refs improve the current window's projection, but they do not serialize independent storage mutations from another page listener, another tool window, a shared task subscriber, or batch task completion. Task restoration happens after the MV hook's initial memory scan and does not emit one event per restored task.

## Goals / Non-Goals

- Goals:
  - Preserve accepted non-conflicting MV mutations in application-runtime order.
  - Reconcile terminal storyboard, rewrite, and music tasks after task storage is ready.
  - Coalesce local/live/restored synchronization of the same task.
  - Keep failed durable writes visible and recoverable without discarding in-memory work.
- Non-Goals:
  - Do not choose between the conflicting serial and parallel batch-video specs.
  - Do not introduce a repository layer, Web Locks protocol, new event bus, or new storage entity.
  - Do not change generated media, cache keys, provider routing, models, prompts, exports, analytics schema, or the 50-record cap.
  - Do not recover fields already lost before this change.

## Decisions

- Add one MV-key mutation queue at the storage acceptance boundary.
  - Each accepted mutation waits for the previous mutation, reloads the latest durable array, applies its operation, and persists before resolving.
  - A rejected mutation releases the queue so later user actions can retry.
- Reuse one shared task-storage readiness signal.
  - The approved owner performs a filtered MV terminal-task reconciliation pass after readiness.
  - The pass does not synthesize generic events for unrelated consumers.
- Add task-ID singleflight around MV domain synchronization.
  - Local Script listeners, the shared live hook, and restored reconciliation share one in-process result for the same task ID.
- Keep persistence feedback separate from generation errors.
  - A failure retains current input/results and shows a privacy-safe unsaved state.
  - Only a later successful accepted write clears that state.

## Invariants

- `mv-creator:records`, record/task shapes, lightweight URL references, 50-record retention, active-version rules, selected record, batch IDs, model preferences, and export manifests stay unchanged.
- Different task IDs are not coalesced.
- Reconciliation does not select an unrelated historical record.
- Errors and logs do not contain prompts, lyrics, knowledge contents, credentials, complete records, or media payloads.

## Risks / Trade-offs

- Serial mutation order can increase latency during bursty batch completion.
  - Measure 1/10/50 mutations at 0/10/50 records, five runs each; report median/min/max and correctness.
- Live completion can overlap readiness reconciliation.
  - Task-ID singleflight and idempotent pending-task checks prevent double projection.
- A stale failure can overwrite a newer success message.
  - Use accepted sequence IDs for persistence status.
- Three feature changes can accidentally add multiple global readiness owners.
  - Choose and document one owner before any implementation.

## Rollback

Remove the MV-key queue, readiness consumer, task-ID singleflight, persistence status, and focused tests together. No migration or cache cleanup is required; rollback restores the lost-update and recovery risks.

