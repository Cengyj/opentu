# Change: Make media-library selection constraints and completion truthful

## Why

The media-library selection API exposes three contracts that the current reachable implementation does not preserve:

1. `filterType` / `filterCategory` are documented as picker constraints, but `MediaLibraryModal` implements them by mutating the shared `AssetContext.filters`. Closing that picker does not restore the previous browse filters, and `MediaLibraryGrid` does not consume its constraint props. In an in-app Chromium run, opening the AI input image picker set `图片：0` to `aria-pressed=true`; after closing it and opening the general canvas media library, `图片：0` was still pressed and `全部：0` was false. The state and screenshot are retained in `docs/evidence/f13-media-library/filter-leak-general-entry-1280x720.jpg`.
2. Callers pass a distinct `batchSelectButtonText`, but `MediaLibraryModal` never reads it and the batch inspector renders `selectButtonText`. The public prop therefore has no effect.
3. The modal correctly closes only after an `onSelect` / `onSelectMultiple` promise fulfills, but the two reachable canvas insertion callers catch or convert insertion failure into a fulfilled promise. The modal therefore closes after a reported failure, removing the user's selection and retry path. This contradicts the current insertion lesson, which requires `await onSelect(asset)` and close only after success.

These fixes change visible filter, label, and failure-recovery behavior, so implementation requires approval.

## What Changes

- Treat `filterType` and `filterCategory` as invocation-local picker constraints instead of writing them into the user's shared browse filters.
- Enforce the constraints for filtering and selection while the picker is open; closing a constrained picker leaves the pre-existing browse filters unchanged.
- Carry `batchSelectButtonText` through the modal and inspector and use it only for the batch confirmation action, with the existing default when omitted.
- Define selection callbacks as an awaitable success boundary: fulfill → close once; reject → keep the modal, selected asset(s), filters, and retry state available, reset the pending indicator, and avoid an unhandled rejection.
- Make reachable canvas insertion consumers propagate failure after their existing user-facing error message; do not add automatic retries or queues.
- Audit every direct `MediaLibraryModal` caller for the same completion contract and add focused tests for constrained selection, labels, single/batch success, rejection, duplicate activation, and unmount.

## Impact

- Affected specs: `media-library`
- Affected code: `MediaLibraryModal.tsx`, `MediaLibraryGrid.tsx`, `MediaLibraryInspector.tsx`, media-library prop types, the creation and quick-creation toolbar insertion callbacks, all direct selection callers for contract verification, and focused tests
- Related active changes: `add-ai-input-paste-images` and `update-video-character-asset-reuse` use constrained media pickers but do not specify filter ownership or callback completion; this change preserves their accepted asset types and adds the missing invocation boundary. `update-canvas-batch-flow-layout` owns layout, not modal close/retry semantics.
- Non-conflicts: `fix-media-library-responsive-interaction` owns window bounds/mobile details; `improve-media-editor-save-recovery` owns full-screen editor persistence, not media-library selection.
- Preserved data/API semantics: no asset/task/cache/board schema, filter storage format, model/provider route, canvas layout algorithm, or analytics schema changes
- Rollback: restore shared-filter mutation, the ignored batch label, and fulfilled-on-error consumers; no migration or user-data cleanup is required, but the verified filter leak and failure-close behavior return

## Evidence

- `packages/drawnix/src/types/asset.types.ts:337-350,395-404` defines selection constraints and a separate batch label.
- `packages/drawnix/src/components/ai-input-bar/AIInputBar.tsx:5178-5187` opens an image-only picker and supplies `batchSelectButtonText="批量插入对话框"`.
- `packages/drawnix/src/components/media-library/MediaLibraryModal.tsx:24-33,79-87` omits the batch label and writes picker constraints into shared filters only when a constraint is present; close/unconstrained open has no restoration path.
- `packages/drawnix/src/components/media-library/MediaLibraryGrid.tsx:281-298` does not destructure `filterType` or `filterCategory`, so the props cannot constrain filtering or selection.
- `packages/drawnix/src/components/media-library/MediaLibraryInspector.tsx:57-70,302-318` receives only `selectButtonText` and uses it for the batch action.
- `packages/drawnix/src/components/media-library/MediaLibraryModal.tsx:123-190` awaits callback fulfillment before close, establishing the intended modal boundary.
- `packages/drawnix/src/components/toolbar/creation-toolbar.tsx:291-365` catches single insertion errors and converts failed batch results to messages without rejection.
- `packages/drawnix/src/components/toolbar/quick-creation-toolbar/quick-creation-toolbar.tsx:208-236,259-324` does the same and also closes local UI after the fulfilled failure path.
- `docs/MEDIA_LIBRARY_INSERTION_LESSONS.md:107-121` records that modal close must happen only after awaited insertion success.
- Runtime pressed states after constrained picker → general library: `全部：0=false`, `图片：0=true`, `视频：0=false`, `音频：0=false`.
