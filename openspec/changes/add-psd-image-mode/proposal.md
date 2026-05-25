# Change: Add PSD image generation mode

## Why

Users need a first PSD-oriented image workflow that keeps the familiar AI image generation dialog while making layered composition planning explicit. The first version should provide a small, verifiable UI mode for planning PSD-style layers without implying that the upstream image model returns a native PSD file.

## What Changes

- Add `psd` as a third sub-mode of the existing AI image generation window alongside single and batch modes.
- Add an `ai-psd-generation` UI surface that reuses the existing image-generation controls and style language.
- Show a right-side layer plan / preview panel for PSD composition planning.
- Keep PSD planning on the existing image-generation task surface for the first version.
- Persist the selected AI image sub-mode with the existing image mode cache key.

## Non-Goals

- Do not add a top-level PSD dialog.
- Do not add `TaskType.PSD`, `AssetType.PSD`, or a new durable PSD asset type in the first version.
- Do not promise that OpenAI or other upstream image APIs directly return native PSD/layered files.
- Do not implement final PSD binary export in this first UI skeleton unless a later approved change scopes it.

## Impact

- Affected specs: `psd-image-mode`
- Affected code:
  - `packages/drawnix/src/components/ttd-dialog/ttd-dialog.tsx`
  - `packages/drawnix/src/components/ttd-dialog/ai-psd-generation.tsx`
  - `packages/drawnix/src/components/ttd-dialog/ai-psd-generation.scss`
  - `packages/drawnix/src/components/ttd-dialog/shared/ActionButtons.tsx` (optional backward-compatible label/quantity props only)
