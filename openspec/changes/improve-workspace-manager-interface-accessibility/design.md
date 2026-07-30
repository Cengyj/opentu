## Context

- Production 1280×720 DOM: ProjectDrawer is a 380×720 generic `div` with no name; the trigger remains focused after open, the first drawer control is 18 Tab positions later, and the close icon is unnamed.
- The current board row is an unfocusable generic `div` with no current/selected state. Its unnamed action button is `tabIndex=0` inside an opacity-0 container.
- Controlled component evidence: Enter invokes neither folder toggle nor board switch, while pointer click invokes each once. The ProjectDrawer ContextMenu exposes roles but leaves focus on body and ignores ArrowDown.
- Search against a non-empty tree and the production default board both render the same true-empty message/action when no item matches.
- ProjectDrawer does not consume `useI18n`; an English provider still renders Chinese shell and board-management copy.
- ConfirmDialog already provides a named dialog and initial Cancel focus. Its shared modal attribute/caller matrix is not owned by this change.
- The Browser binding used for this cycle cannot resize its viewport. Desktop target sizes and source CSS are evidence, but not a fresh compact geometry acceptance baseline.

## Goals / Non-Goals

- Goals:
  - Make the existing ProjectDrawer and project trigger programmatically related, named and focus reachable without making the drawer modal.
  - Provide one bounded hierarchical keyboard model that calls the same existing board/folder handlers exactly once.
  - Make every existing project item action named and visible on keyboard focus.
  - Make the ProjectDrawer context-menu path keyboard-openable with menu/submenu focus and return.
  - Report loading, true empty and filtered no-match states honestly.
  - Use the current zh/en owner for safe ProjectDrawer/F-02 copy.
  - Add a keyboard equivalent for the existing bounded width adjustment.
- Non-Goals:
  - Do not change create/rename/move/copy/delete success semantics, deletion transition, persistence ordering or partial-failure reporting.
  - Do not change Board/Folder serialization, IndexedDB, URL/sessionStorage, GitHub sync, import/export or backup.
  - Do not localize user board/folder names, filenames, imported data, raw service errors or analytics values.
  - Do not redesign the tree, add commands, add undo/trash, or replace drag/drop.
  - Do not change default semantics of other SideDrawer or ContextMenu callers.
  - Do not claim or implement compact/touch geometry changes until fresh same-state viewport evidence exists.

## Decisions

### ProjectDrawer opts into shared shell semantics

Add backward-compatible SideDrawer/BaseDrawer props for a stable id, labelling relationship, optional initial/return focus refs, named close control and optional keyboard resize semantics. ProjectDrawer enables them; other drawers remain unchanged until their own approved changes.

The drawer remains a non-modal complementary/region surface. User activation moves focus to the project search input. Escape or the close control returns focus to the toolbar opener only when focus is inside the drawer; pointer auto-close does not steal focus. Nested rename/menu/dialog Escape handlers get first refusal so one Escape closes only the active nested layer.

Alternative: make every SideDrawer a modal dialog and trap focus. Rejected because project, chat and task drawers coexist with the canvas as non-modal working surfaces and have separate approved owners.

### Use one roving hierarchical tree model

Expose one tree and treeitems with folder `aria-expanded`, active board `aria-current`, and multi-selection `aria-selected`. Keep one row in the Tab order. Up/Down move among currently rendered items; Right expands/enters a folder; Left collapses/returns to the parent. Enter/Space run the same existing primary row action exactly once, with the existing Shift/Ctrl/Cmd selection intent preserved where applicable.

Keep item action controls as separate native buttons, not nested activation targets. When a refresh removes the focused item, move focus to the nearest surviving item or the tree root without triggering an operation.

Alternative: `tabIndex=0` on every clickable row. Rejected because it creates an unbounded Tab sequence and still omits hierarchy/state/navigation.

### Make existing action menus focus-safe

Give each More control a localized item-specific name and reveal the action container on `:focus-within`. Native Enter/Space continues to open its existing Dropdown. Add an opt-in ContextMenu invoker/focus contract so Shift+F10 or the ContextMenu key can open the existing supplemental menu from a focused ProjectDrawer treeitem; focus the first enabled item, support arrows/Home/End/submenu/Escape, and return focus to the invoker. Other ContextMenu callers keep current behavior unless separately opted in.

Rename keeps the existing inline Input and validation behavior. Starting rename focuses/selects the input; Enter submits once; Escape cancels and returns to its item without closing the drawer. Delete confirmation keeps current service callbacks and nested dialog owner.

### Separate data emptiness from filter emptiness

Derive three render states from `isLoading`, `tree.length`, `searchQuery.trim()` and `filteredTree.length`:

- loading: bounded localized status;
- `tree.length === 0`: existing true-empty wording and create-first action;
- non-empty query with zero filtered nodes: localized no-match wording, no create-first action;
- otherwise: tree.

No search algorithm, folder-match rule or workspace data is changed.

### Reuse the current language owner

Add typed keys for the ProjectDrawer shell and F-02 board/folder actions, tree state, search states, rename/delete confirmation and safe generic success/failure summaries. Consume only the existing `I18nProvider`; do not infer from `navigator.language` or create a second persisted preference. Project/PPT/Layer tab labels are shell keys, while FramePanel/LayerPanel content stays with F-25/F-04. F-03 import/export content stays outside this change.

### Keyboard resize is opt-in and bounded

When ProjectDrawer enables it, expose the existing separator as a localized vertical separator with `aria-valuemin/max/now`. ArrowLeft decreases and ArrowRight increases the numeric drawer width by a documented fixed step, clamped to the same min/max, then calls the existing `onWidthChange` once. Pointer/touch drag, storage key and width values remain unchanged.

## Risks / Trade-offs

- Tree keyboard handlers can double-fire nested buttons or change multi-selection intent.
  - Mitigation: stop row activation for native controls; assert exact callback counts for pointer, Enter and Space with modifiers.
- Escape can close rename/menu/dialog and the drawer together.
  - Mitigation: explicit nested-layer precedence and propagation tests.
- Async tree refresh can strand focus on a removed item.
  - Mitigation: item-id focus owner with nearest-survivor fallback and no implicit activation.
- Opt-in shared props can accidentally alter other callers.
  - Mitigation: defaults reproduce current output; add negative tests for a non-opted-in SideDrawer and ContextMenu.
- Localization can translate user data or leave partial ProjectDrawer copy.
  - Mitigation: typed safe-copy inventory, user-name/error/file sentinel tests and explicit F-03/F-04/F-25 boundary.
- Keyboard resize can conflict with dock orientation or stored width.
  - Mitigation: numeric-width semantics independent of edge, same clamp/callback/storage owner, left/right dock tests.

## Verification and acceptance

- Red tests first for current generic rows, unnamed/invisible actions, focus-order gap, context-menu focus, false-empty search and English Chinese-copy results.
- Component tests for open/close/focus return, nested Escape, tree arrows/activation/selection/state, menu/submenu focus, rename, delete dialog adjacency, loading/empty/no-match and zh/en live switching.
- Verify every current pointer operation still invokes the same callback once and no storage/service API shape changes.
- Same production build at 1280×720 must show one named ProjectDrawer, named close/actions, correct focus path and honest search state.
- Obtain fresh 768/390/320 same-state screenshots and geometry before any compact/touch CSS implementation or claim; if the browser environment still blocks viewport control, leave compact visual acceptance blocked rather than infer it.
- Run focused lint/typecheck/tests, full typecheck/test comparison, cycles, build, size, startup and available smoke/feature/visual/responsive E2E.
- No performance claim without at least five before/after samples of drawer open, first focusable readiness and large-tree interaction under the same build/browser/device conditions.

## Rollback

- Remove ProjectDrawer opt-in shell/menu/resize props and tests, tree semantics/handlers, state branch and i18n keys.
- Restore current pointer-only rows, current filter branch and literals without changing WorkspaceService or storage.
- No migration, cache deletion, user-data rewrite or Board/Folder recovery is required.
