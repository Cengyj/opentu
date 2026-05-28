## Context

PSD mode is already an AI image sub-mode and currently reuses `TaskType.CHAT` for layer analysis and `TaskType.IMAGE` for same-canvas layer asset generation. The existing implementation has the right provider boundary, but the UI creates layer image tasks immediately after analysis and mixes draft state, task synchronization, preview, and export packaging in large React modules.

## Goals

- Make PSD generation reviewable before image tasks are queued.
- Use a single internal draft shape for layer names, prompts, visibility, task ids, result urls, and status.
- Reflect task progress per layer from existing image tasks keyed by `params.psdPlan.layerId`.
- Improve retry and partial-success export behavior.
- Keep the work compatible with the existing AI image dialog and task queue.

## Non-Goals

- No native PSD binary writer.
- No new global media/task enums.
- No server-side export service.
- No drag-reorder or advanced text styling in this optimization pass.

## Decisions

- Decision: The analysis task ends in a review state.

  The component SHALL parse the `gpt-5.5` analysis response into the dynamic layer plan and wait for explicit user confirmation before creating image layer tasks.

- Decision: Layer edits update local draft data only.

  Users may rename a layer, edit its image-generation prompt, and include/exclude it from generation/export. These edits update the local plan/draft used to build `TaskType.IMAGE` layer tasks.

- Decision: Per-layer state is derived from task metadata.

  The workbench SHALL map image tasks to layers by `params.psdPlan.layerId`; when retries create additional tasks for the same layer, the newest task becomes the active state for that layer while completed older tasks remain exportable if no newer task is ready.

- Decision: Export remains a PSD-ready zip.

  The package SHALL include generated layer assets, source images, manifest, and README. The manifest SHALL record failed/cancelled layers when the user exports a partial result.
