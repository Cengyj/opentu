## Context

`UnifiedMediaViewer` is portalled to `document.body` and covers the viewport at z-index 10000. It already closes on Escape and supports keyboard media actions, but the overlay is currently a plain `div`. Static inspection confirms no dialog role or focus calls in the preview/editor subtree, unnamed icon buttons in `ViewerToolbar` and `MediaViewport`, unnamed `role="button"` thumbnails, hard-coded Chinese labels, 26–28 px mobile controls, and motion without a `prefers-reduced-motion` branch.

## Goals / Non-Goals

- Goals: make the existing preview, compare, download, insert, and edit controls operable and identifiable by keyboard, touch, and assistive technology.
- Non-Goals: add media actions, change image/video/audio rendering, change edit-save persistence, redesign the visual language, or replace the shared hover foundation.

## Decisions

- Give the root `role="dialog"`, `aria-modal="true"`, and a localized accessible title.
- Capture the previously focused element when opening, focus a stable viewer control, contain Tab/Shift+Tab inside the visible viewer, and restore focus after close when the target remains connected.
- Use native buttons where practical; keep thumbnail selectors keyboard-operable and add localized names plus current/selected slot state.
- Preserve visible icon sizes while expanding touch hit areas to the approved project threshold at mobile breakpoints.
- Disable non-essential opacity/transform animation when reduced motion is requested.
- Continue using `HoverTip` / `HoverCard` for visual hover help; accessible names must not depend on hover content.

## Risks / Trade-offs

- Focus containment can expose hidden or disabled controls if the selector is too broad; tests must cover single, compare, and edit modes.
- Larger hit areas can increase toolbar overflow at 320–390 px; responsive tests must verify scrolling and media visibility.
- Localized strings can change toolbar width; Chinese and English need the same viewport matrix.

## Migration Plan

No stored data, cache keys, media URLs, or element schemas change. Rollback removes the semantic/focus helpers, localized labels, and responsive/reduced-motion rules.
