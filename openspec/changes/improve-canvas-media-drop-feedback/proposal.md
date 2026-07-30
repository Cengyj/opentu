# Change: Improve canvas media drop feedback

## Why

The reachable multi-file canvas drop path catches insertion failures per file and writes only to the developer console. The drop is reported as handled even when every supported item fails, and a mixed batch gives no user-visible count of inserted, failed, or unsupported files.

## What Changes

- Track supported, successfully inserted, failed, and unsupported files for one drop operation.
- Preserve successful insertions when another file fails and present one localized summary after the batch settles.
- Report all-failed and unsupported-only drops without adding an automatic deletion or rollback policy.
- Keep media classification, asset URLs, element schemas, layout coordinates, viewport restoration, and existing file support unchanged.

## Impact

- Affected specs: `canvas-insertion`
- Affected code: `packages/drawnix/src/plugins/with-image.tsx`, message/i18n resources, and targeted drop tests.
- Related active change: `update-canvas-batch-flow-layout` owns service/MCP flow layout; this change only covers direct user file drop feedback.
