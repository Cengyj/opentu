# F-25 Frame/PPT Editing, Slideshow, And Export Diagnostics

## Feature Loop

**Feature / user scenario**: a user creates or generates Frame-based PPT pages, opens the project-drawer PPT editor, searches/selects/renames/duplicates/inserts/deletes/reorders pages, edits outline prompts, submits selected slide images serially or with bounded parallelism, switches generated/history/library images, previews the deck with transitions and annotation tools, then exports the complete deck and later recovers the board.

**Scope**: keyboard/pointer Frame creation; `AddFrameDialog`; Frame metadata and page order; project drawer slide/outline modes; slide image task submission and automatic replacement; slideshow viewport/fullscreen/tool state; image-first PPTX export, transitions and media fallback; board save to IndexedDB; current tests, synthetic PPTX render, desktop UI, accessibility tree, responsive evidence and baseline performance.

**Out of scope**: provider output quality or paid generation (F-08/F-09/F-10); generic canvas element editing (F-05/F-06); project/board lifecycle and backup/GitHub semantics (F-02/F-03); comic tool PPTX/PDF export (F-16); outer project-drawer shell accessibility (F-15/F-28); adding PDF export to this editor or any new product feature.

**Specifications / archived changes**:

- `openspec/specs/ppt-editing/spec.md` owns image-first generation, deck-order editing, regeneration, slideshow transitions and PPTX transitions.
- `openspec/specs/ppt-outline-generation/spec.md` owns outline-first creation, serial reference chaining, and maximum five parallel slide tasks.
- Archived `refactor-ppt-image-first-editing/tasks.md:1.10` explicitly requires complete PPT export in Frame order.
- Archived `update-ppt-outline-generation-flow` matches the current outline-first MCP path.

No active change directly owned F-25 before this loop. `add-comic-strip-generator` owns a separate tool export path; `add-image-3d-rotation-control` explicitly keeps PPT export on the original rectangular-image fallback.

**Approval-only changes created in this loop**:

- `report-ppt-export-content-loss`: 1 requirement / 3 scenarios / 4 of 14 tasks complete.
- `improve-ppt-editor-accessibility`: 2 requirements / 5 scenarios / 4 of 14.
- `localize-ppt-editor-workflow`: 2 requirements / 4 scenarios / 3 of 14.

All three strict validations exited 127 because the OpenSpec CLI is unavailable. Manual audit confirmed proposal/design/tasks/delta presence, one `ADDED` operation per delta, at least one fourth-level Scenario per requirement, and five unique requirement names. Runtime implementation remains blocked pending approval.

## Forward Call Chains

### Create, edit, reorder, save, and restore

1. `with-hotkey.ts:390-394` switches to the Frame pointer on `F`; `with-frame.ts:844-959` turns pointer input into a Frame. The PPT toolbar opens `AddFrameDialog.tsx:145-229`, whose preset/custom action calls `FrameTransforms.insertFrame`, selects/focuses it, and invokes `FramePanel.handleFrameAdded`.
2. `FramePanel.tsx:2210-2247` assigns the new page index, shared style, common prompt, whole-slide prompt and placeholder status. Generated outlines enter through `mcp/tools/ppt-generation.ts`: they create placeholder Frames, write `pptMeta`, and open outline mode without submitting image tasks.
3. The project drawer is opened by `drawnix.tsx:456-490`; selected Frame state can auto-open the PPT editor at `drawnix.tsx:817-844`; `ProjectDrawer.tsx:1633-1667,1763-1790` mounts `FramePanel`.
4. Page-card drag goes through `useDragSort` → `FramePanel.reorderFrames :1823-1852` → `FrameTransforms.reorderPPTFrames :580-597`. The transform moves only root Frame nodes at their existing slots, then, for a complete PPT deck, renumbers `pptMeta.pageIndex` and default page names. Bound non-Frame elements remain in the board and custom names remain unchanged.
5. Rename/duplicate/insert/delete and layout actions use Frame transforms plus `setFramePPTMeta`; slide/outline lists derive `FrameInfo` from the board at `FramePanel.tsx:1287-1384`. Search and selection are React state; Frame content, names, geometry and PPT metadata are board state.
6. Every board operation reaches `drawnix.tsx:1588-1600` → `apps/web/src/app/app.tsx:721-769` → `WorkspaceService.saveCurrentBoard :983-990` → `workspace-storage-service.ts:376-380` → the serialized localForage/IndexedDB write queue. Board switching/restoration is owned by F-02/F-03; F-25 consumes the restored board without a separate PPT store or migration.

### Outline generation and slide-image replacement

1. Outline mode reads ordered root Frames with `getOrderedPPTFrameInfos :630-653,1381-1384`; page prompt edits and shared style stay in `pptMeta`.
2. `FramePanel.tsx:3087-3138` validates the selected page/model/prompt and calls `createImageTask` with `pptSlideImage`, `targetFrameId`, optional `pptReplaceElementId`, page dimensions and reference images.
3. The normal task queue/media executor/provider route owns network execution, cancellation, retry, terminal storage and events. Serial mode awaits one page at a time and uses the previous successful page image; parallel mode schedules at most five in flight without reference images, matching `ppt-outline-generation`.
4. `useAutoInsertToCanvas.ts` consumes terminal task metadata, inserts/fits the image to the target Frame, calls `replacePPTSlideImage`, updates current/history metadata and leaves the old primary image intact on failure/cancellation.
5. `FramePanel` recomputes previews/status from the board/task projection. Refresh recovers saved board metadata and task history through F-03/F-10 boundaries; provider success was not exercised without credentials.

### Slideshow

1. The PPT toolbar sets `slideshowVisible`; `FrameSlideshow.tsx:89-97` collects Frames in board traversal order and selects the requested/first page.
2. Entering slideshow saves viewport/pointer, adds the slideshow class, fits the current Frame, requests fullscreen and recalculates after fullscreen/resize (`:365-501`).
3. Keyboard/pointer navigation, transition metadata and reduced-motion handling update the current page. Select mode preserves media controls; pen/eraser/laser use existing board drawing state (`:502-711`).
4. Exit/fullscreen loss removes the class, restores viewport/pointer and calls the parent close. The current page/tool/overlay visibility is memory-only and does not persist.

### Full-deck PPTX export

1. `FramePanel.handleExportAllPPT :3494-3547` guards duplicate activation, derives the file name, records start analytics, and calls `exportAllPPTFrames`.
2. `ppt-export-service.ts:1900-1907` collects all Frames; `exportFramesToPPT :1853-1904` sorts pages, partitions bound/intersecting elements, creates `pptxgenjs`, and calls `addFrameSlide` for each page.
3. `sortFramesForPPT :1305-1328` currently prefers valid `pptMeta.pageIndex`; geometry is the fallback. `partitionElementsByExportFrames` assigns explicit `frameId` first and otherwise chooses maximum intersection.
4. `addFrameSlide :1461-1849` maps background, image/media, geometry/text, arrows, freehand, pen paths and mind elements. Media can embed or use the existing visible fallback; image conversion uses `ensureBase64Image`.
5. The exporter writes directly when no transitions exist, or writes a Blob, injects per-slide OOXML transitions with JSZip and downloads the result. Promise resolution produces success analytics/message; rejection produces failure analytics/message.

## Reverse Trace, Data, State, And Boundaries

- Final slide-card order and slideshow order are written only by root Frame node operations. Final outline/export order can additionally be influenced by `pptMeta.pageIndex`; page creation, insert/delete renumbering and the unified reorder transform are its writers.
- Final primary image is written by task auto-insertion, regeneration, history selection, media-library replacement and direct canvas edits recognized by the PPT association helper. All use Frame ID/image element ID metadata; no separate image binary is stored in `pptMeta`.
- Final PPTX download has one writer, `ppt-export-service`; callers are the full-deck panel action and direct service consumers/tests. Export reads but does not mutate board/task/cache data.
- User cancellation exists for slide-generation flow and fullscreen; export has a repeated-click guard but no AbortSignal. Export retry is reactivation after the promise settles. No automatic export resume/history exists.
- Cache/network keys and image URL invalidation belong to unified media/cache services. The exporter resolves the current URL at export time; successful cached/data URL behavior was tested synthetically, while real remote/offline provider behavior remains unverified.
- Analytics records action/status/page count/duration and normalized error name. The export proposal forbids URLs, prompts, credentials, provider payloads and task IDs in new outcome diagnostics.
- Existing unit coverage spans outline prompts, mindmap conversion/generation, layout, transitions, media fit, image insertion/history, frame preview, export media and MCP generation. There is no permanent `FramePanel`/`FrameSlideshow` accessibility or full browser flow test.

## Confirmed Issues

### [F25-ORDER-001]

**Status**: 已证实并修复. **Evidence strength**: archived specification/task, deterministic red/green test, and current forward/reverse source trace.

**User impact / reproduction**: create three PPT Frames with page indices 1/2/3, drag page 3 before page 1, then compare the thumbnail/slideshow order with outline/export. Before the fix the receive order was page-index values `[3,1,2]` when `[1,2,3]` was required: board order changed, but metadata did not. Slideshow followed the new node order while outline and export re-sorted by stale `pageIndex`.

**Current vs expected**: current pre-fix behavior exposed two contradictory deck orders after one accepted drag. The existing specification requires the panel to manage pages in deck order and archived task 1.10 requires complete export in Frame order. Expected is one canonical order across page cards, slideshow, outline and PPTX.

**Call chain / root cause**: page-card drop → previous `FramePanel.reorderFrames` root remove/insert → `board.children` changes → slideshow `FrameSlideshow.tsx:89-97`; meanwhile outline `FramePanel.tsx:630-653` and export `ppt-export-service.ts:1305-1328` read unchanged `pptMeta.pageIndex`. The root cause was split ownership: the drag path updated only one of two persisted order representations.

**Fix / alternatives / risk**: `FrameTransforms.reorderPPTFrames :580-597` now owns root reorder plus metadata/default-name renumbering for complete PPT decks, and `FramePanel :1823-1852` calls it. It preserves bound images, custom names and generic Frame collections without PPT metadata. Updating exporter alone was rejected because outline and other page-index consumers would remain divergent; removing `pageIndex` everywhere would be a wider storage/architecture change. Risk is extra metadata operations; the permanent history test proves a single Undo restores both node and metadata order.

**Validation / rollback**: pre-fix focused test was 1 failed/1 passed; post-fix final file is 3/3. The 11-file PPT set executes 84/84 assertions; one unrelated MCP suite fails collection on an existing settings mock. Synthetic two-page export renders in the intended order with correct transitions. Rollback reverts the panel call and transform/test together; board schema/data need no migration, but the order defect returns.

### [F25-EXPORT-001]

**Status**: 已证实，等待 `report-ppt-export-content-loss` approval. **Evidence strength**: deterministic synthetic failure diagnostic plus current source.

**User impact / reproduction**: export an image-first Frame whose current primary image URL returns HTTP 404. The public export resolves, `slide.addImage` is never called, `pptx.writeFile` is called, and the panel reports the original page count as successfully exported. The downloaded page lacks the complete generated image that contains its text/layout/background/design.

**Current vs expected**: current behavior equates “slide object created” with “required page content embedded.” Expected proposed behavior is no download/full-success when a required primary image cannot embed, and explicit partial success for tolerated legacy decorative omissions.

**Call chain / root cause**: toolbar → `handleExportAllPPT :3494-3547` → exporter → `addFrameSlide :1461-1849`; the image catch at `:1516-1519` discards failure, the outer catch at `:1843-1845` discards other element failures, and the function always returns true. `exportFramesToPPT` therefore writes and resolves. Root cause is a boolean result that cannot distinguish slide creation from content fidelity.

**Candidate / alternative / risk**: the approval proposal introduces typed required-failure versus non-critical-omission results, rejects before file write/download for missing primary images, aggregates safe partial warnings, and keeps all source data retryable. Blocking every legacy decorative error was rejected as too brittle; continuing silent success preserves data-loss deception. Risk is stricter failure on transient remote reads; cached/data URL and retry tests are required.

**Validation / rollback**: approval-stage red tests will assert no `writeFile`/download, safe page reference, unchanged board, partial warning and privacy-safe analytics, then render successful/partial synthetic decks. Rollback restores the void result/caller messages; no migration/cache cleanup.

### [F25-A11Y-001]

**Status**: 已证实，等待 `improve-ppt-editor-accessibility`. **Evidence strength**: live Chromium DOM/accessibility inspection plus source.

**User impact / reproduction**: open the empty PPT editor and inspect/tab its toolbar; view-switch and add icon controls have empty names. Open custom-size dialog: width/height are both exposed by the same generic input name because visual W/H spans are not associated. In slideshow, tool, color, style, width and navigation buttons lack names/selected-state semantics; inactivity opacity can hide a focused control.

**Current vs expected**: sighted pointer users can infer icons/HoverTips, while screen-reader/keyboard users cannot identify distinct actions or current tool. Expected is localized explicit names, programmatic selection state, distinct dimension labels and visible focused slideshow controls without changing existing actions/geometry.

**Call chain / root cause**: PPT state → `FramePanel.tsx:3583-3680`, `AddFrameDialog.tsx:185-229`, `FrameSlideshow.tsx:788-939` → TDesign/native buttons and inputs → accessibility tree. `HoverTip`, SVG icons, `title` and adjacent spans are not authoritative names; opacity is independent of focus ownership.

**Candidate / risk / validation / rollback**: the proposal adds names to actual controls, `aria-pressed`/labeled option groups, width/height associations and focus-overrides-inactivity. It excludes prompt/media/provider/private values. Test names/states/Tab/Enter/Space/Escape/fullscreen/timer in zh/en and same-state geometry. Rollback removes semantics/focus override/tests only.

### [F25-I18N-001]

**Status**: 已证实（静态控制流），等待 `localize-ppt-editor-workflow`; English runtime screenshot remains blocked. **Evidence strength**: direct literal branches independent of the active language owner.

**User impact / reproduction**: set interface language to English and render the PPT panel, add dialog or slideshow. `FramePanel` reads `language` at `:1081`, but search/tooltips/status/confirmations/empty states across `:1760-1800,1883-1942,3498-4170` remain Chinese. `AddFrameDialog :145-234` and `FrameSlideshow :760-939` have no language input/context and render Chinese literals.

**Current vs expected**: English mode cannot produce an internally coherent existing PPT workflow. Expected proposal behavior localizes system copy and new default names while preserving all existing stored/custom names and user/provider content.

**Candidate / risk / validation / rollback**: reuse existing Drawnix i18n; never store translation keys; recognize both default-name forms; do not translate prompts, provider/model labels, raw payloads, URLs or filenames. Long English copy may overflow the narrow drawer, so same-state responsive measurements are required. Rollback restores inline copy/default generation; no migration.

## Non-Issue, Hypotheses, And Blockers

### [F25-HISTORY-002]

**Status**: 非问题 after validation. Source inspection showed reorder plus renumber emits multiple operations and Plait's generic `shouldMerge` only explicitly merges viewport operations, so one-Undo behavior was a legitimate hypothesis. A permanent `withHistory` test calls reorder and one `board.undo()`; original node order and `[1,2,3]` metadata both restore. The test passes without production batching, so no `withNewBatch` change was made.

### [F25-PERF-003]

**Status**: no demonstrated bottleneck. Warm project-drawer switch from canvas management to PPT editing, waiting for the search field, produced five samples `[316,317,313,319,314]` ms: median 316, range 313–319. Environment was in-app Chromium, 1280×720/DPR1, light/zh, normal host network/CPU, warm app/board; values include browser driver/poll/render overhead. There is no cold or before/after sample and no production performance optimization, so no “faster” conclusion is authorized.

### [F25-RESPONSIVE-004]

**Status**: unknown/environment blocked. A requested 390×844 browser state produced an actual 390×219 capture, saved as `responsive-override-observed-390x219.png`; it cannot prove mobile layout. Formal smoke, feature, visual and responsive Playwright all fail before page execution because `chromium_headless_shell-1200` is absent. No browser install was attempted. Dark, English runtime, tablet/mobile, zoom/high-DPI, touch, offline and reduced-motion matrices remain unverified.

### [F25-PROVIDER-005]

**Status**: external-credential blocked. Serial previous-image reference, parallel provider execution, cancellation and terminal image insertion have static/unit coverage, but no authorized provider credential/paid call was available. Synthetic/local data verified service contracts only; no provider latency/quality/success conclusion is made.

## Synthetic PPTX And Visual Evidence

- `synthetic-ppt-export.pptx`: 54,775 bytes, generated through the real production `exportFramesToPPT` path from two local image-first Frames; no provider/network/credential.
- `rendered/slide-1.png` and `slide-2.png`: 1600×900. Presentation tooling rendered both pages; manual inspection found no clipping, missing image or order reversal.
- `slides_test.py`: exit 0, “No overflow detected.”
- OOXML inspection: slide 1 contains `<p:fade/>`; slide 2 contains `<p:push dir="l"/>`; both SVG/PNG fallback media pairs are packaged.
- `empty-ppt-editor-desktop-1280x720.png`: current light/zh desktop empty state. The already-open music-player window overlaps the drawer; it is context, not F-25 visual improvement evidence.
- No production CSS was changed, so there is no before/after visual-improvement claim. The 390×219 capture is explicitly a viewport override blocker, not a mobile pass.

## Commands And Baseline Classification

- Focused page-order final: exit 0, 1 file / 3 tests passed.
- PPT/Frame 11-file set: exit 1; 10 files passed, 1 MCP suite collection failed; 84/84 executed tests passed. Collection failure is the existing `settings-manager` mock missing `LEGACY_DEFAULT_PROVIDER_PROFILE_ID`.
- Targeted ESLint for the two changed production files and one new test: exit 0; 27 warnings, 0 errors. Warnings are existing `any`/hook warnings plus test fixture casts; no error.
- Drawnix typecheck: exit 0. Full `pnpm typecheck`: exit 0, 5/5 projects. `pnpm check:cycles`: exit 0, no static runtime cycle.
- Final full Drawnix tests: exit 1; 188 files = 183 pass / 4 fail / 1 skip; 1164 tests = 1160 pass / 3 fail / 1 skip. Failures are cached-image data URL, GPT Blob test environment, Sora duration and PPT settings mock collection, all present before F-25; the added 3 tests pass.
- Utils: exit 0, 25/25 files and 471/471 tests. React-board in the root run: exit 0, 1/1 file and 8/8 tests.
- `pnpm build:web`: exit 0; app 7,931 modules, 1m51s; SW 54 modules, 1.89s. Existing Sass/CSS, mixed static/dynamic import and large-chunk warnings remain.
- `pnpm size`: exit 1. AI Chat is 844.43 kB gzip vs 140 kB; Diagram 934.93/950, Office 269.19/300, Editor 858.24/870 and Media Viewer 12.19/20 kB. F-25 did not claim or cause a measured bundle improvement.
- `pnpm verify:startup`: exit 0; startup CSS/app/runtime/index are 14,208/3,776/1,867/345 bytes, all under 512,000; no chunk cycles.
- `pnpm lint`: exit 1 with existing broad source/module-boundary warnings/errors; the command remains unsuitable as a clean F-25 signal. The targeted F-25 command above is the scoped regression evidence.
- Playwright smoke: 2/2 environment failures; one feature, one visual and one responsive case likewise fail before page execution on the same missing executable. Incorrect first feature/visual invocations with an extra `--` produced “No tests found” and were rerun correctly; they are tool invocation noise, not product evidence.
- OpenSpec strict validation: three commands, each exit 127; CLI unavailable. Git metadata is absent, so worktree cleanliness/history cannot be verified.

## Exit Review And Rollback

- Boundary, forward/reverse chains, data/state/side effects, error/cancel/retry/refresh/offline limits and current tests are documented.
- F25-ORDER-001 is fixed and independently reversible; all added order/history tests pass, typecheck/cycles/build/startup show no regression.
- F25-EXPORT-001, F25-A11Y-001 and F25-I18N-001 require three independent approvals before runtime implementation. Formal responsive/browser/provider matrices have explicit environmental blockers.
- No performance or visual improvement is claimed. Successful synthetic PPTX output is verified, while missing-primary failure remains deliberately unimplemented pending approval.
- Rollback the implemented fix by reverting `FramePanel` to its prior root reorder, removing `FrameTransforms.reorderPPTFrames` and `with-frame-order.test.ts`. No board/cache/task migration or user-data recovery is needed, but stale order divergence returns.
- Rollback the investigation-only artifacts by deleting the three new change directories and this evidence/ledger entry. They have no runtime or persisted-data effect.
- F-25 is **investigation complete, partially verified, not at feature exit**: one confirmed order defect is resolved; three confirmed user-observable changes await approval; responsive/dark/English/provider/full E2E remain blocked or unknown.
