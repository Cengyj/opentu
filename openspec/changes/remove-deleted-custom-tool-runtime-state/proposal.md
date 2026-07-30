# Change: Remove Deleted Custom Tool Runtime State

## Why

Deleting a custom tool removes only its catalog record. Open/minimized window instances, pinned IDs, pinned metadata, and pin preferences remain owned by `ToolWindowService`. After the final instance closes, the toolbar creates a launcher from stale pinned metadata; clicking it cannot resolve a tool definition.

A controlled diagnostic added, opened, pinned, deleted, and closed a custom tool. The catalog returned null while `isPinned(id)` remained true and `getToolbarTools()` still returned a launcher. Fixing deletion cleanup changes visible window/toolbar behavior and localStorage state, so implementation requires approval.

## What Changes

- After a custom-tool deletion has persisted successfully, close all open/minimized window instances for that tool ID.
- Remove its pinned ID, pinned metadata, and explicit pin preference from localStorage/state so no stale launcher survives.
- Preserve all serialized canvas tool elements; deleting a catalog definition SHALL NOT delete board content.
- Allow a preserved canvas element to open a transient window from its embedded definition, but do not offer persistent pinning unless that tool ID exists again in the current catalog/registry.
- On cancel, missing tool, or persistence failure, leave window and pin state unchanged.

## Impact

- Affected specs: `toolbox-plugin-runtime`, `toolbox`
- Affected code: `packages/drawnix/src/components/toolbox-drawer/ToolboxDrawer.tsx`, `packages/drawnix/src/services/tool-window-service.ts`, `packages/drawnix/src/components/toolbar/minimized-tools-bar/MinimizedToolsBar.tsx`, and focused tests
- Related change: `ensure-custom-tool-write-consistency` establishes the successful durable delete boundary before runtime cleanup
- Preserved data/API: custom-tool IndexedDB schema, board elements, URL/permissions, built-in tools, analytics schema, and window instance ID format remain unchanged

## Evidence

- `packages/drawnix/src/components/toolbox-drawer/ToolboxDrawer.tsx:391-427` calls only `toolboxService.removeCustomTool` after confirmation.
- `packages/drawnix/src/services/toolbox-service.ts:153-163` has no window/pin cleanup call.
- `packages/drawnix/src/services/tool-window-service.ts:133-218` owns persisted pinned IDs/info/preferences independently; `:746-783` creates a launcher from stale metadata even when the registry lacks the tool.
- `packages/drawnix/src/components/toolbar/minimized-tools-bar/MinimizedToolsBar.tsx:106-112` cannot open that launcher when `toolboxService.getToolById` returns null.
- Controlled Node 24.14.0 / jsdom / Vitest 3.2.4 diagnostic: after add/open/pin/delete/close, catalog lookup was null, pin state remained true, and the toolbar state contained the deleted tool launcher; 1/1 test passed, exit 0. The temporary diagnostic was deleted.

## Approval

Implementation is blocked until the user approves successful-delete window closure, pin cleanup, and transient behavior for preserved canvas elements.

