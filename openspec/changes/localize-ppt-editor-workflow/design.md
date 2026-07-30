## Context

Drawnix already exposes `useI18n` and uses `language` in part of `FramePanel`; this proposal extends that existing boundary to the rest of the PPT workflow. Some copy is ephemeral UI, while default Frame names are persisted board data and therefore require explicit compatibility rules.

## Goals / Non-Goals

- Goals: make the existing PPT workflow coherent in Chinese and English, keep stored/user-authored content stable, and verify long-copy layout.
- Non-Goals: add languages, change model/provider text, translate user prompts/content, redesign UI, change generation/export behavior, rename existing pages, or introduce a new localization framework.

## Decisions

- Reuse the current Drawnix i18n mechanism and language owner. Pass language/strings only where context is not already safely reachable.
- Store no localization keys in board/task/cache data. UI resolves ephemeral labels at render time.
- New default PPT page names use active language (`PPT 页面 N` / `PPT Page N`). Existing persisted names, including old defaults, are not rewritten; default-name recognition continues to accept both forms for later renumbering.
- Provider/model labels, raw error bodies, prompts, titles explicitly authored by users, media URLs, and filenames are not translated.
- Coordinate with `improve-ppt-editor-accessibility`: visible-copy keys and accessible-only keys share the same catalog without duplicating strings or coupling approval status.

## Invariants

- All callbacks, shortcuts, task submission/order, selection, save/restore, slideshow navigation, export, analytics categories, and PPT metadata remain unchanged.
- Chinese copy preserves current meaning and operation names.
- Existing boards open without migration and retain their stored names/content.

## Risks / Trade-offs

- Long English strings can overflow the narrow project drawer or slideshow toolbar; responsive screenshots and computed overflow checks are required.
- Mixing stored default names and localized render labels can accidentally rename old boards; tests must assert existing names are untouched across open/reorder/save.
- Adding many unrelated global catalog keys can create drift; keys remain scoped to the PPT workflow.

## Verification And Rollback

- Component tests render every PPT state in `zh` and `en`, exercise confirmation/status/error branches, and assert user-authored/stored values are unchanged.
- Browser verifies desktop/tablet/mobile, light/dark, empty/loading/success/failure/cancel/retry, long titles, fullscreen, and 100%/zoom/high-DPI where available.
- Same-state screenshots and scrollWidth/clientWidth measurements verify no copy clipping or layout shift beyond accepted wrapping.
- Rollback removes keys/wiring and restores inline strings/default creation; no data cleanup is required.
