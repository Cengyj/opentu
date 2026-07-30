## Context

Custom-tool APIs are already asynchronous, but their in-memory side effect is currently optimistic and has no rollback or write queue. UI success messages wait for the promise; therefore a failed promise and a changed catalog contradict each other.

## Goals / Non-Goals

- Goals:
  - Make resolved/rejected mutation results match both memory and IndexedDB.
  - Preserve mutation order under overlapping async callers.
  - Prevent failed local writes from leaking into later sync or catalog reads.
- Non-Goals:
  - Do not add cross-tab synchronization, migrations, retries, conflict dialogs, undo, cloud storage, or new tool fields.
  - Do not change initialization readiness, deletion runtime cleanup, window behavior, or iframe permissions in this change.

## Decisions

- Decision: maintain one ordered mutation chain; each operation derives an immutable next array from the last committed array, persists that snapshot, then commits it to memory.
  - Alternative: mutate optimistically and roll back on failure.
  - Rejected because: a late rollback can erase a second concurrent mutation and exposes a failed state to synchronous readers.
- Decision: a failed mutation rejects/returns failure using the existing caller contract and leaves the chain usable for later operations.
  - Alternative: poison all later writes after one failure.
  - Rejected because: a transient IndexedDB failure need not permanently disable the session.
- Decision: validation and maximum-count checks run inside the ordered mutation boundary against the last committed catalog.
  - Alternative: validate outside the queue.
  - Rejected because: concurrent adds could both pass a stale count/duplicate check.

## Invariants

- A resolved mutation is present in memory and in the completed localForage snapshot.
- A rejected mutation changes neither the committed in-memory catalog nor the stored snapshot.
- Overlapping mutations commit in accepted order and never roll back another operation.
- Readiness from `ensure-toolbox-initialization-consistency` completes before the first persisted mutation runs.
- Storage key/version/schema, IDs, URLs, permissions, GitHub payloads, and analytics remain unchanged.
- Error logs/messages do not include raw stored URLs or credentials.

## Risks / Trade-offs

- Slow writes serialize later custom-tool operations; these operations are user-triggered and capped at 50 entries, but latency must be measured.
- Synchronous catalog reads do not expose an optimistic mutation before durability; existing UI already waits for the async promise before success refresh.
- Queue recovery after rejection must be tested so a later valid operation can succeed.

## Verification

- Test add/update/remove/clear/import success and forced write rejection against memory and captured snapshots.
- Test overlapping add/remove/import with controlled reverse write completion and duplicate/count validation.
- Test a successful mutation after an earlier rejected mutation.
- Test CustomToolDialog failure/success feedback and GitHub sync committed counts.
- Measure 1, 10, and 50-entry mutations for at least five samples before/after; report raw values, median, range, and storage environment without claiming improvement.

## Rollback

- Remove the ordered mutation helper/queue and focused tests, restoring current mutation methods.
- No stored data conversion or cleanup is required because key, version, and payload schema are unchanged.

