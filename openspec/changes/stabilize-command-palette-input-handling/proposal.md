# Change: Stabilize command-palette input handling

## Why

The reachable command palette passes the raw query directly to its fuzzy matcher. In the current production build, `Mermaid` returned the one expected command, while ` Mermaid ` returned zero commands and the visible “No matching commands” state. Leading/trailing whitespace introduced by typing or paste therefore changes a valid lookup into a false empty result.

The palette's container key handler also processes Enter, Escape and Arrow keys without checking native IME composition state. A deterministic mounted-component diagnostic dispatched the standard Chinese-composition Enter boundary (`isComposing=true`, keyCode 229): the palette called `onClose` once and scheduled the active command, which executed on the next animation frame. The same key is used to commit an IME candidate, so command execution can occur before composition finishes. Normalizing lookup input and respecting composition change observable search/execution behavior and require approval before implementation.

## What Changes

- Match commands against the query after removing leading/trailing Unicode whitespace while preserving the user's raw displayed input.
- Treat a whitespace-only query as the existing empty query and show all currently available commands.
- Preserve meaningful internal spaces and the current label/keyword/shortcut scoring, category ordering and predicate filtering.
- While native text composition is active, let the input/IME consume Enter, Escape, ArrowUp and ArrowDown without closing, executing or moving the command selection.
- Resume the current navigation/execute/close behavior after composition ends.
- Keep the existing close-before-next-frame command dispatch and command-target ownership; do not change any command's business operation, target feedback, storage or persistence.
- Add focused tests for whitespace normalization, internal whitespace, zh/en terms, composition start/update/end, keyCode 229 fallback and post-composition keyboard execution.

## Impact

- Affected specs: new `command-palette-input-consistency`
- Affected code: `packages/drawnix/src/components/command-palette/command-palette.tsx`, focused tests and F-31 evidence/documentation
- Related boundaries: `improve-command-palette-interface-accessibility` owns semantic roles, focus return, live status, touch geometry and responsive layout; each command target remains owned by F-04/F-05/F-25/F-26/F-29/F-30 or its registered feature
- Data/storage impact: none. No command ID, registry entry, board schema, task, cache, preference, localStorage, IndexedDB, backup or migration change.
- Performance impact: no performance claim. Normalization must not add registry rebuilds, command executions or persistent allocations.
- Rollback: revert query normalization/composition guards and focused tests together. No migration or user-data cleanup is required; rollback restores the verified false-empty and IME-execution risks.

## Evidence

- Query path: `packages/drawnix/src/components/command-palette/command-palette.tsx:17-49,84-103,204-216` lowercases but does not trim the query before label/keyword/shortcut matching.
- Keyboard path: the same file `:151-187` closes then schedules the active command on Enter and closes on Escape without inspecting `nativeEvent.isComposing` or keyCode 229.
- Production browser: existing `dist/apps/web`, loopback, in-app Chromium, zh-CN, 1280×720, DPR 1. Raw query ` Mermaid ` produced itemCount 0 and generic no-match text; `Mermaid` produced itemCount 1 and “Mermaid 转流程图”. No command was executed.
- Component diagnostic: Node v24.14.0, Vitest 3.2.4, jsdom, real `CommandPalette`, one controlled command/board and no real storage/network/clipboard. Composition Enter caused close1, scheduled perform1. Corrected run exit 0, 1/1 file and 2/2 tests; relevant test 406 ms, report 1.75 s. Temporary file deleted.

