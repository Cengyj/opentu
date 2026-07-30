## Context

The F-30 dialogs use the project Floating UI dialog primitive in controlled mode. `DialogContent` obtains `role=dialog`, overlay scroll lock and focus management. It derives `aria-labelledby` and `aria-describedby` only from mounted `DialogHeading`/`DialogDescription`; F-30 mounts neither. Because entry buttons call the application `openDialog` state function rather than rendering a `DialogTrigger` around the opener, automatic focus return has no reference owner.

The conversion layout uses one shared stylesheet. Below 861 px the panels stack, the textarea becomes 10 rem and the preview stays 400 px. At 480 px the outer dialog is capped at 80 vh, but its overflowing children remain visible while the overlay locks page scroll.

## Goals / Non-Goals

- Goals:
  - Expose localized named modal dialogs, explicit input labels, narrow live error feedback and deterministic focus entry/return.
  - Keep every existing action keyboard reachable and make compact actions fully touch reachable.
  - Preserve background scroll lock, z-index, theme tokens, desktop layout and conversion/insertion contracts.
  - Cover initial/loading/success/error states in zh/en, light/dark and supported compact orientations.
- Non-Goals:
  - Redesign the converter, add new diagram types, change parsing/draft/storage behavior or introduce provider/network work.
  - Change the shared dialog defaults for unrelated callers unless a proven shared primitive correction remains opt-in and independently verified.
  - Rebuild the command palette, toolbar configuration or global mobile shell.
  - Claim performance improvement without measurement.

## Decisions

- Mount a visible localized `DialogHeading` for each converter and associate the existing description through `DialogDescription` where it does not duplicate noisy content. Add the missing Markdown title key in both locales.
- Give `TTDDialogInput` a stable ID or label reference supplied by its panel. Use native `<label htmlFor>` where possible; placeholder remains unchanged as an input hint.
- Put `role=alert` or an equivalent assertive/polite contract only on the concise current error container. Do not place a live region on the preview canvas, full dialog or textarea, and do not repeat user input.
- Keep initial focus on the syntax textarea. Capture the actual invocation owner when opening. On close, return to it if connected; if the popup/command row unmounted, return to its stable visible owner button. Do not reopen the command palette or steal focus after programmatic/background close.
- At compact widths, make the modal content a bounded vertical scroll container or size its panels with viewport-relative constraints. The action must be fully reachable by scrolling inside the modal; the canvas/body remains locked. Preserve the 40 px action height and current theme/z-index tokens.
- Use the preview-consistency `canInsertCurrentResult` state to expose `disabled` and shortcut hint availability. Interface code does not duplicate request tokens or parser logic.

## Alternatives Considered

- Add only `aria-label` to `DialogContent`.
  - Rejected because the visible dialog title and accessible name could drift; the existing heading primitive provides a single source.
- Treat placeholder as the input label.
  - Rejected because it disappears during editing and production already shows a separate visible syntax label with no relationship.
- Put `aria-live` on the entire preview/dialog.
  - Rejected because previews and parse errors can be large and would create noisy or sensitive announcements.
- Unlock body scroll on compact screens.
  - Rejected because it exposes background canvas movement and breaks the modal boundary. Scroll should be owned by the modal content.
- Shrink the preview until everything fits without scroll.
  - Rejected as the sole strategy because short landscape heights and large error text still need a robust reachability path.
- Return focus to `body` when the original command row unmounts.
  - Rejected because the production run already demonstrates no named active control after close.

## Risks / Trade-offs

- Adding a visible heading changes vertical space.
  - Reuse the current hierarchy and compact scroll budget; capture same-state screenshots before/after at all target viewports.
- Multiple entry families have different lifetimes.
  - Test creation-toolbar persistent buttons, more-tools ephemeral rows and command-palette ephemeral rows independently. F-31 remains owner of the palette shell itself.
- Shared panel/input/output components may be used by AI generation tabs.
  - Scope new props/styles to the F-30 conversion composition or prove every caller. Do not silently alter unrelated generation-dialog semantics.
- Error messages from Mermaid can be long.
  - Keep word-breaking and internal error scrolling; verify the action remains reachable and the live announcement occurs once per current error.

## Verification

- Semantics: one named dialog; visible heading/name equality; description association; syntax label/input association; one narrow live error; no full-preview/input announcement.
- Focus: opener activation → textarea; Tab/Shift+Tab containment; Escape and close action; return for each entry family and fallback; no focus return on background/programmatic close that would steal focus.
- State: loading/pending/success/error/empty and recovery; disabled/action hint matches current-result eligibility; no insertion during interface-only checks.
- Responsive: 320×568, 375×667, 390×844, 640×360, tablet and 1280×720. Record viewport, dialog/client/scroll heights, action rectangle, body overflow, touch reachability and screenshots. At compact sizes the full action is reachable within the modal and body stays locked.
- Visual: zh/en, light/dark, long error, long translated text, 100%/high-DPI and reduced motion. Reuse theme/z-index variables and compare same data/state.
- Run focused tests, Drawnix typecheck/lint comparison, full typecheck/test comparison, cycles, production build, size/startup and relevant smoke/feature/visual/responsive suites.

## Migration and Rollback

No migration, cache invalidation, persisted preference or user-data cleanup is required. Rollback removes the F-30 headings/relationships/focus owner/compact overflow styles and tests together.

