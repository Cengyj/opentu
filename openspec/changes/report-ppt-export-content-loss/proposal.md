# Change: Report PPT Export Content Loss

## Why

The image-first PPT exporter currently catches a primary slide image load failure, writes a slide without that image, resolves the export promise, and reports the whole deck as successfully exported. A controlled local diagnostic used a primary image URL returning HTTP 404: `slide.addImage` was never called, while `pptx.writeFile` was called and the public export promise resolved.

Because one generated image contains the page text, layout, background, and visual design, losing it makes that exported page materially incomplete. Changing export completion and feedback semantics is user-observable and requires approval.

## What Changes

- Treat failure to embed an image-first page's current primary slide image as a blocking export error; do not download a deck or report success.
- Return a structured export result for non-critical legacy element omissions and show an explicit partial-export warning instead of a full-success message.
- Identify affected pages by safe page index/name in feedback, without exposing source URLs, credentials, provider payloads, prompts, or task identifiers.
- Keep page order, PPTX layout, transition injection, media fallback, filename, board data, cache keys, and stored PPT metadata unchanged.
- Add focused failure/success/partial-result tests and analytics assertions.

## Impact

- Affected specs: `ppt-editing`
- Affected code: `services/ppt/ppt-export-service.ts`, `components/project-drawer/FramePanel.tsx`, PPT export tests and analytics assertions
- Data/migration impact: none; no board, cache, task, prompt, or PPT metadata format changes
- Rollback: restore the void export result and previous UI messages together; no persisted data needs migration

## Evidence

- `packages/drawnix/src/services/ppt/ppt-export-service.ts:1516-1519` catches and discards image conversion/embedding failures.
- `packages/drawnix/src/services/ppt/ppt-export-service.ts:1496-1848` also discards per-element errors and always returns `true` for the slide.
- `packages/drawnix/src/services/ppt/ppt-export-service.ts:1853-1904` therefore writes the file whenever at least one slide object was created, not when required content was embedded.
- `packages/drawnix/src/components/project-drawer/FramePanel.tsx:3517-3525` treats promise resolution as full success and reports the original frame count.
- The diagnostic used only synthetic board data and a local 404 response; no provider, credential, or paid request was used.

## Approval

Implementation is blocked until the user approves blocking download for missing primary slide images and explicit partial-success feedback for omitted non-critical legacy elements.
