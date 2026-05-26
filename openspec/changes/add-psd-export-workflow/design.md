## Context

PSD mode already exists as a sub-mode in the AI image generation window. It reuses image controls and displays a local layer-plan preview. The project already has an image generation task queue, GPT Image adapter, reference image upload, prompt history, model routing, and OpenAI GPT Image compatibility migration.

Public OpenAI-compatible image APIs should be treated as raster image generation/editing APIs. They can help create layer assets, transparent subjects, backgrounds, and image edits, but the PSD file must be assembled by Opentu.

## Goals

- Make PSD mode visibly useful beyond a static preview.
- Model PSD work as a local draft with editable layers and generation state.
- Generate layer assets through existing image generation pathways.
- Export a baseline Photoshop-compatible PSD from ready layers.
- Keep the first workflow compatible with existing image task and asset systems.

## Non-Goals

- Native upstream PSD generation.
- New global media/task primitive for PSD.
- Full Photoshop feature parity.
- Server-side export as the default first implementation.

## Architecture

### PSD Draft Service

Add `packages/drawnix/src/services/psd/`:

- `psd-draft-types.ts`: draft, group, layer, export status types.
- `psd-plan-builder.ts`: template/rule/LLM-backed layer planning.
- `psd-layer-generation.ts`: map raster layers to `ImageGenerationParams` and existing queue tasks.
- `psd-draft-store.ts`: persist/recover drafts in IndexedDB or the existing storage abstraction.
- `psd-exporter.ts`: browser-side export orchestration.
- `psd-preview-compositor.ts`: deterministic preview composition helpers.

### UI Composition

Keep PSD inside `AIImagePsdGeneration` and split it into internal subcomponents when the file grows:

- `PsdSetupPanel`
- `PsdLayerTree`
- `PsdPreviewCanvas`
- `PsdExportStatus`
- `PsdLayerEditorDrawer` or inline editor

### Task Integration

Layer generation uses existing `TaskType.IMAGE` tasks. A layer task should carry lightweight metadata:

- `psdDraftId`
- `psdLayerId`
- `psdLayerKind`
- `psdLayerName`

This metadata may live in `GenerationParams.params` or `assetMetadata` before any shared type expansion is introduced.

### Export Strategy

Prefer browser-side export in a lazy Web Worker:

1. Fetch/resolve each ready layer image into canvas/image data.
2. Build the PSD document tree with canvas size, groups, layers, visibility, opacity, bounds, and names.
3. Export an ArrayBuffer/Blob and trigger download.

A PSD writing dependency must be lazy-loaded. `ag-psd` is a candidate because it is published as a JavaScript library for reading and writing PSD files and documents browser/Web Worker usage, but it should be evaluated in a focused dependency task before adoption.

### Text Layers

First export workflow supports two modes:

- Preferred: real editable text layers when the chosen writer supports acceptable Photoshop compatibility.
- Fallback: rasterized text layer plus embedded metadata describing text content and style.

The UI should be explicit when fallback rasterized text is used.

## Data Model Sketch

```ts
interface PsdDraft {
  id: string;
  title: string;
  canvas: { width: number; height: number; background: 'transparent' | 'white' | 'custom' };
  source: { prompt: string; model: string; modelRef?: ModelRef | null; referenceImageIds?: string[] };
  groups: PsdLayerGroup[];
  layers: PsdLayerNode[];
  export: { status: 'not-ready' | 'ready' | 'exporting' | 'failed'; psdBlobUrl?: string };
  createdAt: number;
  updatedAt: number;
}
```

## UI Flow

1. User opens AI Image Generation and selects PSD tab.
2. User enters prompt/reference images and chooses template/strategy.
3. User clicks “Generate PSD structure”.
4. UI shows editable layer tree.
5. User optionally edits layer names/prompts/order/text.
6. User clicks “Generate layer assets”.
7. Raster layers create image tasks and update layer state as tasks finish.
8. User clicks “Export PSD” when required layers are ready.
9. Browser Worker packages and downloads `.psd`.

## Risks / Trade-offs

- Browser PSD export may be memory-heavy for many high-resolution layers.
  - Mitigation: limit first-version layer count/resolution and use Web Worker.
- Editable text layer compatibility can be inconsistent.
  - Mitigation: use rasterized text fallback with explicit UI warning.
- AI-generated transparent layers may have artifacts.
  - Mitigation: layer-level retry and clear prompt templates.
- Adding a PSD writer increases bundle size.
  - Mitigation: lazy-load only inside export worker.
