# F-10 task-queue responsive and accessibility evidence

Date: 2026-07-30 (Asia/Shanghai)

## Scope and evidence limits

- User scenario: a user opens the existing task queue from the unified toolbar, filters and searches current/history tasks, reads progress and failure details, selects tasks, and uses the existing preview/download/edit/regenerate/insert/retry/delete actions on desktop or mobile with pointer, keyboard, touch, or assistive technology.
- In scope: the live toolbar entry, task drawer shell, status/type filters, search, selection, list/item/actions, progress/error details, archive list, responsive geometry, Chinese/English copy boundary, and the existing task state projection into this UI.
- Out of scope: task scheduling/concurrency, executor/provider behavior, cancellation propagation, retry ownership, storage/GitHub durability, lyrics result semantics, cache/error-content sanitization, workflow state machines, and the closed canvas toolbar/input collision. Existing active changes retain those owners.
- Source state: this workspace has no Git metadata. History, diff provenance, and worktree cleanliness cannot be checked.
- Runtime: workspace Node.js 24.14.0; Vite 6.4.1 at `http://localhost:7200/`; Codex in-app Chromium (exact browser revision unavailable); default 1280×720 plus explicit 390×844 and 320×568 viewport overrides; DPR 1; no network/CPU throttling; current light-looking application palette; Chinese UI; no provider request.
- Privacy: the current local task list contained one visible completed task. Screenshots were cropped above the task row, and recorded DOM/metrics omit prompt, result, URL, task ID, error body, credentials, telemetry, logs, and storage contents. No real provider, GitHub, telemetry, diagnostic-log, `.npmrc`, API-key, or token value was read.
- These observations are DOM/accessibility/geometry facts, not performance measurements. No speed, memory, render-count, or bundle-size improvement is claimed.

## Relevant specifications and active changes

- Formal `image-generation-feedback` requires user-centered lifecycle states and defers detailed failure/history to the task detail layer.
- Formal `media-cache-warnings` requires the task queue to preserve the existing cache-warning/download affordance without provider-specific rules or render-time probing.
- Formal `video-analyzer` requires analysis/rewrite tasks to appear in the shared queue and update their records.
- Formal `backup-restore` requires terminal and archived task fidelity.
- `enforce-task-queue-concurrency-limit`, `fix-task-queue-external-cancellation`, and `persist-github-synced-task-history` remain approval-gated owners of scheduling, cancellation/late writes, and durable GitHub merge.
- `add-suno-lyrics-task-and-canvas-flow` owns lyrics action/result semantics. `sanitize-suno-provider-error-feedback` plus diagnostic/domain changes own safe error content. This audit does not copy raw error text into names or change what is stored/displayed.
- New approval-gated owner: `improve-task-queue-responsive-accessibility` (5 requirements, 12 scenarios, 24 tasks; 6 evidence/manual-gate tasks complete before approval).

## Current forward and reverse chain

Forward UI chain:

`drawnix.tsx:340` owns `taskPanelExpanded` → `drawnix.tsx:510-526` enables deferred runtime, closes conflicting unpinned drawers, and toggles the queue → `drawnix.tsx:1625-1632` passes state/callback → `unified-toolbar.tsx:23-27` lazy-loads `TaskQueuePanel` → `unified-toolbar.tsx:449-457,564-573` mounts the panel and task entry → `bottom-actions-section.tsx:144-165` renders the live named native `ToolButton` with badge/analytics → `TaskQueuePanel.tsx:116-168` reads `useTaskQueue` state → `:1008-1246` renders status/type/search/batch controls → `:1250-1330` renders `BaseDrawer` and current/archive lists → `BaseDrawer.tsx:30-116` restores width/pin state → `SideDrawer.tsx:226-300` renders the drawer → `VirtualTaskList.tsx:329-470` renders current tasks → `TaskItem.tsx:522-1008` renders selection, preview, lifecycle, actions, and errors.

State/data chain:

generation/workflow/tool UI → `useTaskQueue.createTask` / `taskQueueService.createTask` → main-thread task executor/provider adapter → task storage/cache → task service memory `Map` and RxJS task event → `ensureTaskStateSyncStarted` → Jotai atoms → `useTaskQueue` derived active/completed/failed/cancelled arrays → toolbar badge/panel/list/item. Archive overflow marks durable records `archived`; `ArchivedTaskList` reverses through `taskStorageReader` cursor pagination. Action callbacks reverse from `TaskItem` → `TaskQueuePanel` handlers → `useTaskQueue`/task service or canvas/media utilities → task/storage/board state → event projection back into the same UI. The full task execution/recovery/storage chain remains recorded at `docs/EXISTING_FEATURE_OPTIMIZATION_LEDGER.md:708-718`.

State ownership and side effects:

- `Drawnix` owns open/close; `TaskQueuePanel` owns active tab, type/search filters, previews/editors/confirmations, and selected IDs; `TaskQueueService` owns task lifecycle; IndexedDB owns durable task history; cache/media/board services own result materialization.
- Width and pin use existing localStorage keys. This audit opened/closed and filtered the UI only; it did not resize, pin, select/delete/retry/cancel/insert/download/sync tasks, mutate task storage, or change user data.
- `TaskQueuePanel.tsx:1259-1261` keeps no backdrop, disables shared Escape close, and shows a close icon. Nested preview/editor/confirmation states are owned by the panel and must take precedence in any future Escape implementation.
- Current visible labels are hard-coded Chinese throughout the reachable queue/side drawer files; the live files do not consume `useI18n`. User prompt/title/model/result/error content is already rendered separately and must not be translated or moved into names.

## Controlled observations

### Reachability correction and non-finding

The live task entry is not `TaskToolbarButton.tsx`. Full-repository import/export searches found no importer, barrel export, registry entry, JSX use, or package export for `TaskToolbarButton` or `TaskSummary`. The actual entry is `BottomActionsSection` → `ToolButton`, whose live DOM is a native `<button type="button" aria-label="任务队列" data-testid="toolbar-tasks">`.

The two unreachable components and `.task-toolbar-button`-only SCSS were removed without changing the live path. Historical `specs/001-batch-task-queue` and `specs/005-declarative-tracking` references are documentation drift and are synchronized separately. This is a code-quality cleanup, not an accessibility fix or bundle-performance claim; unimported files were not part of the runtime bundle.

Browser keyboard event injection did not activate either the task entry or the unrelated native minimap button and did not move focus on Tab, so it is classified as a browser-control limitation, not a product keyboard failure. Native button semantics and source establish that the current live entry is keyboard-capable; product conclusions below use current DOM/source/focus order and pointer-open state, not the failed injected key events.

### 1280×720 drawer and focus structure

After pointer-opening the queue:

- drawer root: `DIV`, `role=null`, `aria-label=null`, `aria-labelledby=null`, `tabIndex=-1`;
- dialog-role descendants: 0;
- active element remains the toolbar task button;
- document focusable count: 41; task trigger index: 27;
- first 12 panel focusables occur before the trigger; the next four focusables after the trigger are AI-input controls, not task controls;
- current one-task panel has 11 buttons, of which seven expose neither explicit accessible name nor visible text: close, five icon filters, and delete;
- pin has `aria-label="固定抽屉"`; text filter obtains only the visible glyph `文`; multi-select and insert obtain visible text;
- the active type filter has only `task-queue-panel__filter-btn--active`; `aria-pressed` is absent.

The five status items (`全部/生成中/失败/已完成/历史`) each render as `DIV` with `role=null`, `aria-selected=null`, and `tabIndex=-1`. At 390 px the last tab is revealed through a TDesign right-arrow `DIV.t-tabs__btn`; that arrow also has no role, name, or tab stop.

After entering multi-select by pointer, two TDesign checkbox inputs render with no name/label relationship and `tabIndex=-1`; their enclosing labels are focusable at `tabIndex=0` but have empty text and no `aria-label`. One is select-all and one is the current row selection.

### Temporary real-component diagnostic

Command:

`pnpm exec vitest run src/components/task-queue/__tests__/TaskQueueAccessibility.diagnostic.test.tsx --config vitest.config.ts --reporter verbose`

Environment: Node 24.14.0, Vitest 3.2.4, jsdom, real TDesign buttons/checkbox/HoverTip, mocked media/cache/progress inputs only, no network. Result: exit 0, 1/1 file, 1/1 test, 12.68 s. The `indexedDB is not defined` ConfigWriter stderr is test-environment noise emitted during module initialization and did not affect the diagnostic assertion.

Three controlled tasks were rendered: completed image, processing video, and failed image with details. Raw result:

- 11 action buttons total; seven unnamed (completed download/edit/delete, processing edit/delete, failed edit/delete); regenerate had an explicit name and insert/retry had visible text;
- selection label: empty name, `tabIndex=0`;
- actionable preview: `DIV`, no role, `tabIndex=-1`;
- error details: `SPAN`, no role, `tabIndex=-1`;
- progressbars: 0; live regions: 0.

The temporary diagnostic was deleted after recording this current-behavior evidence and is not retained as a passing product contract.

### Responsive geometry and visual evidence

At 390×844, the task drawer fills `x=0..390`. The filter row fits `x=12..378`, but compact controls measure below the repository's 44×44 touch convention: pin/close 30×36, each type filter 30×36, multi-select 68×28, task delete 24×36, and insert 44×26 CSS px. The screenshot is cropped before task content:

![390px task queue header before approval](./mobile-task-queue-header-before.png)

At 320×568:

- drawer: `x=0,w=320`;
- filter content box: `x=12,w=296,right=308,scrollWidth=366`;
- type filters: `x=12,w=204,right=216`;
- search row: `x=222,w=86,right=308`;
- multi-select: `x=310,w=68,right=378`;
- confirmed overflow beyond the drawer: 58 CSS px of the multi-select button's right side; the filter content is 70 CSS px wider than its client box.

The drawer uses `overflow:hidden`, and the screenshot shows only a clipped sliver of the multi-select action at the right edge:

![320px task queue filter row clipping the multi-select action](./mobile-task-queue-header-320-before.png)

Screenshot SHA-256 values:

- 390×844: `57a9f7d13281c67117da0390cb767a209f4dd53cdd18d837b9032788f9f8e43e`
- 320×568: `c727b4bdeb1a1a679d4baaafce5a932dc84e79e779bd20d9c248b1352eb334c1`

## Confirmed issues

### [TASK-UI-A11Y-001] Opened task surface has no accessible container/focus/Escape contract

- Status: confirmed current-source and runtime defect; implementation blocked by OpenSpec approval.
- User impact: a keyboard/screen-reader user invokes a correctly named task button but receives no named task surface, remains focused on the trigger, and sequential navigation proceeds into AI-input controls instead of the newly opened queue. The close icon is announced as an unnamed button. Escape is explicitly disabled for the queue.
- Reproduction: at 1280×720, click `data-testid="toolbar-tasks"`; inspect the root, `document.activeElement`, focusable document order, and close button. Current raw values are listed above.
- Current/expected: current root is an unlabeled generic `div`, focus remains on trigger, panel controls precede it in document order, close is unnamed, and `closeOnEsc=false`. Expected is a named non-modal task surface, deterministic entry, nested-overlay-safe Escape, and focus return without adding a modal trap/backdrop.
- Evidence and exact source: `bottom-actions-section.tsx:144-165`; `TaskQueuePanel.tsx:1250-1267`; `SideDrawer.tsx:119-133,226-275`; runtime DOM/focus-order sample.
- Complete call chain: task trigger → `handleTaskPanelToggle` → lazy panel → `BaseDrawer` → `SideDrawer` root/header/close → focus/Escape/browser tree → close callback → Drawnix state → toolbar trigger.
- Root cause: the live trigger uses the semantic `ToolButton`, but the shared drawer exposes only visual structure; task panel opts out of the only Escape listener and neither owner coordinates focus.
- Impact range: task queue at all viewports. Other shared drawers exhibit adjacent shell behavior but are not changed implicitly; the proposal uses a task-specific opt-in.
- Evidence strength: strong reachable source + direct DOM/active-element/focus-order observation.
- Candidate: approval-gated `improve-task-queue-responsive-accessibility`; labelled non-modal surface, trigger relationship, heading focus, nested Escape precedence, exact invoker restoration. Alternative modal trap/backdrop is rejected because it changes current non-modal canvas interaction. Unconditional shared Escape is rejected because nested surfaces could close twice.
- Risk: lazy/animation focus races and portal Escape precedence.
- Validation: focused component tests plus 1280/768/390/320 keyboard/pointer/nested-surface browser runs; assert one close callback and exact focus restoration.
- Rollback: remove task-specific ARIA/focus/Escape props/effects/tests; no user data rollback.

### [TASK-FILTER-A11Y-002] Status, type, and selection controls do not expose operation/state

- Status: confirmed current-source and runtime defect; approval required.
- User impact: status/history choices are absent from sequential keyboard focus and expose no tab/selected state; five type buttons and both selection checkboxes have empty names; the active type is conveyed only by orange CSS.
- Reproduction: open the queue; inspect `.t-tabs__nav-item`, `.task-queue-panel__type-filters button`, then click visible “多选” and inspect TDesign checkboxes. Raw attributes are listed above.
- Current/expected: current status items are generic `DIV`/`tabIndex=-1`; type filters lack names/pressed state; selection labels are empty. Expected existing filters and selected counts remain identical while semantic names/selected/pressed/checkbox context and keyboard operation are exposed.
- Evidence/source: `TaskQueuePanel.tsx:1011-1118,1169-1242`; `TaskItem.tsx:522-542`; current DOM at 1280/390.
- Chain: task arrays → count derivation → Tabs/type-filter/search state → `filteredTasks` → selection Set → batch handlers → task service actions → list projection.
- Root cause: current TDesign tab rendering and icon/checkbox wrappers are treated as self-describing, but rendered DOM does not supply the required semantics; selected state is CSS-only.
- Impact: all task types/statuses, archive navigation, batch cancel/retry/sync/delete reachability. It does not prove a business-handler defect.
- Evidence strength: strong DOM + source; no reliance on HoverTip text.
- Candidate: semantic roving tabs, named/pressed native type buttons, labelled selection controls. Replacing filters with a new product/navigation model is rejected.
- Risk: keyboard state could diverge from React filter state; tests must assert the same list membership and one callback.
- Validation: zh/en role/name/selected/pressed/checkbox tests and browser Left/Right/Home/End/Enter/Space/pointer parity.
- Rollback: restore existing filter markup and remove focused semantics/tests; task/filter data remain unchanged.

### [TASK-ITEM-A11Y-003] Existing task actions, previews, details, and progress lose semantics

- Status: confirmed by current task DOM, static branches, and temporary real-component render; approval required.
- User impact: icon actions such as download/edit/delete are indistinguishable to a screen reader; media preview and detailed error are pointer-only; current processing UI supplies neither queryable progressbar values nor bounded lifecycle announcements.
- Reproduction: run the recorded controlled render for completed image, processing video, and failed image, or inspect the current live task delete button. Exact raw counts are above.
- Current/expected: seven of eleven controlled action buttons are unnamed; preview/details are non-focusable generic elements; progress/live counts are zero. Expected every already-available action has a localized name and native keyboard behavior; actionable preview/details are keyboard-reachable; one progress value and concise terminal state are perceivable without announcing every poll/animation frame.
- Evidence/source: `TaskItem.tsx:522-556,828-842,848-934,975-1001`; `TaskProgressOverlay.tsx:139-167`; `ImageGenerationProgressDisplay.tsx:52-109`; diagnostic exit 0/current DOM output.
- Chain: task status/result/error/cache state → TaskItem branch → HoverTip/TDesign/preview/progress DOM → user action callback → panel handler → task/canvas/media service → RxJS/Jotai rerender.
- Root cause: visual icons, hover tips, div click handlers, and visual bars were used without equivalent direct names/roles/state.
- Impact: completed/processing/failed/cancelled image/video/audio/chat tasks according to existing action branches. Error-content safety is a separate owner and is not changed here.
- Evidence strength: strong real render + exact static branch.
- Candidate: direct localized names, conditional native preview/detail buttons, one progressbar, bounded polite terminal status. Making the whole row a button is rejected because it contains nested actions and selection behavior.
- Risk: duplicate preview/action callbacks, noisy announcements, raw errors entering names. Tests require exactly one callback and privacy sentinels.
- Validation: component state matrix and browser accessibility snapshots with synthetic/local tasks; no provider calls.
- Rollback: restore markup/ARIA/live semantics and tests; callbacks/task data stay unchanged.

### [TASK-RESPONSIVE-004] 320px filter layout clips the multi-select action

- Status: confirmed measured visual/interaction defect; layout implementation blocked by approval.
- User impact: at 320×568 the visible search reaches the filter boundary while “多选” starts at x=310 and extends to x=378. The drawer clips it, removing the existing entry to batch cancel/retry/sync/delete from the usable pointer/touch surface.
- Reproduction: set viewport 320×568, open task queue, compare drawer/filter/type/search/action rectangles and capture the top 180 px. At 390×844 the same row fits, providing a negative control.
- Current/expected: current filter `scrollWidth=366` inside `clientWidth=296`; expected all existing controls remain inside the drawer and operable at 320 px without hiding an action. Compact controls also measure below the documented 44×44 project convention.
- Evidence/source: `task-queue.scss:64-160,761-968`; `TaskQueuePanel.tsx:1025-1166`; exact geometry, screenshot, and hashes above.
- Chain: viewport/media query → responsive drawer full width → no-wrap filter/type/search/actions → overflow:hidden drawer → clipped hit target → unavailable multi-select path → batch controls/task service.
- Root cause: six fixed 30 px type controls plus gaps, a minimum-width search row, and a fixed 68 px action share a no-wrap row that exceeds the 296 px content box.
- Impact: confirmed at 320×568; not reproduced at 390×844. 568×320, 200% zoom, long English, dark theme, and non-zero safe area remain unmeasured.
- Evidence strength: strong geometry + screenshot + 390 negative control.
- Candidate: compact two-row wrapping and 44×44 targets while preserving action order and list scrolling. Hiding multi-select or shrinking controls further is rejected.
- Risk: greater filter height reduces list viewport; English labels can create new overflow.
- Validation: geometry/hit-testing/screenshots at 320/390/landscape/200%, zh/en, light/dark; assert every action rectangle inside drawer.
- Rollback: restore scoped compact SCSS/tests/screenshots; no stored layout/task data change.

### [TASK-I18N-005] Reachable task queue ignores the selected English language

- Status: confirmed static control-flow defect; runtime English screenshot remains pending because the current language submenu has a separate approval-gated keyboard defect and no persistence API.
- User impact: switching the existing application language to English changes surrounding localized toolbar copy but task title, filters, statuses, actions, confirmations, empty/loading/archive and progress/error labels remain Chinese.
- Reproduction/static proof: the live queue path in `TaskQueuePanel`, `TaskItem`, `TaskProgressOverlay`, `VirtualTaskList`, `ArchivedTaskList`, and `SideDrawer` renders Chinese literals and has no `useI18n` consumer. `i18n.tsx:598-624` rerenders only consumers when `language` changes. Therefore those literals are invariant under existing language state.
- Current/expected: current application-owned queue copy is Chinese-only; expected it follows `zh`/`en` while user prompt/title/provider/model/error/task/result data remains byte-for-byte unchanged.
- Chain: language menu → `I18nProvider.setLanguage` → Context rerender → current queue has no consumer → literals unchanged → accessibility tree/visual copy remain Chinese.
- Root cause: an unreachable legacy task button consumed `useI18n`, while the live panel/item path never entered the language boundary.
- Impact: all reachable task queue UI strings; no task/provider data translation.
- Evidence strength: strong unique state owner + absence of consumers + literal render branches. Runtime screenshot is not claimed.
- Candidate: add typed queue keys and consume them at render time. Translating persisted task data or adding a second localization framework is rejected.
- Risk: long English copy can regress 320 px layout; must land with the responsive tests.
- Validation: controlled `I18nProvider` zh/en render states plus browser screenshots; assert privacy/data sentinels and no localization keys in storage/analytics.
- Rollback: remove keys/usages/tests; no migration or user-data action.

### [TASK-DEAD-006] Legacy task button/summary source and tracking docs had no reachable consumer

- Status: confirmed static non-reachability; source/style cleanup completed without product behavior change.
- User impact: none at runtime. Maintainers could incorrectly audit or edit `TaskToolbarButton` as the live entry, as happened at the start of this sub-loop; historical docs also named nonexistent tests/integration.
- Reproduction: full-repository searches for imports, JSX uses, exports, registry entries, and package exports find only self/example or historical documentation references. `packages/drawnix/package.json` exports only package root/runtime, and `src/index.ts` does not export either component.
- Current/expected: before cleanup, two source files and task-toolbar-only styles remained; the live entry was already `BottomActionsSection`. Expected source/docs name the single live owner.
- Chain: live Drawnix → UnifiedToolbar → BottomActionsSection → ToolButton → TaskQueuePanel; neither removed component appears in the forward or reverse chain.
- Root cause: toolbar architecture moved to UnifiedToolbar/BottomActionsSection while prototype files and 2025 spec-kit/tracking documentation were not retired.
- Impact: code/docs only; no bundle claim because unreachable modules were not imported.
- Evidence strength: exhaustive repository import/export/registry/package search plus live DOM.
- Fix: delete `TaskToolbarButton.tsx`, `TaskSummary.tsx`, and `.task-toolbar-button` SCSS; update historical/current-owner notes. Alternative keeping deprecated files is rejected because there is no supported deep export or consumer.
- Risk: an undocumented out-of-package deep import would already be blocked by the package `exports` map; repository typecheck/build are the verification gate.
- Verification: post-cleanup searches, Drawnix typecheck, focused lint, cycles/build and live entry smoke. Exact results are recorded after verification.
- Rollback: reapply the inverse deletion patch to restore the two components and dedicated SCSS; no user data action.

## Unknowns and non-findings

- Native task toolbar entry is a positive control: it has a stable accessible name and native button semantics. The failed browser-control key injection is not a product defect conclusion.
- The 390 px status strip intentionally uses a right-arrow to reveal History, but its current pointer-only generic `div` is included in the confirmed status-filter accessibility issue. Horizontal overflow itself is not separately labelled a visual defect at 390.
- Exact screen-reader speech, physical iOS/Android touch behavior, 200% browser zoom, high-DPI, non-zero safe-area, dark theme, and landscape remain post-approval verification items.
- One geometry sample per viewport is sufficient for deterministic current CSS under this state; it is not a performance sample and has no median/range.
- No after screenshot exists because user-visible semantics/layout/localization implementation is approval-gated.
- The queue's current raw detailed-error content may have independent safety problems already owned by sanitization changes; this audit does not assert that the visible sample contains credentials or other secrets.

## OpenSpec validation record

- Fresh command: `openspec validate improve-task-queue-responsive-accessibility --strict` with the bundled Node/pnpm runtime paths available to the shell.
- Result: exit 127, `command not found: openspec`. This is a tool availability blocker, not a specification pass or product failure; no CLI was installed.
- Manual structure check: `proposal.md`, `design.md`, `tasks.md`, and one delta `spec.md` are present; the delta contains one `ADDED` operation, five requirements, and twelve level-four scenarios. Every requirement has at least one scenario and every scenario has `WHEN`/`THEN` clauses.
- Requirement identity check: all five requirement names are unique across formal and non-archive active specs.
- Ownership check: scheduling, cancellation/late writes, GitHub persistence, lyrics results, error-content safety, the closed mobile canvas shell, palette tokens, and shared settings-toolbar behavior remain assigned to their existing changes. The new change owns only the reachable task surface's focus/Escape, semantics/announcements, localization, and compact task-layout contract. `ToolButton`, `SideDrawer`, and `TaskItem` are shared/touched files, so approved implementation must rebase optional props and semantic wrappers without absorbing those neighboring behaviors.

## Unreachable cleanup verification

- Post-cleanup source/package search: exit 0 for absence of both removed files and no live import/export/registry/package-export or `.task-toolbar-button` reference. The remaining `PromptHistoryTaskSummary` identifiers are a different task-storage type and are not residual component references.
- Focused task queue/storage/executor command: exit 0, 6/6 files and 37/37 tests. Expected canvas-insertion failure logging and jsdom `indexedDB is not defined` ConfigWriter stderr did not affect assertions.
- `pnpm nx run drawnix:typecheck`: exit 0. Full `pnpm typecheck`: exit 0, 5/5 projects. `pnpm check:cycles`: exit 0, no static runtime import cycles.
- Skip-cache full test: exit 1. Drawnix 189 files = 184 passed, 4 failed, 1 skipped; 1165 tests = 1161 passed, 3 failed, 1 skipped. React-board 1/1 file and 8/8 tests passed. The four existing failure clusters are cached-image data URL conversion, GPT Blob mock shape, Sora duration assertion, and the PPT settings mock; counts and identities match the latest pre-cleanup baseline and none enters the removed/live task-toolbar chain.
- Task-directory ESLint: exit 1, 3 errors and 33 warnings. All are current retained-file module-boundary/type/non-null/emoji findings; this cleanup did not change those files and no removed-file finding remains. They stay lint debt/evidence candidates, not automatically classified product defects.
- `pnpm build:web`: exit 0, 7931 application modules (about 1m39s) and 54 SW modules (1.48s). `pnpm size`: exit 1 only because AI Chat remains 844.43/140 kB gzip; the unreachable cleanup makes no bundle-size claim. `pnpm verify:startup`: exit 0 with no chunk cycle.
- The build's generated `version.json` timestamp side effect was reversed, and source `version.json`, `index.html`, and `sw.js` hashes were restored to `be431dce…c34`, `19b4f0d7…2e8`, and `78a242d3…977` respectively.
- Browser/Vite cleanup: the drawer was closed, local test tabs were finalized, and the Vite session was explicitly stopped. The stop exit is a user-issued interrupt, not a product failure.
