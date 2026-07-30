# Change: Fix mobile toolbar and AI-input overlap

## Why

At each current mobile responsive viewport, the collapsed unified toolbar geometrically intersects the primary canvas AI input and is stacked above it. At 375×667, the current rectangles intersect by 38×8 = 304 CSS px²; the existing `<100` regression assertion now reaches this behavior and fails after an unrelated locator drift was repaired.

Changing mobile layout is user-observable and requires approval before implementation.

## What Changes

- Keep the existing collapsed and expanded unified toolbar clear of the primary AI input's interactive/content region at mobile widths.
- Make the toolbar's lower clearance follow the existing responsive AI-input geometry and safe-area contract instead of a fixed offset that is smaller than the observed compact input height plus bottom inset.
- Preserve toolbar scrolling and action reachability on short mobile landscapes.
- Preserve primary-input width, input/submission behavior, toolbar actions, desktop/tablet geometry, z-index ownership, themes, and persisted state.
- Add focused mobile geometry, orientation, safe-area, hit-testing, and visual regression coverage without relaxing the current overlap assertion.

## Impact

- Affected specs: `responsive-canvas-shell` (new delta)
- Affected code: unified-toolbar responsive styles and focused responsive Playwright coverage; a shared existing spacing token/helper only if needed to avoid duplicating current input geometry
- Related changes: AI-input accessibility owns control names; canvas-navigation accessibility owns navigation controls; settings-toolbar accessibility owns toolbar keyboard semantics; UI color-system owns palette; none owns this geometry
- Data/API impact: none; no component API, storage, cache, task, model, Service Worker, or migration change
- Rollback: restore the scoped mobile layout rules and focused tests/screenshots; user data remains compatible

## Evidence

- Current 375×667 geometry: toolbar `x=8,y=457,w=38,h=130,bottom=587,z=4031`; primary input `x=8,y=579,w=359,h=82,bottom=661,z=100`; intersection 304 CSS px².
- The same collision is 456 CSS px² at 640×360 and 304 CSS px² at 360×640; four desktop/tablet viewports are zero-overlap negative controls.
- `index.scss:373-377` places the mobile toolbar at `safe-area + 80px`; `ai-input-bar.scss:1639-1650,1777-1787` places a full-width compact input at `safe-area + 8px/6px` with an observed 82–84px surface.
- Focused responsive suite after locator repair: 10/11 pass; the only remaining failure is the unmodified `<100` geometry assertion receiving 304.
- Screenshot and full chain: `docs/evidence/f28-responsive-accessibility/diagnostics.md`.
- Supplemental 390×844 attachment-preview evidence: after two synthetic pasted images, the primary input was `x=8,y=416.44,w=374,h=421.56` and its first preview was `x=26,y=652,w=36,h=36`; the screenshot shows the higher collapsed toolbar covering the preview's left side. That run did not separately read the toolbar rectangle, so no new intersection area is claimed. The state confirms the proposal's existing attachment-preview scope rather than creating another layout owner.

## Approval

Implementation is blocked until the user approves the mobile visual-layout change and its short-landscape/safe-area invariants.
