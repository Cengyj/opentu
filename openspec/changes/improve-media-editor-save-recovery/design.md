## Context

`ImageEditorCore.handleSaveAction` calls `onOverwrite` or `onInsert`, immediately clears `pendingImageUrl`, and closes its save options. `UnifiedMediaViewer.handleEditorOverwrite` and `handleEditorInsert` also call their parent callbacks and immediately execute `handleBackToPreview`. The reachable Drawnix callbacks are `async` and perform Cache API writes, image decode, and Plait insertion/update; they catch errors and show a message. The current callback types return `void`, so no layer can represent persistence completion.

## Goals / Non-Goals

- Goals: keep one authoritative save attempt, preserve retryable edit state on failure, and exit edit mode only after the board/cache write succeeds.
- Non-Goals: change editing tools, add autosave, change cache keys or media formats, or add a new recovery store.

## Decisions

- Change overwrite/insert callbacks to accept an awaitable result and have the viewer await it.
- The Drawnix handlers continue to own concrete cache/board error messages, but propagate failure after reporting it so the viewer can retain edit state.
- Disable only duplicate persistence actions while saving; closing or cancelling behavior must be specified and covered without silently discarding an in-flight result.
- Clear pending image and edit-state maps only after a fulfilled persistence callback.

## Risks / Trade-offs

- Existing synchronous consumers must remain source-compatible or be migrated explicitly.
- A save that completes after the viewer unmounts must not set stale React state.
- Cache success followed by board-update failure can leave an unreferenced cache object; this change does not delete user media automatically.

## Migration Plan

No stored board, cache key, or media serialization migration is required. Rollback restores void callbacks and immediate mode exit; existing cached edited images remain valid.
