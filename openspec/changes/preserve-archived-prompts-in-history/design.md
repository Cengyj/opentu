## Context

Prompt history is a derived view. Manual prompt entries and metadata overrides come from prompt storage, while generated prompt records come from lightweight terminal task summaries in IndexedDB. The task queue keeps at most 100 active in-memory tasks and archives older terminal records without deleting them. The prompt-history caller currently accepts the task reader's default active-only behavior, so the derived view cannot reach the durable archived records.

## Goals / Non-Goals

- Goals:
  - Make archived terminal prompts visible after automatic retention, refresh, and backup restore.
  - Keep the UI boundary limited to lightweight task summaries.
  - Keep deletion, editing, pinning, filtering, aggregation, preview, and paging behavior unchanged.
- Non-Goals:
  - Do not unarchive tasks or add them back to the active task queue.
  - Do not change the 100-task retention threshold or task panel semantics.
  - Do not change task, backup, prompt override, or IndexedDB schemas.
  - Do not optimize the current full-history aggregation until measurements prove a bottleneck and any semantic change is separately approved.

## Decisions

- Decision: opt into archived records at the prompt-history service call site by passing `includeArchived: true` to the existing lightweight reader.
  - Alternative: change the reader's global default to include archived records.
  - Rejected because: asset, task, recovery, and future callers may rely on active-only defaults; a global change broadens risk beyond prompt history.
- Decision: keep the current cursor, summary conversion, aggregation, filtering, and UI paging pipeline.
  - Alternative: load full tasks through `getAllTasks()` and filter in the service.
  - Rejected because: it violates the formal lightweight-record requirement and can expose large request/result fields to the UI layer.
- Decision: treat archived and active copies identically during sent-prompt aggregation.
  - Alternative: show an archive badge or a separate archive section.
  - Rejected because: that would add a new product concept rather than restore the existing derived history.

## Invariants

- Archived records remain archived in IndexedDB and absent from active task memory/UI unless another existing view explicitly includes them.
- Only terminal completed, failed, and cancelled tasks contribute to prompt history.
- Deleted source/resolved prompt content remains excluded; overrides and pinned state still apply after aggregation.
- Task summaries continue to exclude large uploaded media, analysis payloads, tool-call arrays, and full media blobs.
- No raw prompt text is added to analytics; existing prompt actions continue to emit only summary metrics.

## Risks / Trade-offs

- A long archived history increases cursor work because `getPromptHistoryPage()` currently scans all matching terminal summaries before aggregating and slicing a UI page.
- Archived and active tasks with the same sent prompt can add more result previews to one aggregate record; current deduplication and ordering rules must remain deterministic.
- A future retention or schema change could alter available archive depth; regression tests must exercise the caller option and reader filtering boundary separately.

## Verification and Performance Thresholds

- Red/green service test proves the prompt-history caller requests `includeArchived: true`.
- Reader integration test proves archived completed, failed, and cancelled summaries are returned only when opted in, while active-only calls remain unchanged.
- Aggregation test proves mixed archived/active duplicates keep current pinned/latest/result rules.
- Backup/restore regression proves an archived prompt task remains queryable after restore.
- At 100, 1,000, and the largest practical local fixture size, run at least five cold-reader and five warm-reader samples; record browser/runtime, data shape, median, min/max, batch count, and UI time to first rendered page. Any new performance work requires evidence and, if it changes paging or cache semantics, a separate approved change.

## Rollback

- Remove the prompt-history caller's explicit `includeArchived` option and its regression tests.
- No data cleanup or migration is required because implementation only changes reads; archived task records remain compatible and untouched.

