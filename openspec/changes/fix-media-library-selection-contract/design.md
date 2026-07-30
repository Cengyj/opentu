## Context

`AssetContext.filters` is the current owner of user-selected browse filters. `MediaLibraryModal` receives invocation-local constraints from AI input, Chat, generation tools, Frame, fill, knowledge, and toolbar callers. It currently projects the invocation into that shared owner, while the grid ignores its explicit constraint props. The same modal treats callback fulfillment as insertion success, but some consumers catch or encode failure as a normal return.

The correction must separate three concepts: persistent/user browse filters, immutable invocation constraints, and the asynchronous selection result. It must not change the insertion algorithms or introduce a new retry product.

## Goals / Non-Goals

- Goals:
  - Keep picker constraints local to one open invocation and enforce them for all visible/selectable assets.
  - Preserve the user's prior browse filters across constrained picker open/close.
  - Render the single and batch action labels from their corresponding props.
  - Close exactly once only after callback success; preserve retryable selection and filters after failure.
  - Prevent duplicate callbacks while one selection is pending.
- Non-Goals:
  - Persist a new filter profile per caller.
  - Change asset dedupe, sorting, favorites, playlists, upload, preview, deletion, or cache behavior.
  - Change canvas batch placement or partially roll back already-inserted assets.
  - Add auto-retry, background insertion, queueing, or a new error store.

## Decisions

- Keep `AssetContext.filters` as the user browse-filter owner. Pass `filterType` / `filterCategory` into the grid as immutable constraints and derive an effective filter as `constraint ?? userFilter` without calling `setFilters` for the constraint.
- Constraint controls must not allow a user to display/select an asset outside the invocation contract. The UI may present the constrained type/category as fixed state, but user-controlled source/search/sort/playlists continue to work within it.
- Clear selection/batch entries that no longer match a changed invocation constraint; do not clear the user's shared browse filters.
- Add `batchSelectButtonText` to the inspector boundary. Single action uses `selectButtonText`; batch action uses `batchSelectButtonText` or the current default.
- Catch callback rejection inside each modal selection handler, retain modal and selection state, reset the single shared in-flight guard, and rely on the consumer's existing safe user message. Log only the error object through existing diagnostics; do not log asset contents or URLs.
- Canvas insertion consumers keep their current message and rethrow/throw after a failed single or batch result. Successful callbacks remain fulfilled. The modal remains the only close owner for the shared deferred flow; local fallback callers must not close on failure.
- Audit all direct modal callers. A callback that performs only synchronous state projection may continue to fulfill immediately; callbacks with persistence or insertion must reject when that operation fails.

## Alternatives Considered

- Snapshot and restore `AssetContext.filters` around picker open/close.
  - Rejected because concurrent callers, StrictMode effects, and user filter changes while open can restore stale global state; the constraint is already represented as a prop and should remain local.
- Hide filter controls without enforcing the data predicate.
  - Rejected because keyboard/selection code and future UI paths could still expose out-of-contract assets.
- Always reset to `全部` on modal close.
  - Rejected because it discards a user's prior general-library filter rather than isolating the invocation.
- Use `selectButtonText` for both actions and remove `batchSelectButtonText`.
  - Rejected because multiple current callers already express distinct single/batch intent through the public prop.
- Let callback rejection escape the React event handler.
  - Rejected because it retains the modal accidentally but creates an unhandled rejection and leaves completion semantics implicit.
- Treat an insertion error message as successful completion.
  - Rejected because it closes the only immediate retry path and contradicts the existing documented boundary.

## Risks / Trade-offs

- Existing callers may have relied on a constrained picker changing the next general-library filter.
  - Mitigation: that behavior conflicts with the prop's invocation role and was reproduced as cross-entry state leakage; tests cover prior user filters rather than assuming `全部`.
- A hidden/disabled constrained filter control can change toolbar width.
  - Mitigation: responsive screenshots at 1280/768/390/320 px in Chinese/English.
- Rethrowing after a partially successful batch insertion may keep all assets selected although some were inserted.
  - Mitigation: current shared batch executor reports a single success/failure result and does not expose reliable per-item commit details. This change preserves selection for manual review and does not auto-delete successful canvas elements; partial-result UX requires separate evidence/proposal.
- A callback can fulfill after the modal unmounts.
  - Mitigation: keep the mounted guard, call close at most once, and avoid state writes after unmount.

## Verification

- Grid/modal tests with two types/categories: constrained picker shows/selects only allowed assets; source/search/sort remain functional; closing/reopening general library preserves the prior user filter.
- Label tests: distinct single/batch values reach the correct action and count suffix; omitted batch value uses the approved default.
- Deferred callback tests: single/double-click/batch success closes once; rejection keeps modal, selection, filter, and retry action; pending duplicate activation calls the consumer once; unmount is safe.
- Caller tests: creation/quick toolbar single insertion rejection and failed batch result propagate after exactly one existing error message; success still closes/inserts once.
- Reverse-audit every direct `MediaLibraryModal` caller and record whether it is synchronous projection, local conversion, board insertion, or persistent write.
- Run focused tests, Drawnix lint/typecheck, full typecheck/test/cycles/build/size/startup, and available media-library/AI input/toolbar Playwright flows.

## Rollback Plan

Restore the constraint effect, old grid filter source, single inspector label, and old consumer completion behavior; remove the focused tests. No serialized data or cache changes, so rollback requires no migration or cleanup.
