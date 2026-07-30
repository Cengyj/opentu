# Design: Knowledge-base editor save durability

## Boundaries and invariants

The user path is title input or Milkdown change → `KBNoteEditor` draft/coalescer → async `KnowledgeBaseContent.handleUpdateNote` → `knowledgeBaseService.updateNote` → note-content and note-meta stores → React list/current-note projection → linked canvas Card updates. Read-only system/external Skill notes never enter this path.

The change keeps note IDs, metadata/content records, Markdown, Card `noteId`, the 500 ms normal typing delay, and current source/read-only modes unchanged. It does not add a draft database or localStorage journal.

## Decisions

- Store a pending `Partial<{ title; content }>` keyed to the current note id; merge fields on every edit and capture the note id with the batch.
- Use one coalescing timer without treating its payload as a single-field event. On expiry, atomically detach the current batch and pass it to a per-note promise chain.
- If input arrives during a commit, retain it as the next batch. A late success or failure may update only its captured note/save generation and cannot overwrite another note's editor status.
- Make `onUpdateNote` return `Promise<void>`. The mounted editor shows saving/saved/error state; failure restores the failed batch ahead of later pending fields and exposes retry.
- On note-id change or unmount, clear only the timer and immediately enqueue its captured batch. In-page unmount does not await React cleanup, but the already-started IndexedDB promise remains owned by the parent callback. Selection and current-note projection must ignore stale completions while still updating the originating note in the list.
- Keep storage compensation and multi-store atomicity in `ensure-knowledge-base-write-consistency`; this change consumes the truthful success/rejection boundary and does not duplicate it.

## Alternatives rejected

- Separate title and body timers: avoids mutual cancellation but still permits out-of-order writes and loses both pending fields on switch/unmount.
- Save every keystroke: removes the quiet period but increases IndexedDB and canvas writes without evidence that it is necessary.
- Synchronously journal full Markdown in localStorage: changes durable format and privacy exposure and is not justified by the current in-page loss evidence.
- Add a generic repository/event bus: no reuse or correctness evidence requires a new architectural layer.

## Risks and verification

- A write completion can race a note switch. Tests must prove it updates only the originating note and never replaces the newly selected draft.
- A failed batch followed by new typing can reorder fields. Tests must prove merge precedence is deterministic and retry sends the latest value once.
- Unmount-started promises cannot update unmounted local state. Cleanup and parent-owned callbacks must avoid React warnings and unhandled rejections.
- Measure at least five title-only, body-only, merged-field, and switch-flush samples before/after, recording commits, IndexedDB calls, input-to-write latency, median/range, and any interaction cost. No speed claim is allowed without those values.
- Verify normal, failure, retry, switch, close/reopen-in-page, read-only, linked Card, source/WYSIWYG, and long Markdown paths; then run narrow tests, Drawnix/full typecheck, full tests, cycles, build, size, startup, and available browser flows.

## Rollback

Remove the draft coordinator, async callback contract, save-status UI, and focused tests. Restore the previous callbacks. No schema or stored data changes require reversal.
