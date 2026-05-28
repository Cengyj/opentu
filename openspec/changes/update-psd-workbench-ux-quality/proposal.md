# Change: Update PSD workbench UX and code quality

## Why

The current PSD mode analyzes the source image and immediately queues one image task per layer, which makes the workflow feel fixed and opaque. Users need a reviewable layer plan, per-layer status, retry controls, and clearer export wording while the codebase needs narrower PSD workbench modules.

## What Changes

- Change PSD mode to a staged flow: analyze layer structure, review/edit the layer plan, generate layer assets, then download a PSD-ready workspace package.
- Add an internal PSD draft/workbench model to connect analysis, layer task generation, task status, and export packaging.
- Display per-layer task state by `psdPlan.layerId`, including single-layer retry and retry-all-failed controls.
- Keep exports as `.psd-ready-workspace.zip` packages and clearly state that native `.psd` writing remains a future packer concern.
- Split PSD workbench logic into smaller service/hook/component modules without adding new global PSD task or asset types.

## Non-Goals

- Do not implement a native `.psd` writer in this change.
- Do not add `TaskType.PSD`, `AssetType.PSD`, or a top-level PSD dialog.
- Do not change provider request protocols or upstream model capability claims.

## Impact

- Affected specs: `psd-image-mode`
- Affected code:
  - `packages/drawnix/src/components/ttd-dialog/ai-psd-generation.tsx`
  - `packages/drawnix/src/components/ttd-dialog/ai-psd-workflow-view.tsx`
  - `packages/drawnix/src/components/ttd-dialog/psd-workbench/*`
  - PSD-focused tests under `packages/drawnix/src/components/ttd-dialog/`
