## Context

The unified toolbar and primary AI input are independent fixed-position surfaces. At widths up to 640px, the toolbar uses a fixed `safe-area + 80px` lower offset while the input is full width, begins at the same left inset, and has a state-dependent height. The compact 375×667 input is 82px high above a 6px bottom offset, so the toolbar ending 80px above the viewport intersects it by 8px. The toolbar's higher z-index converts the intersection into visible input occlusion.

## Goals / Non-Goals

- Goals: no toolbar/input interactive-content occlusion in existing mobile states; safe-area-aware placement; collapsed/expanded and short-landscape action reachability; stable desktop/tablet behavior; deterministic responsive tests.
- Non-Goals: redesign either surface, move the input away from full-width mobile layout, change toolbar actions/collapse policy, alter AI submission/model state, change global z-index layers, add navigation, or claim a performance improvement.

## Decisions

- Establish one scoped mobile lower-clearance contract based on the existing AI-input responsive surface plus safe-area and separation spacing. Prefer an existing Sass/CSS token; if none represents the geometry, add one narrowly named shared custom property/token used by these two owners rather than copying a new magic number.
- Apply the clearance only at current mobile breakpoints. Do not change desktop or tablet rules that produced zero-overlap controls.
- Keep the primary input's current mobile width, centering, bottom insets, and state-driven height. Move/constrain the smaller toolbar surface because shifting the full-width input would reduce the current composing area.
- Retain toolbar z-index. Stacking changes would only swap which control is hidden and would not solve hit-area collision.
- On short viewports, reduce the toolbar's available/max height and preserve its existing internal scrolling rather than placing its bottom action area over the input.
- Preserve safe-area terms independently so an inset does not get counted twice. Verify using emulated non-zero insets and orientation changes before accepting the implementation.
- Keep the existing `<100` assertion while adding explicit intersection dimensions and hit-testing for both surfaces. Do not update screenshots until the intentional layout is approved and visually reviewed.

## Alternatives considered

- Lower the toolbar z-index: rejected because input content would instead cover toolbar actions.
- Move or narrow the primary input: rejected because it changes the existing full-width mobile composition layout and reduces usable text/control space.
- Hard-code a larger toolbar bottom value: rejected as the final design because focused/expanded/long-text input height and short landscape must be accounted for; a constant proven only for one compact state would preserve the root mismatch.
- Accept the overlap by increasing the test threshold: rejected because browser geometry and screenshot show real occlusion.

## Invariants

- Existing toolbar actions, ordering, collapse/expand state, internal scroll, touch targets, drag behavior outside mobile, and z-index remain unchanged.
- Existing AI-input full-width mobile layout, model/type controls, textarea behavior, attachments, submit/cancel behavior, prompt expansion, and safe-area bottom behavior remain unchanged.
- Desktop 1920×1080/1280×720 and tablet 1024×768/768×1024 geometry and screenshots remain unchanged within existing tolerances.
- No component API, persisted key/schema, board data, task/workflow state, media cache, provider route, analytics event, or Service Worker boundary changes.

## Risks / Trade-offs

- Reserving more lower clearance reduces toolbar vertical space on 640×360; an incorrect max-height calculation could hide actions or create a second overlap at the top.
- A supplemental 390×844 attachment-preview screenshot confirms that the same toolbar covers the first visible preview when the input expands. Focused/long-text heights remain unmeasured. The implementation must define which visible surface boundary is protected and verify all existing states instead of tuning only the initial screenshot.
- CSS environment safe-area behavior differs between desktop emulation and physical devices. Emulation is necessary but a real-device check remains an explicit residual verification item if hardware is unavailable.
- A shared custom property can drift if only one owner updates it. Focused tests must cover both writers and state changes.

## Verification and rollback

- Before implementation, add focused failing tests for 640×360, 375×667, and 360×640 that report rectangles/intersection and confirm topmost hit target at boundary points.
- After implementation, cover collapsed/expanded toolbar; compact/focused/expanded/attachment/long-text input; orientation transition; zero and non-zero safe-area; Chinese/English; light/dark; pointer/touch; 100% zoom and high-DPI emulation.
- Capture same-data, same-theme before/after screenshots and record exact geometry for all seven existing viewports.
- Run focused lint/TypeScript/Playwright, then repository typecheck/tests/cycles/build/size/startup and available smoke/feature/visual/responsive E2E against baseline.
- Roll back only the scoped responsive rule/token and focused tests/snapshot updates.
