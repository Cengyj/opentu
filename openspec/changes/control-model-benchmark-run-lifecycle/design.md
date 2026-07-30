## Context

Run state is persisted, but the execution owner exists only on the JavaScript stack of `runSession`. The current enum cannot distinguish active work from work orphaned by refresh, and local deletion can erase the only record while a provider promise remains live.

## Goals / Non-Goals

- Goals: at-most-one active run per session, truthful user stop, tracked external work, and deterministic refresh interruption.
- Non-Goals: no automatic resume/retry, new provider protocol, task-queue migration, cross-tab distributed cancellation, refund promise, or guarantee that an already accepted non-abortable provider job stops remotely.

## Decisions

- Maintain an in-memory `sessionId` run-owner map. A second start for the same session returns/joins the existing promise and makes no new provider call.
- Use a per-run cancellation token. Pending entries become cancelled without invocation. In-flight requests receive an AbortSignal only through existing compatible adapter/client boundaries; non-abortable calls remain `stopping` until settlement and late results are handled by the same run owner.
- Disable/reject removal for active/stopping sessions with safe guidance to stop and wait. Completed/draft/failed/partial/cancelled/interrupted sessions retain current deletion behavior.
- Add explicit `cancelled`, `stopping`, and `interrupted` values as needed. On load, persisted running/stopping session and entry states normalize to interrupted; no provider call is made and completed results remain intact.
- Track started/stopped/interrupted outcomes without prompt, raw response, URL, credential, or provider error text.

## Invariants

- One user start produces at most one provider invocation per selected entry in that run.
- No new entry starts after stop is accepted.
- UI never claims remote cancellation before an abort or settlement boundary confirms it.
- Refresh normalization creates no provider request, task, media record, canvas insertion, or retry.
- Existing IDs, prompts, targets, timings/results already terminal, concurrency, routing, and storage key remain compatible.

## Risks / Trade-offs

- Some providers do not support abort; stop latency then equals current in-flight settlement.
- Additive status values affect sorting/export and require exhaustive tests and tolerant rollback.
- Singleflight can hide a caller expecting a fresh rerun; explicit rerun is allowed only after the prior owner settles.

## Verification And Rollback

- Mock tests cover double start, stop before/during each modality, abortable/non-abortable adapters, deletion guard, late completion, refresh normalization, partial results, and rerun after settlement.
- Browser checks use synthetic providers only and cover start/monitor/stop/retry/delete/refresh plus keyboard/focus/live status.
- Rollback requires tolerant mapping of additive statuses, then removes owner/token/UI/tests. No session deletion is required.
