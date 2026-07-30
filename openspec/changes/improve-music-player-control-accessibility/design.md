## Context

The music-player tool and global overlay render the same `CanvasAudioPlaybackService` state. `HoverTip` supplies visual pointer help but does not become an accessible name in the current browser tree. Speed, mode, volume, queue, and open-tool controls already use explicit `aria-label`; five adjacent icon buttons do not.

## Goals / Non-Goals

- Goals: make every existing overlay action identifiable to keyboard/screen-reader users in its current state, including after the tool is minimized.
- Non-Goals: no WinBox shell/focus work, new keyboard shortcuts, focus trap, visual redesign, touch-size change, queue/reading behavior change, new live-region policy, or product feature.

## Decisions

- Add explicit localized accessible names directly to native buttons; do not rely on `HoverTip`, SVG names, CSS content, or `title`.
- Previous and next use operation names even when disabled. Primary action names the action available now (`播放` or `暂停`). Layout names the action target (`切换为垂直布局` or `切换为水平布局`). Close names the existing stop-and-clear action without embedding track title or URL.
- Reuse existing language ownership if available; otherwise pass only the localized strings needed by this component. Names must not include title, note text, media URL, provider/task/clip ID, error body, credential, or persisted position.
- Keep visible markup/styles/callbacks intact so screenshot geometry has no intended delta.

## Invariants

- Pointer activation, disabled conditions, queue navigation, play/pause, layout persistence, and close/stop behavior remain unchanged.
- Minimizing/restoring the music-player tool preserves playback exactly as specified by the active music-player change.
- `improve-tool-window-accessibility` exclusively owns the outer WinBox root/title controls/focus/Escape/launcher menu.

## Risks / Trade-offs

- State labels can become stale if derived from a different owner than visible state; component tests must rerender play/pause and horizontal/vertical transitions.
- Duplicate tooltip and accessible text can cause redundant speech in some wrappers; the explicit button name remains authoritative and browser snapshots verify one useful name.

## Verification And Rollback

- Component tests assert names for enabled/disabled previous-next, play/pause transitions, layout transitions, and close, with privacy-safe values.
- Browser verifies Tab order, names, Enter/Space/pointer parity, minimize/restore, audio/reading, Chinese/English, and no duplicate activation at desktop/tablet/mobile.
- Same-state screenshots confirm no geometry/color/layout delta. Rollback removes labels/localization/tests only.
