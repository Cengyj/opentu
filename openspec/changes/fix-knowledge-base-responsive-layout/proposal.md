# Change: Keep the knowledge base operable on narrow tool-window viewports

## Why

The knowledge-base tool is reachable at a configured 900×700 window, but its internal layout has fixed 280 px and 300 px sidebars plus a 400 px editor minimum and no responsive rule. In the in-app Chromium browser at the current source, light theme, 100% zoom, DPR 1, and a 390×844 viewport, the knowledge-base body had `clientWidth=389` and `scrollWidth=982`; the editor began at x=471 and the right sidebar ended at x=1172. All three title-row editor actions were outside the viewport. The WinBox itself was 400 px wide at x=190, so its right edge was 590. Evidence is stored in `docs/evidence/f23-knowledge-base/knowledge-base-390x844-before.png` and the corresponding metrics JSON.

The pending `fix-tool-window-viewport-transition` change owns the generic opt-in WinBox clamp, but it cannot make this three-pane 982 px content usable. Knowledge-base compact pane navigation is a separate user-visible behavior and requires its own approval.

## What Changes

- Opt the knowledge-base tool into the approved shared viewport constraint so its title controls and content bounds fit on cold open and live viewport transitions.
- Add a container-driven compact layout that presents the existing directory tree, note editor, and related/extraction area as navigable panes without unmounting or discarding the active draft.
- After selecting a note in compact mode, move to the editor pane and provide an explicit accessible route back to the tree; keep related/extraction reachable through the existing panel concept.
- Preserve the desktop three-column resizers and saved widths when the container can contain them; compact adaptation must not overwrite desktop width preferences.
- Verify desktop/tablet/mobile, portrait/landscape, themes, Chinese/English lengths, keyboard/focus, touch targets, long content, empty/error/loading, and save failure/retry states.

## Impact

- Affected specs: `knowledge-base-responsive`
- Affected code: knowledge-base content/editor/tree/styles, knowledge-base tool adapter/manifest, `ToolWinBoxManager`/`WinBoxWindow` only through the shared opt-in primitive, and focused responsive/accessibility tests
- Shared primitive conflict: `fix-tool-window-viewport-transition`, `fix-media-library-responsive-interaction`, and generation-dialog viewport work touch shared WinBox behavior. Implement the primitive once, keep caller opt-ins independent, and do not make knowledge-base approval enable other callers.
- Editor dependency: compact pane switches must preserve drafts and remain compatible with `fix-knowledge-base-editor-save-durability`; they must not silently clear current timers/state before that change is approved.
- No note, directory, tag, asset, cache, task, backup, or migration format changes
- Rollback removes the knowledge-base opt-in/compact navigation/styles/tests and restores desktop-only internal layout; no data cleanup is required

## Current Evidence

- `built-in-manifests.tsx:148-156` registers a reachable 900×700 knowledge-base window.
- `KnowledgeBaseContent.tsx:93-115` initializes 280/300 px persisted sidebar widths.
- `knowledge-base-drawer.scss:8-23,69-90` lays out the panes in one flex row and enforces `min-width: 400px` on the editor with no compact media/container query.
- One controlled geometry run proves clipping and unreachable editor actions; it is visual/layout evidence, not a performance sample.
- The running Vite app served successfully, while its separately started Service Worker watch command failed on an unsupported `--host` option. The responsive DOM result did not depend on Service Worker execution and the environment limitation is retained.
