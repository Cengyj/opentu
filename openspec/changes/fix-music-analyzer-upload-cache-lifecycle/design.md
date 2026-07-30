## Context

The source snapshot URL crosses three owners: the Create page creates it, the accepted CHAT task uses it for execution/retry, and the resulting record uses it for reopen/history. Current cleanup observes only the last owner. A lifecycle fix must preserve retry and avoid deleting a URL that a retained task or record still references.

## Goals / Non-Goals

- Goals:
  - Avoid writing a source known to violate the existing 20 MB analysis limit.
  - Remove a cache created by a submission that never produced an accepted task.
  - Preserve failed/cancelled task retry while the task remains stored.
  - Delete the cache only after the last task/record owner is explicitly removed or pruned.
- Non-Goals:
  - Change the 20 MB limit, accepted audio types, cache URL schema, task/record schema, retention limits, provider behavior, or retry UI.
  - Run a global cache sweep or infer deletion from age alone.
  - Claim a quota/performance improvement without five-sample measurements.

## Decisions

- Export one Music Analyzer analysis-size constant used by both preflight and executor validation.
- Wrap cache→task creation in an ownership transaction: before task acceptance the page owns the new URL; on creation failure it performs best-effort cleanup and reports a separate safe cleanup warning if needed.
- After task acceptance, task params are the retry owner. Failed/cancelled state alone does not delete the source.
- After successful record projection, task and record may both reference the same URL. Deletion/pruning checks remaining Music Analyzer tasks and records before removing it.
- Make cleanup idempotent; a missing cache is success. Do not delete arbitrary URLs outside the Music Analyzer source namespace.

## Invariants

- A retryable stored task can still restore its input source.
- A retained record can still reopen its source after task retention changes.
- One owner deletion never removes a cache referenced by another owner.
- No provider request, task creation, or record write occurs for a preflight-oversized file.

## Risks / Trade-offs

- Reference checks across tasks and records can race with an ordered record mutation.
  - Run cleanup only after successful owner removal and coordinate with the approved record mutation boundary.
- Best-effort cleanup can fail.
  - Report safely, keep the ownership URL diagnosable, and retry only on an explicit later cleanup boundary; do not hide submission failure.
- Centralizing the limit could unintentionally affect other audio paths.
  - Keep the constant scoped to Music Analyzer analysis and test unrelated AUDIO generation.

## Verification And Rollback

- Failure-injection tests: oversize preflight, cache success/task-create failure, accepted failed/cancelled retry, successful record transfer, task-first delete, record-first delete, shared reference, missing cache, cleanup rejection.
- Browser: 20 MB boundary values, slow cache, create rejection, failure/cancel/retry/delete, refresh/offline, two windows.
- Measure cache write/delete time and retained bytes for five controlled files before/after; report raw values and any retry trade-off.
- Roll back ownership/preflight hooks and tests; no schema migration or broad cache clearing.

