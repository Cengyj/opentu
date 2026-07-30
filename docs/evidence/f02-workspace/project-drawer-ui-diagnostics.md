# F-02 project drawer interface diagnostics

Date: 2026-07-30 (Asia/Shanghai)

## Scope and evidence classification

This record covers the reachable project drawer shell, board/folder tree, item action menus, board search result state, delete confirmation, and the existing zh/en provider boundary. It does not change or re-test deletion transition, storage commit ordering, Board/Folder schema, import/export semantics, GitHub sync, startup loading, Frame/PPT content, or Layer content.

Evidence sources:

- current source with forward and reverse caller tracing;
- one controlled current-component Vitest/jsdom diagnostic;
- one local production-artifact in-app Chromium session at 1280×720, DPR 1, loopback network, no CPU/network throttling, SW disabled;
- two before screenshots in this directory.

The Chromium version was not exposed. The Browser binding did not expose viewport resizing, so no fresh 390/320 geometry was produced. The desktop geometry is one UI sample, not a performance sample. No provider request, import/export, external credential, browser storage inspection, or real user data was used. The isolated origin created its normal default local board; only its visible UI was inspected.

## Forward and reverse interface chain

`bottom-actions-section.tsx:108-123` named project trigger
→ `drawnix.tsx:457-472` owns `projectDrawerOpen`
→ `DrawnixDeferredFeatures.tsx:215-224` conditionally mounts the drawer
→ `ProjectDrawer.tsx:1031-1054` reads `useWorkspace`
→ `ProjectDrawer.tsx:1633-1821` renders tabs/search/actions/loading/empty/tree in `BaseDrawer`
→ `ProjectDrawerContent :547-1028` renders pointer tree rows, dropdown actions, rename input, drag/drop and the shared portalled ContextMenu
→ handlers at `:1119-1392,1571-1589`
→ `useWorkspace.ts:136-378`
→ WorkspaceService/storage and App switch chain already recorded in ledger section 10.

Reverse:

- visible current board row ← `currentBoard` identity at `ProjectDrawer.tsx:708-723` ← `useWorkspace` event projection;
- visible folder expansion ← `folder.isExpanded` ← `WorkspaceService.toggleFolderExpanded` through `useWorkspace.ts:220-222`;
- visible delete dialog ← `showDeleteDialog/deleteTarget/deleteMultipleTargets` ← dropdown or ContextMenu delete action;
- visible no-result/empty surface ← `filteredTree.length === 0` at `ProjectDrawer.tsx:1790-1798` ← filter algorithm at `:1592-1631`;
- visible Chinese system copy ← hard-coded ProjectDrawer strings ← no `useI18n` consumer, while Drawnix mounts the drawer inside the existing provider.

State owners stay unchanged: `projectDrawerOpen` belongs to Drawnix; `activeTab/searchQuery/deleteTarget/selection/editingId` belong to ProjectDrawer; tree/current board/error/data belong to useWorkspace/WorkspaceService; width/pin belong to BaseDrawer/localStorage. This investigation invoked no data writer.

## Controlled component raw result

Final corrected command: one file, one test, exit 0, 12.21 s. The first exploratory run exited 1 only because it expected two unnamed item-action buttons while the fixture rendered three, and expected `aria-modal=true` while current output was null. Those assertions were corrected to the observed contract; the exploratory exit is not a product regression.

Raw current behavior:

- drawer role/name/label relationship: null/null/null; initial active element: body;
- folder row: DIV, role null, tabIndex -1, aria-expanded null;
- board row: DIV, role null, tabIndex -1, aria-current and aria-selected null;
- three tree action buttons: three empty names;
- Enter on folder/board: 0 toggle and 0 switch; pointer click: 1 toggle and 1 switch positive controls;
- right-click menu: role menu with five menuitems, but active element remained body, first item was not focused, and ArrowDown moved no focus;
- delete confirmation positive control: named role dialog, initial focus on Cancel, Cancel/Delete native buttons present; current `aria-modal` was null;
- English provider positive setup still rendered Chinese drawer title, board tab, and create-board action;
- an unmatched query against a fixture containing two root tree items rendered “暂无画板” and “创建第一个画板”, and rendered no no-match message.

IndexedDB-absent ConfigWriter stderr, stale Browserslist data and a third-party sourcemap warning did not fail assertions and are environment/tool noise.

## Local production-artifact raw result

The normal 1280×720 drawer screenshot is [project-drawer-desktop-before.png](./project-drawer-desktop-before.png). The unmatched-search screenshot is [project-drawer-search-no-match-before.png](./project-drawer-search-no-match-before.png).

Measured DOM facts:

- drawer rect x=58, y=0, width=380, height=720; role/name/label relationship all null;
- the project trigger remained active after opening and exposed neither aria-expanded nor aria-pressed;
- the next focusable DOM control after the trigger was “打开工具箱”; the first drawer control was “固定抽屉”, with 17 intervening tab stops;
- the current board row was a non-focusable generic DIV with no current/selected state; height 37.765625 CSS px;
- its item-action button was tabbable but unnamed while its container computed opacity was 0;
- the shared close button was tabbable but had no aria-label, title, or visible text;
- all three visible tabs were native named buttons, but none exposed selected/pressed state; each measured 37.5 CSS px;
- the resize handle was an 8px generic, tabIndex -1 pointer surface;
- entering `no-such-workspace-item` while the default board existed produced the same false-empty wording and create-first action seen in the component diagnostic.

One Browser-control infrastructure telemetry request timed out during reload. It was external to the local product origin and is classified as tool noise, not a product request or defect.

## Confirmed findings

### [WORKSPACE-UI-KEYBOARD-004]

Status: confirmed accessibility/interaction defect.

User scenario: a keyboard or screen-reader user opens Projects, identifies the drawer and current board, expands folders, switches boards, opens item actions, renames or deletes, and returns to the opener.

Current versus expected: current folder/board rows are pointer-only generic DIVs without keyboard entry or state; their action buttons are unnamed and visually opacity 0 even though tabbable; the opened drawer is unnamed, keeps focus on its trigger, and its first focusable control is 18 tab positions later; close is unnamed; the supplemental right-click menu does not take or arrow-manage focus. Pointer click positive controls invoke folder toggle and board switch exactly once. Expected is one named non-modal project region, a deterministic entry/return path, explicit current/expanded/selected tree state, equivalent keyboard activation, named focus-visible item actions, and bounded menu focus/Escape behavior without changing workspace operations.

Precise evidence:

- `SideDrawer.tsx:229-288` generic root, unnamed close, pointer/touch resize;
- `ProjectDrawer.tsx:560-690` folder row and actions; `:718-856` board row and actions;
- `project-drawer.scss:119-215,258-267` 32px row/16px disclosure and hover/selected-only action visibility;
- `ContextMenu.tsx:140-207,262-305,350-390` menu roles and Escape dismissal without focus entry/arrow navigation/return;
- local production and controlled raw values above.

Impact: all reachable board/folder management paths. The shared SideDrawer and ContextMenu have other callers, but the proposed owner must opt ProjectDrawer in without changing unrelated surfaces before their own approvals.

Evidence strength: current source, controlled keyboard-versus-pointer component contrast, real production DOM/focus order and screenshot.

Preferred solution: task-specific SideDrawer accessibility props; trigger relationship and focus return; a roving hierarchical tree contract that preserves current click/modifier semantics; named focus-visible More actions; keyboard-openable/focus-managed ProjectDrawer ContextMenu through backward-compatible opt-in shared props; keep native rename input and current service callbacks.

Alternative: add `tabIndex=0` to every row and leave click handlers. Rejected because it creates an unbounded tab sequence, still omits hierarchical/current state, action names, arrows and menu focus.

Risk: double activation with nested action buttons, Escape closing rename/dialog plus drawer, focus loss after async tree refresh, or modifier-selection drift. Validate exactly-once pointer/Enter/Space, arrows/Home/End, folder Left/Right, Shift/Ctrl/Cmd selection parity, rename Enter/Escape, menu focus/return, delete dialog nesting, refresh and deletion-transition adjacency.

Rollback: remove only ProjectDrawer opt-in semantics/focus/keyboard/style/tests and any backward-compatible shared props; retain current click/drag/service/storage behavior. No storage or migration cleanup.

### [WORKSPACE-UI-SEARCH-005]

Status: confirmed UX/state-expression defect.

User scenario: a user searches an existing project tree for text with no match.

Current versus expected: both controlled and production evidence show an existing tree becomes “暂无画板 / 创建第一个画板”. Expected is a no-match state that does not claim the workspace is empty and does not present the first-board action; the true empty workspace keeps its existing action.

Precise chain: search Input `ProjectDrawer.tsx:1674-1680` → `searchQuery` → recursive filter `:1592-1631` → unconditional `filteredTree.length===0` branch `:1790-1798`. The branch never tests `tree.length` or non-empty query.

Impact: every nonmatching search; it can mislead users into creating a board unnecessarily but does not mutate data until the user separately activates the button.

Evidence strength: deterministic control flow, controlled fixture with two items, local production board and before screenshot.

Preferred solution: distinguish loading, true empty workspace, and non-empty-query/no-match states; preserve the search input and existing true-empty create action. Alternative “hide the create button only” still leaves the false “暂无画板” statement, so it is insufficient.

Risk: whitespace queries or folder-only matches entering the wrong branch. Validate blank/whitespace, board match, folder match, nested child match, no match, and true empty workspace. Rollback the branch/messages/tests; no data changes.

### [WORKSPACE-UI-I18N-006]

Status: confirmed localization consistency defect.

User scenario: the application language is English and the user manages folders/boards.

Current versus expected: under `I18nProvider defaultLanguage=en`, the drawer title, board-management tab and create-board action remain Chinese; source shows the board-management system copy and messages are hard-coded and ProjectDrawer does not consume the existing provider. Expected is existing application language for application-owned project-manager copy, while user board/folder names, imported file names, raw data and identifiers remain byte-preserved.

Precise chain: Drawnix I18nProvider → deferred ProjectDrawer → literals at `ProjectDrawer.tsx:657-685,802-829,931-1008,1127-1181,1635-1890`; provider contract at `i18n.tsx:599-629` has live zh/en state, but ProjectDrawer imports no `useI18n`.

Impact: every English session opening this reachable UI. FramePanel/LayerPanel content and F-03 import/export content remain outside this owner; visible shared shell labels require an explicit conflict boundary.

Evidence strength: current source owner trace plus controlled English render.

Preferred solution: typed zh/en ProjectDrawer shell and F-02 board/folder-management keys in the existing provider; translate safe generic operation feedback only. Do not translate user content, raw validation/storage errors, Board/Folder records, analytics values or file names. Alternative `navigator.language` is rejected because it can differ from the selected application language.

Risk: partial localization at the F-03/F-04/F-25 boundaries, unstable menu accessible names, or translating user data. Validate zh/en initial and live switch, all board/folder states/actions/dialog copy, sentinel user names byte-for-byte, and independent Frame/Layer content ownership. Rollback keys/consumer/tests only; no migration.

## Hypotheses and non-problems

- The project delete confirmation is already a named role=dialog with deterministic initial Cancel focus and native Cancel/Delete buttons. `aria-modal` is currently null, but the project primitive has 22 callers. Until the shared primitive's intended modal contract and caller matrix are audited, this local observation is not treated as a standalone F-02 defect and will not be changed opportunistically.
- Desktop row/tab heights are below 44 CSS px and source gives the folder disclosure 16×16, but the current Browser binding could not produce fresh compact/pointer-coarse geometry. Touch-target/320px visual conclusions remain hypotheses; no CSS change is authorized from desktop values alone.
- The application currently forces a light canvas/app shell. Lack of a dark ProjectDrawer result is not reclassified as an F-02 defect or used to introduce dark mode.
- Native search, create, import/export and tab buttons have visible text. The problem is not “all controls are inaccessible”; it is the exact state/name/focus gaps recorded above.

## Approval and performance/visual boundary

All three confirmed findings change user-observable keyboard, focus, status or language behavior and require an independent OpenSpec approval before implementation. No production TSX/SCSS/storage/service behavior changed. There is no performance claim and no after screenshot. Approved implementation must preserve workspace API/schema/storage, deletion-transition and failure-consistency owners, run same-state before/after screenshots, and collect at least five samples before making any latency/render claim.
