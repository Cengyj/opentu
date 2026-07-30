# F-31 command palette fact model

Date: 2026-07-30

## Scope, user intent, and evidence boundary

The user opens the existing command palette from the application menu or `mod+K`, searches the commands currently allowed by board predicates, moves the active command with pointer or keyboard, executes it once, and either hands focus to the command target or returns to the prior workflow after cancellation.

In scope: menu/hotkey entry, deferred mount, raw query and fuzzy scoring, predicate filtering, category ordering, active-index ownership, pointer/keyboard activation, close-before-dispatch, shell focus/semantics/status, compact/short-landscape geometry, and palette-local motion. Command business operations, their feedback, board/storage mutations, dialogs, exports, settings, and recovery remain with F-04/F-05/F-25/F-26/F-29/F-30 and the other registered feature owners.

Evidence categories are kept separate:

- Confirmed source facts: current TypeScript/SCSS paths and the absence/presence of explicit contracts.
- Measured runtime results: existing `dist/apps/web` served over loopback in the in-app Chromium, zh-CN, DPR 1, with the exact viewports and one sample per UI state listed in `metrics.json`.
- Controlled component results: Node v24.14.0, Vitest 3.2.4, jsdom, real `CommandPalette`, a controlled board/command and no real storage, network, provider, clipboard, file, or destructive board operation.
- Unknowns remain unknown: there is no five-sample performance result, no formal Playwright execution, and no complete locale/theme/device matrix.

No runtime, stylesheet, translation, registry, storage, schema, migration, or permanent-test file was changed during this fact-modeling pass.

## Forward and reverse call chain

1. Application-menu entry `packages/drawnix/src/components/toolbar/app-toolbar/app-menu-items.tsx:246-266` or non-text `mod+K` in `packages/drawnix/src/plugins/with-hotkey.ts:138-153` writes `appState.openCommandPalette=true`.
2. `packages/drawnix/src/drawnix.tsx:857-867` enables the deferred feature tree. `packages/drawnix/src/components/startup/DrawnixDeferredFeatures.tsx:115-117,177-190` lazy-mounts `CommandPalette`; its `onClose` writes the same boolean false. No opener identity is passed.
3. `packages/drawnix/src/components/command-palette/command-palette.tsx:51-82` owns session-only `query` and `activeIndex`, derives the language-specific 37-entry registry from `command-registry.ts:27-418`, and receives the current `PlaitBoard`. Command IDs, labels, keywords, optional shortcut/predicate, and `perform(board): void` are typed at `command-palette.types.ts:3-38`.
4. Raw query flows through `matchCommand`/`fuzzyScore` at `command-palette.tsx:17-49`; `:84-103` scores label, keywords and shortcut, removes nonmatches and false predicates, then sorts by score/category. `:105-124` groups the projected commands and flattens them for navigation. In the measured empty-selection production state, 27 of the 37 registry entries were available.
5. Open resets query/index and schedules input focus at `command-palette.tsx:126-134`; `:136-149` clamps an out-of-range index and calls `scrollIntoView({block:'nearest'})`. Input changes at `:201-216` retain the raw string and reset the index to zero.
6. Pointer hover/click at `command-palette.tsx:227-260` changes the visual active index or calls `executeCommand`. The shared key handler at `:161-187` wraps Arrow navigation, executes the active item on Enter, and closes on Escape.
7. Execution at `command-palette.tsx:151-159` first calls `onClose`, then schedules exactly the selected registry `perform(board)` on the next animation frame. From this boundary the target feature owns board transforms, dialogs/drawers, file APIs, storage, cache, task/provider work, result/error feedback, analytics and recovery.
8. Reverse tracing from the visible active row leads to the single `activeIndex` state writer family (open/query reset, Arrow, hover, clamp). Reverse tracing from palette close leads to overlay click, Escape, or `executeCommand`; reverse tracing from a target operation leads to its registry `perform` and then to those activation paths. Query/active state has no persistent writer, cache key, migration, network request, log, or analytics event. The menu entry alone has `data-track="toolbar_click_menu_commands"`; no query text is logged by this shell.

State owner and invariants: the shell owns only open/query/active projection; the board and target feature own durable mutations. Existing command IDs/order/predicates, target invocation, close-before-next-frame dispatch, theme tokens, z-index and desktop density are invariants for either proposed correction. No new command, recent/history model, search syntax, telemetry or persistent query is proposed.

## Confirmed findings

### [PALETTE-SEARCH-001]

Status: confirmed fact.

User scenario and impact: a user pastes or types boundary whitespace around an otherwise valid command term. The palette reports no match, so the existing command is not selectable from that query.

Reproduction: in the current production build at 1280×720, type ` Mermaid ` in the zh-CN palette. The result count is 0 and the visible text is `未找到匹配的命令`. Replace it with `Mermaid`; the result count is 1 and the row is `Mermaid 转流程图`. No command was executed.

Current versus expected: current matching lowercases the raw query but does not remove boundary whitespace. The proposed contract keeps the raw displayed value/caret while matching its boundary-trimmed value; whitespace-only uses the existing empty-query projection and internal spaces stay meaningful.

Evidence, strength, and call chain: production result plus `command-palette.tsx:17-49,84-103,204-216`; high confidence. Input `onChange` -> raw `query` -> `matchCommand` -> label/keyword/shortcut scoring -> zero groups -> generic empty node.

Root cause and range: matching and display share one raw query value. It affects label, keyword and shortcut searches with leading/trailing Unicode whitespace; no current registry term requires boundary whitespace.

Candidate and alternative: approval-only `stabilize-command-palette-input-handling` derives `query.trim()` for matching only. Rewriting the controlled value or collapsing internal whitespace was rejected because neither is evidenced and both change caret/term semantics.

Risk, validation, and rollback: test ASCII/Unicode boundary whitespace, whitespace-only, internal spaces, zh/en label/keyword/shortcut matches, predicate/order identity and raw caret/value. Revert normalization and focused tests together; there is no data recovery.

### [PALETTE-IME-002]

Status: confirmed fact.

User scenario and impact: while a user confirms a Chinese IME candidate with Enter, the palette closes and activates the current command before composition has ended.

Reproduction: a deterministic mounted-component diagnostic dispatched Enter with `isComposing=true` and keyCode 229. `onClose` was called once; after the next animation frame the controlled active command was called once.

Current versus expected: `command-palette.tsx:161-187` handles Enter/Escape/Arrow keys without inspecting native composition state. During active composition those keys must remain owned by the IME, with ordinary behavior resuming only after composition ends.

Evidence, strength, and call chain: real component/handler result plus direct source; high confidence. Composing input keydown -> bubbling panel handler -> `preventDefault` -> `executeCommand` -> close -> animation-frame target call.

Root cause and range: the shared handler has no `nativeEvent.isComposing` or keyCode 229 guard. Enter produces the measured unwanted activation; Escape/Arrow behavior is statically routed through the same unguarded switch but was not separately invoked in the production browser.

Candidate and alternative: the input-handling change delegates Enter/Escape/ArrowUp/ArrowDown to the browser while composition is active. Locale-based disabling and synchronous target dispatch were rejected because composition is event state and neither addresses the boundary.

Risk, validation, and rollback: cover `isComposing`, keyCode 229 fallback, composition start/update/end, no close/index/target calls during composition, then exactly-one ordinary navigation/activation after end. Revert the guard and tests; no persistent state exists.

### [PALETTE-SEMANTICS-003]

Status: measured runtime result.

User scenario and impact: a screen-reader user can focus the search input, but cannot identify the visually modal command surface, its controlled command options, the active option, or no-result status.

Reproduction: open the production palette at 1280×720 with no selected element. Overlay, panel and list have no role/name. The input has no explicit accessible label, `aria-controls`, `aria-expanded` or `aria-activedescendant`. All 27 available rows have no role, ID, `aria-selected` or tab index. ArrowDown visually moves the active class from `手形工具` to `选择工具` while the exposed selection relationship remains absent. The whitespace no-match node has no role/live state.

Current versus expected: generic `div` markup at `command-palette.tsx:194-265` conveys state only through class names. The proposed interface exposes one localized named modal and an input-owned combobox/listbox/group/option model with one selected/active-descendant option and a concise result/no-result status.

Evidence, strength, and call chain: production DOM/keyboard observation plus render source; high confidence for the measured zh-CN state. Open -> focus input -> query/predicate projection -> generic group/row nodes -> CSS-only active class/empty node.

Root cause and range: the shell implements visual structure without a programmatic relationship. It affects palette-level naming, selection and result state; it does not establish semantics or feedback for the executed target.

Candidate and alternative: approval-only `improve-command-palette-interface-accessibility` adds stable command-derived option IDs and standard relationships while keeping options out of the Tab sequence. Adding only `role=dialog` or making 27–37 independent Tab stops was rejected because neither preserves the current searchable Arrow model with complete state.

Risk, validation, and rollback: IDs and filtered active state can drift; test filter/predicate/locale changes, Arrow wrap, pointer hover, zero results and concise live output. Revert semantic/i18n wiring and tests together; no data effect.

### [PALETTE-FOCUS-004]

Status: confirmed fact.

User scenario and impact: after cancelling the palette, keyboard focus is lost to the document body instead of returning to a stable workflow control. This forces keyboard users to rediscover their prior position.

Reproduction: production menu -> palette -> Escape left `document.activeElement===BODY`. A controlled component mounted with a connected `Stable opener` button produced the same BODY result; the opener did not regain focus. The corrected diagnostic run passed 2/2 assertions and the temporary test was deleted.

Current versus expected: opening schedules input focus, but `CommandPaletteProps` and the deferred mount pass no invoker or close reason, and unmount performs no restoration (`command-palette.tsx:10-15,126-134,151-159,180-183`; `DrawnixDeferredFeatures.tsx:177-190`). Cancellation/non-surface execution should return to a connected stable owner; commands opening another focus-owning surface must hand final focus to that target.

Evidence, strength, and call chain: production and controlled component results plus missing owner transport; high confidence for Escape cancellation. Menu row/hotkey prior focus -> boolean open with no owner -> input focus -> Escape -> boolean false/unmount -> BODY.

Root cause and range: open state records only a boolean, and close has no reason/owner protocol. It affects cancellation from the measured menu/component path. Outside-click, hotkey and every target-specific final-focus path remain to be verified, not inferred as individually reproduced defects.

Candidate and alternative: the interface change captures a connected prior owner plus stable menu fallback, distinguishes cancel/non-surface execute from focus-owning target handoff, and prevents a late restoration from stealing target focus. Always returning to BODY or always returning to the invoker was rejected because the former reproduces the loss and the latter conflicts with target dialogs/drawers.

Risk, validation, and rollback: restoration can race the next-frame `perform`; test menu and hotkey, Escape/outside, tool/board commands versus Settings/search/conversion targets, disconnected owners, exact focus and one target call. Revert focus-owner/close-reason wiring and tests; no stored data changes.

### [PALETTE-COMPACT-005]

Status: measured runtime result.

User scenario and impact: at the measured compact viewport, the search and command activation boxes are smaller than the repository's existing 44×44 compact touch convention, reducing touch-operable area.

Reproduction and raw values: production zh-CN at 390×844, DPR 1. Panel is 358×420 at y=126.59375..546.59375; actual input height is 22.5 px; first command row height is 37.390625 px; list `clientHeight/scrollHeight=373/1198`.

Current versus expected: `command-palette.scss:15-34,41-53,67-72,96-113` has no compact/coarse-pointer target rule. The repository defines `$mobile-button-min-size:44px` at `packages/drawnix/src/styles/_responsive.scss:33` and uses the same scoped convention in existing accessibility requirements. Proposed compact search/option boxes are at least 44×44 CSS px without enlarging glyphs or changing desktop density.

Evidence, strength, and call chain: one exact DOMRect sample and static styles; high confidence for 390×844 only. Compact viewport -> unchanged desktop padding/line box -> 22.5/37.390625 px activation geometry -> pointer/touch event.

Candidate and alternative: scoped compact/pointer-coarse minimum activation height with internal list scroll. Shrinking content further or globally increasing desktop rows was rejected because it conflicts with the documented compact target and changes an unmeasured desktop need.

Risk, validation, and rollback: taller rows increase scroll length; measure 320×568, 375×667, 390×844, 640×360, tablet/desktop, coarse pointer, zoom/high-DPI, zh/en and hit-test callback counts. Revert scoped CSS/tests; no data recovery.

### [PALETTE-LANDSCAPE-006]

Status: measured runtime result.

User scenario and impact: in a 640×360 short landscape viewport, the palette extends below the visible and scroll-locked page; wrapping from the first to last command selects a row that remains completely outside the viewport.

Reproduction and raw values: panel y=54..474 while viewport/body height is 360 and body `clientHeight/scrollHeight=360/360`, `overflow-y:hidden`. List y=101.5..474. ArrowUp from the first item wraps to `清除画布`; its row is y=436.3125..473.703125 and therefore fully below y=360.

Current versus expected: overlay top padding is 15 vh and panel `max-height:420px` with no viewport-height bound (`command-palette.scss:3-25`); `scrollIntoView` cannot make the row visible outside the clipped panel region. The complete panel/list viewport and active option must remain within the dynamic viewport while background scroll stays locked.

Evidence, strength, and call chain: production screenshot, DOM geometry and CSS; high confidence for 640×360. Viewport -> 15 vh top + fixed 420 px panel -> bottom 474 -> Arrow wrap -> item scroll within over-height panel -> selected row remains outside page viewport.

Candidate and alternative: bound panel height with safe `min(420px, available dynamic viewport)` sizing and retain internal list scrolling/active reveal. Unlocking body scroll or shrinking text was rejected because it moves the background canvas or does not fix the panel boundary.

Risk, validation, and rollback: dynamic viewport/safe-area support differs; verify short landscape variants, orientation changes, locked body, complete active row after Arrow/pointer, focus and same-state screenshots. Revert bounded layout/tests; no data effect.

### [PALETTE-MOTION-007]

Status: confirmed static fact.

User scenario and impact: users requesting reduced motion still receive the palette's nonessential overlay opacity and panel scale/translate animations and option background transition.

Reproduction/static proof: `command-palette.scss:3-25,96-113,152-170` unconditionally applies 120 ms overlay and 150 ms scale/translate animations plus an 80 ms option transition. A repository search finds no command-palette `prefers-reduced-motion` rule.

Current versus expected: preference state does not alter this shell. The proposed interface suppresses palette-local nonessential animation/transition under `prefers-reduced-motion:reduce` while preserving immediate focus, filtering, selected state and execution.

Evidence, strength, and call chain: direct stylesheet cascade proof; high confidence for current CSS. OS/browser preference -> media cascade (no matching override) -> same animation declarations -> rendered open/active transition.

Candidate and alternative: a palette-scoped reduced-motion media rule. Keeping motion because durations are short was rejected because duration does not remove the scale/translate/blur exposure; globally disabling all app motion is outside this feature.

Risk, validation, and rollback: CSS specificity can leave one transition active; inspect computed animation/transition names/durations with preference on/off and verify immediate focus/action. Revert the scoped media rule/tests; no data change.

## Hypotheses and unknowns retained without runtime change

- The production empty-selection state exposes 27 of 37 registry entries. Predicate behavior under live multi-selection/undo state and active-index identity across every board mutation was not exhaustively measured. Do not change predicate projection without a failing fixture.
- Query matching rebuild and 37-row rendering have no five-sample input latency, React commit, long-task or memory profile. There is no F-31 performance bottleneck or improvement claim.
- Successful target execution was intentionally not triggered in the production browser. Exactly-one target dispatch is known from source and the controlled composition fixture only; each target's mutation/result/error/recovery remains with its feature tests.
- 320×568, 375×667, tablet, dark theme, English, high-DPI, 200% zoom, pointer-coarse hardware, real screen readers, actual Chinese IME, outside-click return and reduced-motion computed styles remain unverified.
- Formal Playwright smoke/feature/visual/responsive suites were not rerun for this documentation-only checkpoint. Existing environment blocking remains baseline; in-app Chromium evidence does not count as those suites passing.

## OpenSpec gate and conflict matrix

| Change | Capability | Confirmed owner | Neighbor/non-overlap | Approval state |
| --- | --- | --- | --- | --- |
| `stabilize-command-palette-input-handling` | `command-palette-input-consistency` | sole active owner | owns boundary-whitespace matching and IME keys only; registry/target/semantic/focus/layout behavior unchanged | waiting for explicit approval |
| `improve-command-palette-interface-accessibility` | `command-palette-interface-accessibility` | sole active owner | owns shell semantics/focus/status/compact/landscape/motion; input normalization remains separate and target feedback/final surfaces retain feature owners | waiting for explicit approval |

Manual structure validation found 3 requirements/9 scenarios/16 tasks/4 checked and 5/15/23/6 respectively. All eight requirement names occur exactly once across formal and active specs; each capability has one active owner. At the F-31 checkpoint, the repository had 121 non-archive changes, all with delta specs: 10 fully checked, 99 partially checked, 12 with zero checked tasks, and 92 task files containing approval wording. Later F-29, F-23 and F-13 supplements change the current repository snapshot to 124/124, 10/102/12 and 95 respectively without changing either F-31 owner. These are mechanical file counts, not implementation or approval status. OpenSpec CLI remains unavailable, so no CLI validation is claimed.

## Test, browser, visual, performance, rollback, and exit status

- First component diagnostic: exit 1 only because Vitest did not load the `toHaveFocus` matcher used by the temporary assertion; this is a diagnostic fixture issue, not a product failure.
- Corrected diagnostic: exit 0, 1/1 file and 2/2 tests; relevant durations 406 ms and 48 ms; report 1.75 s. The controlled observations were composition Enter close=1/target=1 after frame and connected-opener Escape focus=`BODY`.
- Permanent `CommandPalette`/registry tests found: zero. The temporary diagnostic was deleted.
- Browser: four before JPEGs cover 1280×720 default, 1280×720 whitespace no-result, 390×844 portrait and 640×360 landscape. No command, provider, file, clipboard, real storage or destructive board action was executed. Browser tabs were closed and the local server stopped.
- Performance: no runtime optimization and zero five-sample measurements; no faster/smaller/lower-memory claim.
- Visual: exact geometry and before screenshots prove only the measured current states. There is no after screenshot and no claim of visual improvement.
- Rollback: because Git metadata is absent, delete the two new change directories and F-31 evidence, then reverse the ledger/F-28/registry entries by patch. No cache, migration or user-data recovery is needed.

F-31 has completed fact modeling but has not met the feature exit standard. Seven confirmed/measured findings require the two independent approvals before runtime or permanent-test implementation, and the full target/viewport/locale/theme/accessibility/performance matrix remains open.
