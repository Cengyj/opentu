## Context

`CommandPalette` stores the visible query and active index locally. `matchCommand` passes the raw query to `fuzzyScore`, which lowercases label/query and scores exact, prefix, substring or ordered-character matches. A non-empty whitespace-only string does not use the existing empty-query branch. The palette receives all keyboard events bubbled from its input and maps ArrowUp/Down, Enter and Escape immediately.

The palette closes before command dispatch and invokes `cmd.perform(board)` in `requestAnimationFrame`. Business operations and their asynchronous failure/result handling belong to the target feature. The correction must stop false shell activation without modifying the registry or target calls.

## Goals / Non-Goals

- Goals:
  - Make leading/trailing whitespace irrelevant to search while preserving raw input display and meaningful internal spaces.
  - Prevent palette navigation, close and execution while the search input is composing text.
  - Preserve post-composition keyboard behavior, command order, predicate visibility and target dispatch.
- Non-Goals:
  - Replace fuzzy matching, add ranking telemetry/history/recents, tokenize queries, add aliases or modify command labels.
  - Change command target behavior, completion/failure feedback, save/export semantics or dialog focus.
  - Persist search text or add a new store.
  - Claim faster search or input latency without measurement.

## Decisions

- Derive `normalizedQuery = query.trim()` for matching only. Keep `query` unchanged in the controlled input so the component does not move the caret or rewrite pasted text.
- Use JavaScript's current Unicode-aware trim behavior. Preserve internal whitespace and pass the normalized string to the existing scoring algorithm.
- At the start of the shared key handler, detect `e.nativeEvent.isComposing` or the established keyCode 229 fallback. For Enter, Escape, ArrowUp and ArrowDown during composition, return without `preventDefault`, selection change, close or command scheduling so the browser/IME owns the event.
- After `compositionend`, the next ordinary key uses the existing handler. Do not synthesize an execution from the composition-ending event.
- Keep current empty-query all-commands behavior and predicate filtering. A whitespace-only query becomes that same existing state.

## Alternatives Considered

- Rewrite the controlled input with `query.trim()` on every change.
  - Rejected because it changes visible text/caret behavior while typing and can interfere with composition.
- Split and collapse all whitespace.
  - Rejected because internal spaces can be meaningful to English labels and pasted queries; only boundary whitespace is evidenced.
- Ignore only Enter during composition.
  - Rejected because Arrow keys and Escape are also used by IMEs and currently change/close the palette before composition ends.
- Disable keyboard commands for Chinese locale.
  - Rejected because IME composition is event state, not application locale, and English/multilingual users can also use IMEs.
- Change command dispatch to synchronous execution.
  - Rejected because target mounting/focus and the verified issue do not require changing execution timing.

## Risks / Trade-offs

- Some query intentionally ending in whitespace will now match as if trimmed.
  - No current command label/keyword requires boundary whitespace. Preserve internal whitespace and add registry-wide matching tests.
- Browser composition events differ.
  - Cover `isComposing`, keyCode 229 and post-`compositionend`; browser/manual IME verification remains required where available.
- Returning without `preventDefault` during composition delegates behavior to the IME/browser.
  - This is intentional; verify the palette stays open and active index/command call counts remain unchanged.

## Verification

- Search: leading/trailing ASCII and Unicode whitespace, whitespace-only, internal spaces, Chinese/English labels, keyword/shortcut matches and no-match.
- Composition: Enter/Escape/ArrowUp/ArrowDown under `isComposing`; keyCode 229 fallback; composition end followed by ordinary navigation/execute/close.
- Registry adjacency: same available command count/order/predicates for normalized equivalent queries; target `perform` exactly once only after valid activation.
- Browser: real input/paste at desktop and compact, zh/en where safe, without invoking destructive/provider/file commands.
- Run focused tests, Drawnix typecheck/lint comparison, full typecheck/test comparison, cycles, production build, size/startup and relevant smoke/feature/visual/responsive suites.

## Migration and Rollback

No migration, cache invalidation, persisted preference or data cleanup is required. Rollback removes only normalization/composition handling and tests.

