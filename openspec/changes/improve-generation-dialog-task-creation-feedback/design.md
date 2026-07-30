## Context

Image/video dialogs and batch-image use `useTaskQueue`, which currently reduces a thrown `createTask()` rejection to `null`. Music Analyzer calls the same service directly in a sequential multi-submit loop, but commits accepted task IDs only after the loop. The surfaces differ, while the invariant is the same: task creation can accept zero, all, or a strict subset, and feedback must describe that result without rolling back accepted tasks or exposing unsafe error text.

## Goals / Non-Goals

- Goals:
  - Preserve a recognized safe task-creation reason across the hook boundary.
  - Represent full, partial, and zero acceptance explicitly for existing batch submissions.
  - Persist each accepted Music Analyzer task association exactly once before reporting the batch outcome.
  - Preserve editable form/table contents for correction and retry.
- Non-Goals:
  - Change validation limits, provider execution failures, remote cancellation, queue concurrency, task schema, retry, recovery, or cache behavior.
  - Roll back or cancel a task that `createTask()` already accepted.
  - Expose raw exceptions, provider response bodies, request payloads, credentials, or stack traces.

## Decisions

- Use a typed creation outcome at the UI boundary with the accepted task and a safe recognized rejection category/message; keep `TaskQueueService.createTask()` itself throwing for compatibility.
- Aggregate requested, accepted, and rejected counts in each multi-submit owner rather than inferring success from a final boolean.
- In Music Analyzer, accumulate accepted IDs and persist that partial association before rendering the aggregate failure. Generated-clip sync remains idempotent by task/clip identity.
- Unknown errors retain generic guidance. Provider execution errors after creation belong to task lifecycle/error handling, not this change.

## Invariants

- Every accepted task executes, persists, cancels, retries, recovers, and inserts exactly as before.
- Every rejected creation produces no task or task ID.
- A task ID is associated with its source row/record at most once.
- Feedback contains no prompt, media URL, provider response, API key, token, stack, or internal request payload.

## Risks / Trade-offs

- A record-association write can itself fail after tasks are accepted.
  - Preserve the accepted IDs in the outcome, show a distinct safe persistence warning, and let the record-consistency change own durable write ordering/retry.
- Hook callers could ignore the richer result.
  - Keep a compatibility helper and migrate only the named callers with focused type/tests.
- Late completion can arrive while partial feedback is visible.
  - Keep accepted IDs authoritative and test that result projection does not replace the aggregate submission message with a contradictory state.

## Verification And Rollback

- Deterministic tests cover 0/N, N/N, and k/N acceptance, recognized/unknown rejection, association failure, duplicate prevention, and late accepted completion.
- Re-run focused hooks/dialogs/batch-image/Music Analyzer tests and the full validation matrix against baseline.
- Roll back the typed UI outcome, aggregation, messages, and tests together. No task, record, or cache migration is introduced.
