# Change: Improve media editor save recovery

## Why

The built-in canvas image editor invokes asynchronous overwrite or insert persistence callbacks as if they were synchronous, then immediately clears edit state and returns to preview. If cache, image decode, or board insertion fails, the user receives an error only after the editable state has already been discarded.

## What Changes

- Make overwrite and insert save callbacks explicitly awaitable.
- Keep the editor and pending edited image available while persistence is running and when it fails.
- Prevent duplicate save submissions while one persistence attempt is active.
- Return to preview and clear edit state only after persistence succeeds.
- Preserve the existing cache URL, board element schema, image geometry, and user-facing failure notification paths.

## Impact

- Affected specs: `media-preview`
- Affected code: `UnifiedMediaViewer`, `ImageEditorContent`, `ImageEditorCore`, Drawnix overwrite/insert handlers, and targeted tests.
