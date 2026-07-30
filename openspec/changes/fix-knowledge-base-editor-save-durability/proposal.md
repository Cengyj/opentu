# Change: Preserve knowledge-base editor drafts across debounced saves

## Why

The reachable knowledge-base editor debounces title and Markdown-body updates for 500 ms, but both fields share one timer. A deterministic component diagnostic at the current source (Node 24.14.0, Vitest 3.2.4, jsdom) recorded 3/3 current-behavior assertions in 90 ms: a body edit cancelled the pending title write, switching notes cancelled a pending title write, and unmounting cancelled it. The diagnostic file was removed after the run so the faulty behavior is not retained as a passing contract.

`KBNoteEditor` also types `onUpdateNote` as returning `void`, while `KnowledgeBaseContent` supplies an async IndexedDB-and-canvas update. Timer callbacks neither await nor catch that promise, and the editor exposes no saving, failure, or retry state. Fixing coalescing, switching, unmount flushing, async ordering, and user feedback changes observable save semantics and therefore requires approval.

## What Changes

- Keep pending title and body edits in one per-note draft buffer so editing one field cannot discard the other.
- Serialize async commits per note and queue a trailing merged commit when more input arrives during a write.
- Flush a pending draft when the user switches notes or closes the knowledge-base tool within the running page instead of clearing it.
- Make the update callback explicitly asynchronous and surface saving, saved, and failed states with a retry action while the editor is mounted.
- Preserve the 500 ms quiet-period coalescing for normal typing, existing note IDs/content formats, canvas Card synchronization, and read-only Skill behavior.
- Add deterministic failure, switching, unmount, overlapping-write, and stale-completion tests before implementation.

## Impact

- Affected specs: `knowledge-base-editor-durability`
- Affected code: `KBNoteEditor.tsx`, `KnowledgeBaseContent.tsx`, knowledge-base editor styles, focused tests, and tool-window integration coverage
- Preserved data/API semantics: no IndexedDB schema, note/tag/image record, `asset://` protocol, cache key, backup version, model route, or migration changes
- Explicit non-goal: this change does not claim durability after browser process termination, power loss, or a rejected storage write; those states remain truthful failures and must not be labelled saved
- User-visible trade-off: switching or closing can start an immediate write instead of waiting for the debounce, and a failed write remains visibly retryable
- Rollback: restore the current timer/callback implementation and remove save-status tests/UI; no data cleanup or migration is required

## Current Evidence

- `packages/drawnix/src/components/knowledge-base/KBNoteEditor.tsx:80,141-175` uses one `saveTimeoutRef` for title and body.
- `packages/drawnix/src/components/knowledge-base/KBNoteEditor.tsx:106-139,267-273` clears that timer on note-id change and unmount without invoking the pending write.
- `packages/drawnix/src/components/knowledge-base/KBNoteEditor.tsx:41-52` declares a `void` update callback.
- `packages/drawnix/src/components/knowledge-base/KnowledgeBaseContent.tsx:567-603` supplies an async callback that awaits IndexedDB and then synchronizes React and canvas state.
- The deterministic diagnostic confirms the allowed event sequences rather than inferring a defect from comments or the debounce itself.
