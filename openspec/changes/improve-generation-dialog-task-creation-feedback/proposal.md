# Change: Improve Generation Dialog Task-Creation Feedback

## Why

The image and video generation dialogs already distinguish invalid parameters from generic task-creation failures, but `useTaskQueue` catches every exception from `TaskQueueService.createTask()` and returns only `null`. As a result, a reachable invalid request—for example, opening image generation from a frame wider than the service limit of 4096 pixels—cannot reach the dialogs' actionable error branch and is rendered as a generic retry message.

The same shared boundary reaches the built-in batch-image tool. Its loop counts only non-null tasks and renders feedback only when at least one task was created. All rejected creations therefore produce no message, while a mixed result reports only the accepted count and does not identify the rejected count or a safe reason. The hook diagnostic plus the batch submit chain proves both outcomes without a provider request.

F-20 reaches the same outcome without the hook wrapper. Music Analyzer's Generate page creates 1–4 AUDIO tasks sequentially inside one `try`, but records task IDs only after the whole loop. If creation `n` throws, tasks `1..n-1` continue running, the record stores none of their IDs, and the UI reports one undifferentiated failure. Batch IDs can still project late completed clips into the record, so the same screen can show failure followed by results without an accepted/rejected count.

This is statically proven by the current call chain: frame dimensions are passed into the generation dialog, `validateGenerationParams()` rejects the dimensions, `TaskQueueService.createTask()` throws the validation reason, and `useTaskQueue` discards it before either dialog can render it. A diagnostic hook test records the current loss of information. Changing the rendered failure feedback is user-observable, so implementation requires approval.

## What Changes

- Preserve the task-creation rejection reason across the shared task-queue hook boundary.
- Let the image and video generation dialogs and batch-image tool render a concise, actionable reason for rejected creation requests in Chinese and English.
- Let batch-image submission distinguish full acceptance, partial acceptance, and zero acceptance while preserving every successfully created task.
- Let Music Analyzer multi-submit persist every accepted task association before reporting partial failure, and show accepted/rejected counts without cancelling accepted AUDIO tasks.
- Keep the existing generic message for failures that have no safe, recognized user-facing reason.
- Keep the form contents available for correction and resubmission after rejection.
- Do not change validation limits, task schemas, provider routing, execution concurrency, caching, persistence, cancellation, retry, or recovery semantics.

## Impact

- Affected specs: `generation-dialog-feedback`
- Affected code: `packages/drawnix/src/hooks/useTaskQueue.ts`, image/video generation dialogs, batch-image generation, Music Analyzer Generate page/storage projection, focused tests
- Preserved data/API semantics: no IndexedDB schema, serialized task, cache key, provider request, or public task-service contract changes
- User-visible trade-off: rejected submissions expose a concise validation reason instead of only a generic retry message; internal stack traces and request payloads remain hidden

## Evidence

- `packages/drawnix/src/utils/validation-utils.ts:49-62` enforces the 4096-pixel width and height limits.
- `packages/drawnix/src/services/task-queue-service.ts:1904-1909` throws `Invalid parameters` with the validation reason.
- `packages/drawnix/src/hooks/useTaskQueue.ts:82-93` catches the exception and returns `null` without preserving the reason.
- `packages/drawnix/src/components/ttd-dialog/ai-image-generation.tsx:901-937` and `packages/drawnix/src/components/ttd-dialog/ai-video-generation.tsx:1169-1205` therefore fall back to generic feedback even though both contain a specific invalid-parameter branch.
- `packages/drawnix/src/components/ttd-dialog/batch-image-generation.tsx:2089-2206` calls the same hook for every selected image, records only non-null results, and emits a message only when `submittedCount > 0`; an all-null result is silent and a mixed result omits rejected count/reason.
- `packages/drawnix/src/hooks/__tests__/useTaskQueue.test.ts` reproduces the current hook-boundary behavior without a network or browser dependency.
- `docs/evidence/f19-batch-image/diagnostics.md` records the batch downstream proof and the 8-file/52-test adjacent baseline.
- `packages/drawnix/src/components/music-analyzer/pages/GeneratePage.tsx:297-347` proves that a mid-loop throw skips the only `generateTaskIds` patch while earlier tasks remain accepted.
