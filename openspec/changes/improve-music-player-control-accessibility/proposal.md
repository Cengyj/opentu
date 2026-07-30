# Change: Improve Music Player Control Accessibility

## Why

The reachable global playback overlay renders previous, play/pause, next, layout, and close as icon-only native buttons whose names currently depend only on visual hover tips. In a controlled 1280×720 Chromium accessibility snapshot, all five appeared as empty `button` entries. The equivalent music-player tool controls already expose explicit names, so minimizing the tool removes programmatic identification from the same playback actions.

Adding accessible names changes assistive-technology-observable behavior and requires approval. The shared outer WinBox title bar remains owned by `improve-tool-window-accessibility` and is not duplicated here.

## What Changes

- Give every existing icon-only global playback action a stable localized accessible name matching its current operation and state.
- Keep disabled previous/next controls named, and keep play/pause and layout labels synchronized with current state/action.
- Preserve visible icons, hover tips, geometry, queue behavior, callbacks, storage, media/reading behavior, and pointer interaction.
- Add focused component/accessibility-tree tests for minimized-tool playback continuity and control names.

## Impact

- Affected specs: `canvas-audio-playback`
- Affected code: global CanvasAudioPlayer controls, localization/props only if required, focused tests
- Visual/data impact: no intended visual, storage, cache, task, asset, playlist, board, or migration change
- Rollback: remove names/localization/tests together; pointer behavior and persisted preferences remain unchanged

## Evidence

- `packages/drawnix/src/components/audio-node-element/CanvasAudioPlayer.tsx:400-429` renders previous/play-next icon buttons without explicit names.
- `packages/drawnix/src/components/audio-node-element/CanvasAudioPlayer.tsx:511-538` renders layout and close icon buttons without explicit names.
- Browser DOM inspection at 1280×720 found those five buttons with `aria=null`, `title=null`, and empty text; the accessibility snapshot exposed them as unnamed buttons while speed, mode, volume, queue, and open-tool controls were named.
- `packages/drawnix/src/tools/tools/music-player/MusicPlayerTool.tsx:692-805` already labels the corresponding tool controls, confirming the semantic discontinuity on minimize.

## Approval

Implementation is blocked until the user approves localized names and state-aware play/pause/layout semantics for the global overlay.
