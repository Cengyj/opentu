# Design: AI input and attachment control accessibility

## Context

`AIInputBar` owns three icon-only upload/library/send controls. `SelectedContentPreview` owns the existing remove action and is shared by `AIInputBar` and `EnhancedChatInput`. Browser evidence at 1280×720, 768×1024, and 390×844 found one upload, library, and send button and two remove buttons after two pasted attachments, but zero controls with the expected localized names. Each remove button measured 16×16 CSS px. Its stylesheet sets `opacity: 0` and only restores opacity on item hover.

## Decisions

- Reuse each component's existing `language` owner. Do not introduce another locale store or infer browser locale.
- Keep visible upload/library/send icons and callbacks unchanged; add localized names and explicit non-submit button types.
- Give each remove control a localized name that identifies its associated item using stable rendered information such as item name/type and position. Do not expose URLs, Base64 data, or private content in the label.
- Preserve the current fine-pointer hover appearance. Add narrowly scoped focus-visible and non-hover/coarse-pointer visibility rules for removal.
- Meet a 24×24 CSS px minimum removal target without changing the 36×36 preview's data order or allowing the target to cover an adjacent preview. If the existing overlay cannot meet that invariant, adjust only preview-local spacing/target geometry.
- Keep `fix-mobile-toolbar-input-overlap` as the sole owner of fixed toolbar/input clearance. This change must not move either surface, alter global z-index, or claim that the 390×844 attachment-state occlusion is resolved.

## Alternatives

- Keep HoverTip only: rejected because HoverTip is not the button's accessible name and hover is unavailable to many touch users.
- Add only `aria-label`: rejected because it would leave the control visually hidden on keyboard focus and non-hover input and would preserve the 16×16 target.
- Enlarge the whole preview to 44×44: not selected as the default because the browser evidence does not justify a cross-layout size change; 24×24 is the scoped minimum and must still pass adjacent hit testing.
- Move the mobile toolbar: excluded because the approved owner for that separate surface interaction is `fix-mobile-toolbar-input-overlap`.

## Risks and verification

- A larger overlay can cover the image or the next thumbnail; verify exact rectangles and `elementFromPoint`/pointer activation for adjacent items.
- Always-visible removal can add visual noise on fine pointers; keep the existing hover presentation there and show persistently only when hover is unavailable.
- Item labels can become long or disclose raw content; labels must use bounded display metadata and never URLs/Base64/text bodies.
- Verify Chinese/English, repeated names, keyboard focus/Enter/Space, coarse pointer, 1280×720, 768×1024, 390×844, light/dark, and same-state screenshots after approval.

Rollback removes only attributes, preview-local CSS, and tests. No stored attachment, asset, task, cache, workflow, provider, or migration data changes.
