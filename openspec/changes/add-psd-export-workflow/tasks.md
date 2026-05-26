## 1. Planning And Dependency Evaluation
- [ ] 1.1 Confirm final first-release scope: draft editor + layer generation + browser PSD export MVP.
- [ ] 1.2 Evaluate PSD writer dependency candidates, with `ag-psd` as the primary candidate.
- [ ] 1.3 Verify dependency bundle/runtime behavior in browser Web Worker.
- [ ] 1.4 Decide text-layer strategy: real text layer if reliable, otherwise raster text + metadata fallback.

## 2. PSD Draft Model
- [ ] 2.1 Add `packages/drawnix/src/services/psd/psd-draft-types.ts`.
- [ ] 2.2 Replace the local `PsdPlanDraft` shape with a normalized `PsdDraft` shape.
- [ ] 2.3 Add draft normalization and migration helpers.
- [ ] 2.4 Add draft readiness helpers such as `canGenerateLayerAssets()` and `canExportPsd()`.

## 3. PSD UI Editing
- [ ] 3.1 Split `AIImagePsdGeneration` into setup, preview, layer tree, and export status subcomponents if needed.
- [ ] 3.2 Add `NEW/Beta` indicator to the PSD tab or mode header.
- [ ] 3.3 Add layer rename, visibility, reorder, delete, and prompt edit controls.
- [ ] 3.4 Add text layer controls for content, font size, color, and alignment.
- [ ] 3.5 Add explicit action progression: generate structure, generate assets, export PSD.
- [ ] 3.6 Improve empty/loading/error states for layer generation and export.

## 4. Layer Asset Generation
- [ ] 4.1 Add `psd-layer-generation.ts` to map raster layers to existing image generation params.
- [ ] 4.2 Create `TaskType.IMAGE` queue tasks for raster layers without adding `TaskType.PSD`.
- [ ] 4.3 Store PSD draft/layer metadata on image tasks.
- [ ] 4.4 Sync completed/failed image tasks back into PSD layer state.
- [ ] 4.5 Add single-layer retry and failed-layer retry-all actions.

## 5. PSD Export MVP
- [ ] 5.1 Add a lazy Web Worker export entry.
- [ ] 5.2 Convert ready layer URLs/data URLs into image data usable by the PSD writer.
- [ ] 5.3 Export raster layers with correct name, order, bounds, visibility, opacity, and groups.
- [ ] 5.4 Export text as real text layers if the writer supports it; otherwise rasterize and include metadata.
- [ ] 5.5 Trigger `.psd` download and expose export errors in the UI.

## 6. Persistence
- [ ] 6.1 Persist PSD drafts in IndexedDB or the existing app storage abstraction.
- [ ] 6.2 Restore the last active draft when the PSD tab opens.
- [ ] 6.3 Clean up stale Blob URLs and oversized temporary export data.

## 7. Tests
- [ ] 7.1 Unit-test draft builders, normalization, readiness checks, and layer-to-image-param mapping.
- [ ] 7.2 Component-test PSD tab visibility, draft editing, layer tree operations, and button states.
- [ ] 7.3 Integration-test image task creation and layer task status sync.
- [ ] 7.4 Add a small fixture-based PSD export test that verifies layer count/names/order after writing and reading back when possible.
- [ ] 7.5 Run focused Vitest tests, `pnpm nx run drawnix:typecheck`, and OpenSpec validation.

## 8. Release Validation
- [ ] 8.1 Build Docker image and restart `opentu-web`.
- [ ] 8.2 Verify `http://localhost:7288` serves the new assets.
- [ ] 8.3 Manually verify PSD UI in browser with hard refresh / service-worker cache cleared.
- [ ] 8.4 Open exported PSD in Photoshop or Photopea and verify baseline layers.
