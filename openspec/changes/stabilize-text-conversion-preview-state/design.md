## Context

The two conversion dialogs own input text, a deferred normalized value, a lazy converter module, a preview array and an error. Mermaid parsing is asynchronous. Markdown parsing is currently synchronous after the lazy module resolves, but its effect is also asynchronous at the module boundary and shares the same retained-preview insertion pattern. Neither component records which input produced `value` or `error`.

Both insertion paths deep-clone the retained preview, call `board.insertFragment(..., WritableClipboardOperationType.paste)`, reveal the insertion point and close the dialog. The resulting Plait change is forwarded through React Board and the existing App/workspace save path. The correction must be made before that mutation boundary without changing parser packages or persistence owners.

## Goals / Non-Goals

- Goals:
  - Make the current normalized input the single owner of loading, parsing, error and preview state.
  - Ignore late completions that no longer belong to the current input or mounted converter generation.
  - Prevent button and keyboard insertion unless the current input owns a successful non-empty result.
  - Preserve successful insertion geometry, deep cloning, Plait history, viewport reveal, close and autosave behavior.
- Non-Goals:
  - Add parser cancellation APIs that the packages do not expose, a worker, debouncing beyond current `useDeferredValue`, caching, persistence or automatic retry.
  - Change Mermaid/Markdown syntax, examples, supported diagram types, fallback quote semantics or element schemas.
  - Redesign dialog visuals, labels, error announcement or responsive layout; those are owned by the separate interface change.
  - Claim lower latency, fewer renders or reduced memory without measurements.

## Decisions

- Define a small local conversion-state contract keyed by a monotonically increasing request token plus the normalized input string and active converter generation. A completion may commit only if all identities still match and the component is mounted.
- Mark the current state pending before invoking the parser. A successful current request stores its result and input identity; a current failure stores its error and clears insertion eligibility. Obsolete success/failure completions do not alter current state.
- Keep a previous visual preview only if desired by the approved interface, but never treat it as eligible for insertion when the input identity differs, parsing is pending, or the current request failed.
- Use one `canInsertCurrentResult` predicate for the panel button and Ctrl/Cmd+Enter handler. The mutation function rechecks the predicate to protect programmatic or stale-handler activation.
- Keep the existing first parse and quote-replacement fallback inside one request identity. A fallback completion from an obsolete request is still ignored, and no extra retry is added.
- Do not start conversion against placeholder stub APIs. Loading and load failure are explicit state boundaries; the real converter module starts the first eligible conversion.

## Alternatives Considered

- Keep every completion and only disable Insert while a Promise is pending.
  - Rejected because the verified out-of-order completion would still replace a newer preview after pending clears.
- Clear `value` on every keystroke.
  - Rejected as the only mechanism because a late obsolete success can repopulate it, and blanking the preview may create unnecessary visual churn. Eligibility must be identity-based.
- Cancel the Mermaid parser.
  - Rejected because the current package API exposes no cancellation signal. Ignoring obsolete results is the minimal safe boundary.
- Serialize parses.
  - Rejected because waiting for an obsolete slow parse delays newer input and changes responsiveness without benefit.
- Move all conversion to a worker or Service Worker.
  - Rejected as an architecture/execution-semantics change without performance evidence.

## Risks / Trade-offs

- A previous preview may remain visible while the current input is pending or invalid.
  - The interface must make it visibly unavailable and the shared predicate must block both insertion paths. Clearing versus retaining the preview is visual policy owned by the interface change, not correctness.
- Parser work for obsolete input still consumes time.
  - The package is not cancellable. The guard prevents stale state/mutation without adding work; performance optimization remains measurement-gated.
- React Strict Mode/effect replay can start more than one request in development.
  - Tokens and cleanup must make replay harmless. Tests must include remount/unmount and late settlement.
- Markdown currently resolves synchronously after load.
  - Applying the same state contract keeps behavior consistent and protects future async package behavior without adding an abstraction outside the two dialogs.

## Verification

- Component: older request resolves after newer; older failure after newer success; new input pending after previous success; new input failure after previous success; empty input/result; fallback first-failure/second-success and double failure; lazy-load failure; unmount/close before settlement.
- Interaction: Insert button disabled/inert and shortcut inert during loading/pending/error/stale/empty; both insert exactly the current successful result once.
- Board integration: inserted IDs/content equal the current preview; existing smart/default point, deep clone, paste operation, history and reveal behavior remain; blocked attempts create no board operation and do not close.
- App adjacency: successful insertion reaches existing after-change/workspace save once; blocked attempts create no workspace save solely from conversion.
- Browser: same input/data/theme at desktop and compact widths; capture initial, pending, success, failure and recovery states without paid/provider work.
- Run focused tests, Drawnix typecheck/lint comparison, full typecheck/test comparison, cycles, production build, size/startup and relevant smoke/feature/visual/responsive suites. Record exact exits and baseline deltas.

## Migration and Rollback

No data migration, cache invalidation, parser-package change or user-data cleanup is required. Rollback removes the state identity/predicate and tests together; existing canvas elements remain ordinary content.

