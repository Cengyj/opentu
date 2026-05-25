## Context

The existing AI image window already supports `single` and `batch` sub-modes in `ttd-dialog.tsx`. Single image generation owns model selection, parameters, reference images, prompt input, knowledge-note context, preview, and canvas insertion. Batch generation is lazy-loaded and only shown on desktop/tablet-capable layouts.

The PSD request is a UI and workflow addition, not a new upstream media primitive. OpenAI-style image APIs generate or edit raster images; they do not provide a native PSD/layered output contract for this change.

## Goals / Non-Goals

- Goals:
  - Add `psd` as an AI image sub-mode without changing top-level dialog routing.
  - Reuse existing AI image controls and visual patterns.
  - Show an editable/previewable PSD layer plan in the right panel.
  - Keep the first implementation compatible with the existing `TaskType.IMAGE` and image asset flows.
- Non-Goals:
  - No top-level PSD dialog.
  - No new `TaskType.PSD` / `AssetType.PSD` in this change.
  - No final PSD binary export pipeline.
  - No new model provider contract that assumes native PSD output.

## Decisions

- Decision: Treat PSD as an AI image sub-mode.

  The user enters the existing AI image window and switches among `single`, `batch`, and `psd`. This keeps model routing, image credentials, dialog sizing, and selected-content prefill behavior aligned with current image generation.

- Decision: Keep PSD planning on the image task surface.

  First-version PSD planning may create prompts and preview a layer plan, but any generation work remains image generation. This avoids introducing global task/asset types before the export/data model is approved.

- Decision: Lazy-load the PSD UI component.

  The new UI is a sibling to the batch component and should not increase the initial dialog bundle unnecessarily.

- Decision: Use a local layer-plan preview contract.

  The PSD panel displays planned layers (name, role, prompt/description, visibility/order) so users understand the intended composition. Exporting a native `.psd` file is a later capability.

## Integration Plan

1. Extend `ImageGenerationMode` in `ttd-dialog.tsx` from `single | batch` to `single | batch | psd`.
2. Add a third header tab and title branch for PSD mode.
3. Lazy-load `ai-psd-generation` for the PSD branch and pass the same selected image model/model-ref handlers used by single/batch modes.
4. Keep mobile/tablet restrictions limited to batch mode; PSD remains available where the first UI can fit safely, with responsive layout handled by the component stylesheet.
5. Keep mode persistence under the existing AI image mode cache key with safe fallback to `single` for unknown values.

## Risks / Trade-offs

- Risk: Users may expect a real PSD file immediately.
  - Mitigation: Label first-version UI as PSD layer planning/preview and do not add a PSD asset/task type.
- Risk: Parallel team work can touch shared dialog files.
  - Mitigation: Limit dialog edits to mode selection/routing and leave PSD component internals to the component implementation lane.
- Risk: Persisted unknown mode values could break dialog startup.
  - Mitigation: Normalize stored values and default to `single`.
