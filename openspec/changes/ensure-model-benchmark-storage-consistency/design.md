## Context

The benchmark store has one RxJS in-memory owner and one KV whole-value owner. Constructor hydration and every mutation can independently replace that value. UI readiness currently describes only whether the load callback finished, not whether a mutation was based on the authoritative snapshot or durably committed.

## Goals / Non-Goals

- Goals: prevent late hydration overwrite, preserve accepted write order, expose truthful persistence failure, and retain existing data/API compatibility.
- Non-Goals: no IndexedDB schema redesign, per-session keys, cloud/cross-tab locking, retry loop, migration, history expansion, or task-queue integration.

## Decisions

- Retain one initialization promise/result in the singleton; mutations that write persisted state await it before reading or changing sessions.
- Remember initialization failure and reject persisted mutations without writing a provisional empty snapshot.
- Chain whole-state writes in accepted order. A rejection is reported but does not permanently poison later writes.
- Sequence persistence feedback by accepted mutation so an older rejection cannot overwrite a newer success.
- Continue applying `trimSessions` and preview/session sanitization at the same write boundary.

## Invariants

- A successfully resolved mutation is reflected in both the current subject state and its completed KV write.
- A late load cannot replace a mutation accepted against initialized state.
- Key, retention cap, IDs, timestamps, active-session selection, entry/session schema, and task-history separation remain unchanged.
- Failure feedback contains no prompt, preview, model response, URL, provider error body, credential, or stack.

## Risks / Trade-offs

- Slow storage delays session mutation instead of accepting it against provisional state.
- Serialized writes can increase burst latency; correctness is the requirement, and five-run mutation latency/queue depth will be reported without claiming a speedup.
- UI consumers may still invoke synchronous methods without handling readiness; reverse-call tests must cover every reachable mutation.

## Verification And Rollback

- Red tests cover delayed success/failure hydration, create/remove/feedback/ranking/run mutations before ready, reverse write completion, write rejection recovery, retention, and active ID.
- Browser checks cover slow/read-failure/write-failure history state with only mock storage.
- Run focused and repository gates against baseline. Rollback the readiness chain, write queue, feedback, and tests together; no data deletion or migration is needed.
