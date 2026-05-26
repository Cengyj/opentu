# Change: Add PSD export workflow

## Why

The current PSD mode provides a local layer-plan preview, but users ultimately need a practical workflow that can generate layer assets and export a Photoshop-compatible PSD file. Public OpenAI-compatible image APIs generate/edit raster images rather than native PSD projects, so Opentu must own the PSD draft model, layer orchestration, and export packaging.

## What Changes

- Extend PSD mode from a static layer-plan preview into a PSD draft editor.
- Add a local PSD draft model for canvas, groups, layers, generation state, and export state.
- Reuse existing image generation tasks to generate raster assets for PSD layers.
- Keep PSD layer asset generation on `TaskType.IMAGE` in the first export workflow.
- Add an export pipeline that can package ready layer assets into a Photoshop-compatible `.psd` file.
- Add clear UI copy that OpenAI-compatible image APIs do not directly return native PSD files.

## Non-Goals

- Do not claim upstream image APIs natively return PSD.
- Do not add a new top-level PSD dialog.
- Do not introduce `TaskType.PSD` or `AssetType.PSD` until PSD export/storage semantics are proven.
- Do not implement smart objects, complex adjustment layers, or full Photoshop text engine compatibility in the first export workflow.
- Do not add a server-side export service in the first workflow unless browser export proves insufficient.

## Impact

- Affected specs: `psd-export-workflow`
- Affected code:
  - `packages/drawnix/src/components/ttd-dialog/ai-psd-generation.tsx`
  - `packages/drawnix/src/components/ttd-dialog/ai-psd-generation.scss`
  - `packages/drawnix/src/components/ttd-dialog/ttd-dialog.tsx`
  - `packages/drawnix/src/services/psd/*` (new)
  - `packages/drawnix/src/mcp/tools/image-generation.ts` or task metadata adapters, if layer tasks need PSD draft references
  - `packages/drawnix/src/types/shared/core.types.ts` only for optional metadata, not for a new task type
