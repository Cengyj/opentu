# Change: Keep Maximized Generation Dialogs Inside the Current Viewport

## Why

The image and video generation dialogs automatically maximize on mobile and tablet viewports. If either dialog is opened at `844×390` and the device rotates to `390×844`, the responsive form switches to its compact layout but the shared WinBox instance remains `844×390`. The second mobile tab then has zero visible pixels and cannot be activated through pointer input.

The current source explains the split state: `useDeviceType` updates the dialog content from the new viewport width, while WinBox only refreshes its internal root dimensions on `resize`; its own source explicitly leaves maximized-window adjustment unimplemented. `WinBoxWindow` calls `maximize()` when `autoMaximize` becomes true, but the call is a no-op while the instance is already maximized. This behavior was reproduced for both image and video dialogs. A direct cold open at `390×844` is correctly maximized and remains the control sample.

Changing the layout after viewport resize or orientation change is user-observable, so implementation requires approval.

## What Changes

- While an image or video generation dialog is visible and maximized, update its maximized geometry after the viewport changes so it remains within the current viewport.
- Preserve the mounted dialog content and its prompt, reference images, selected model, parameters, task list, and active mobile panel during the resize.
- Keep direct mobile opens, desktop window sizing, restored non-maximized positions, split windows, task execution, persistence, caching, and provider routing unchanged.
- Add focused wrapper tests and responsive browser coverage for landscape-to-portrait and portrait-to-landscape transitions.

## Impact

- Affected specs: `generation-dialog-responsive`
- Affected code: `packages/drawnix/src/components/winbox/WinBoxWindow.tsx`; generation-dialog integration tests and responsive Playwright coverage
- Preserved data/API semantics: no task schema, IndexedDB data, local preference, cache key, provider request, or public generation-service contract changes
- User-visible trade-off: a maximized generation dialog follows viewport size changes instead of retaining the previous orientation's bounds

## Evidence

- `packages/drawnix/src/components/ttd-dialog/ttd-dialog.tsx:724-785` and `:840-855` route both dialogs through `WinBoxWindow` with mobile auto-maximization.
- `packages/drawnix/src/hooks/useDeviceType.ts:118-149` updates device information on `resize` and `orientationchange`.
- `packages/drawnix/src/components/winbox/WinBoxWindow.tsx:945-952,1180-1185` maximizes on creation or when the boolean prop changes, but does not recompute an already-maximized instance on viewport changes.
- `node_modules/winbox/src/js/winbox.js:386-397` refreshes the library root dimensions but leaves window-size adjustment as an explicit upstream TODO; `:1117-1133` makes `maximize()` a no-op while `max` is already true.
- In-app browser sample, Chromium, source served at `http://localhost:7200/`: image and video dialogs opened at `844×390` remained `844×390` after rotation to `390×844`; each “生成任务” tab had `visiblePixels: 0`. Pointer activation failed because the target point was outside the viewport. A cold image-dialog open at `390×844` produced a `390×844` WinBox and a fully visible task tab.
- Screenshots: `docs/evidence/f08-generation-dialog/mobile-cold-open-390x844.jpg`, `docs/evidence/f08-generation-dialog/mobile-rotation-landscape-to-portrait-390x844.jpg`, and `docs/evidence/f08-generation-dialog/video-rotation-landscape-to-portrait-390x844.jpg`.

