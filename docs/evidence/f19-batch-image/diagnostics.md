# F-19 Batch Image Diagnostics

## Environment and safe-test boundary

- Current Vite source served at `http://127.0.0.1:7200/`.
- Codex in-app Chromium, DPR 1, Chinese UI, rendered light colors, no network or CPU throttling.
- No provider credentials were entered and no paid generation request was submitted.
- Screenshots: `desktop-1280x720.png`, `mobile-390x844.png`, and `tablet-768x1024.png`.
- Raw geometry and DOM counts are in `metrics.json`.

## Reachable entry and rendered states

1. Open the app, activate “打开工具箱”, locate `[data-tool-id="batch-image"]`, and activate its window action.
2. The live component renders five default rows, a model selector, selected-row submission, Excel import/export, reference-image controls, a desktop asset sidebar, and a horizontally scrollable compact table.
3. A prompt cell click gives `.batch-image-generation` programmatic focus. Pressing Enter opens the row textarea; Escape closes it. This proves the documented spreadsheet shortcuts work after pointer selection.

## Cache initialization ordering proof

1. `batch-image-generation.tsx:366-403` mounts five editable default rows and starts `kvStorageService.get()` without gating the UI.
2. All row/edit/import handlers call `setTasks()` while the read can still be pending.
3. When the pending read resolves, `batch-image-generation.tsx:381-394` unconditionally calls `setTasks(cached.tasks)` for a non-empty cache.
4. The save effect at `batch-image-generation.tsx:675-688` waits for `cacheLoaded`, so it prevents a premature write but does not preserve a mutation already accepted before the read settled.
5. Deterministic schedule: pending read → user edit produces state E → read resolves with snapshot C → unconditional state replacement yields C. No data merge, dirty version, mutation log, or pre-hydration interaction gate exists on this chain.

Expected behavior requires product approval because either gating the initial UI or reconciling E with C changes observable loading and draft-recovery semantics. No runtime fix was made.

## Task-creation feedback proof

1. Selected valid rows reach `executeSubmit()` at `batch-image-generation.tsx:2089-2206`.
2. Each requested image calls `useTaskQueue().createTask()` at `:2174`.
3. `useTaskQueue.ts:82-93` catches every service exception and returns only `null`; the existing diagnostic hook test proves the concrete invalid-dimension reason is discarded.
4. The batch loop counts and records only non-null tasks at `batch-image-generation.tsx:2174-2193`.
5. Feedback is rendered only when `submittedCount > 0` at `:2196-2202`. Therefore all-null creation produces no message, while mixed success/null reports only the success count and does not disclose rejected count or safe reason.

The related eight-file baseline test run exited 0 with 8/8 files and 52/52 tests passing. Existing `indexedDB is not defined` stderr from the preference suite is test-environment noise and did not fail assertions.

## Accessibility and responsive proof

- The five inactive prompt cells are `div.excel-cell.cell-prompt` elements with pointer handlers but no role or tab stop (`batch-image-generation.tsx:2631-2652`). Count cells have the same entry model at `:2878-2897`.
- The document key handler returns unless the event target or current focus is already inside `.batch-image-generation` (`:2358-2367`); the root itself is `tabIndex={-1}` at `:3146` and is focused only by `selectCell()` at `:838-847`.
- Five live toolbar icon buttons had role `button` but empty accessible names. Their JSX relies on `HoverTip` without `aria-label` or text at `:3177-3243`. Column fill buttons and the library close control repeat that pattern at `:3401-3475` and `:3574-3584`.
- At `390×844` after a desktop-to-mobile transition, the tool window was `x=40..440`, 50 CSS px outside the 390 px viewport, while document `clientWidth=scrollWidth=390`. The close control was outside the screenshot. This is owned by pending `fix-tool-window-viewport-transition`, not by a new F-19 window implementation.

## Current evidence classification

- Confirmed: pre-hydration accepted edits can be overwritten by the late cache snapshot (static happens-before proof).
- Confirmed: zero accepted task creations produce no user feedback; partial acceptance omits rejection count/reason (current hook diagnostic plus downstream static proof).
- Confirmed: the spreadsheet has no keyboard-only entry contract and several existing icon actions are unnamed (live DOM plus source event chain).
- Confirmed adjacent shared issue: the transitioned outer tool window can place the close control outside the compact viewport (live DOM rectangles and screenshot); covered by an existing change.
- Hypothesis only: accumulated old failed task IDs make a successful resubmission remain `partial`; no authoritative retry/history expectation exists yet.
- Hypothesis only: Data URL copies in the batch draft and asset store cause unacceptable storage or memory cost; no five-sample size/write/recovery measurement exists yet.

No code or CSS was changed during this diagnostic phase.
