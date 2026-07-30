# Tasks: Preserve knowledge-base editor drafts

## 1. Evidence and approval

- [x] 1.1 Trace title/body input through IndexedDB, React projection, and linked canvas Card updates in both directions.
- [x] 1.2 Reproduce mutual cancellation, note-switch cancellation, and unmount cancellation with deterministic timers.
- [x] 1.3 Confirm note schemas, Markdown, Card bindings, and the normal 500 ms coalescing interval can remain unchanged.
- [x] 1.4 Check the storage-consistency and responsive changes and isolate their responsibilities.
- [ ] 1.5 Obtain user approval for merged drafts, serialized writes, switch/unmount flushing, and visible failure/retry state.

## 2. Implementation

- [ ] 2.1 Add failing permanent tests for merged title/body batches and no cross-field cancellation.
- [ ] 2.2 Add failing tests for note switch, unmount, overlapping writes, rejection, retry, and stale completion.
- [ ] 2.3 Implement the per-note draft buffer, per-note write chain, and explicit async callback contract.
- [ ] 2.4 Add localized saving/saved/error/retry feedback using existing theme and component conventions.
- [ ] 2.5 Preserve read-only Skill behavior, source/WYSIWYG editing, export, tags, media insertion, and linked Card synchronization.

## 3. Verification

- [ ] 3.1 Run the focused editor/content/service tests with exact files, counts, duration, and exit code.
- [ ] 3.2 Measure at least five normal and switch-flush saves before/after and record operation counts plus median/range.
- [ ] 3.3 Capture identical success/failure/retry states at desktop and compact viewports after the responsive change is available.
- [ ] 3.4 Run Drawnix lint/typecheck, full typecheck/tests/cycles/build/size/startup, and available smoke/feature/visual/responsive flows.
- [ ] 3.5 Rewalk switch, close/reopen, failure/retry, linked Card, and read-only paths and update the F-23 ledger/spec documentation.
