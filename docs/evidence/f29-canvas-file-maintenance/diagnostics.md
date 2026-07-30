# F-29 canvas file import/export and maintenance diagnostics

Date: 2026-07-30 (Asia/Shanghai)

## Feature start contract

**User scenario**: a user opens or saves a `.drawnix` file, exports the selected elements or board as PNG/JPG, explicitly clears the board, or asks the app to remove invalid canvas media, then receives truthful completion/failure/partial feedback and can undo/retry/reload where the existing behavior supports it.

**Scope**: application-menu entries, save/export hotkeys, command targets, file picker normalization, JSON validation/serialization, embedded-media cache collection/restoration, image rasterization/download, clear confirmation, invalid-media scan, Plait history and App workspace persistence. **Out of scope**: workspace backup/GitHub sync (F-03), media rendering/editor/cache production (F-06/F-13), command-panel shell (F-31), new file preview/repair/retry products, provider requests and real user files/storage.

**Specs and gate**: no formal spec owned this complete intent. Four independent approval-only changes now own confirmed corrections: `prevent-network-failure-media-cleanup`, `stabilize-drawnix-file-export-snapshot`, `improve-drawnix-file-transfer-feedback`, and `improve-canvas-clear-confirmation-interface`. They contain 13 requirements, 42 scenarios and 71 tasks, with 13 evidence tasks complete. Each capability has one active owner and all 13 requirement names are unique. OpenSpec CLI remains unavailable (strict attempt exits 127), so validation is manual only. No runtime/test/CSS/i18n/file-format code was changed.

**Acceptance after approval**: only confirmed-invalid media is deleted by current identity/path; unknown network results are preserved; one file save is one point-in-time snapshot; complete/partial/cancelled/failed outcomes are consumed once and localized; clear confirmation returns focus to a connected same-root workflow owner/fallback and its compact actions are at least 44×44 CSS px; cancellation/failure does not mutate the board; confirmed deletion/import continues through current history/autosave; no schema/migration/cache purge; focused and broad gates compare against baseline; browser evidence covers desktop/compact, zh/en, keyboard/pointer, undo/reload and partial/error states.

## Complete current call chains

1. **Save `.drawnix`**: app menu `app-toolbar.tsx:89-90` / mod+S `with-hotkey.ts:168-176` / command registry `:356-372` → `saveAsJSON` `data/json.ts:15-37` → `serializeAsJSONAsync :75-87` → recursive virtual URL extraction and sequential `unifiedCacheService` reads `embedded-media.ts:28-139` → JSON version 1 → `fileSave` `filesystem.ts:94-119` → browser-fs native/fallback download. Abort becomes `{fileHandle:null}`; other rejection reaches callers, which currently do not consume it.
2. **Open `.drawnix`**: menu `app-menu-items.tsx:56-95` → `loadFromJSON` `json.ts:39-54` → browser `fileOpen`/normalize → `loadFromBlob` `blob.ts:11-25` → JSON parse → `isValidDrawnixData` checks type/elements/viewport → `restoreEmbeddedMedia` per item → fulfil-only menu callback → direct `board.children`/history/selection/viewport/theme assignment → `listRender.update` → `BoardTransforms.fitViewport`. The fit emits a viewport operation, React Board after-change `wrapper.tsx:87-97,191-193` sends the imported children to App, then `app.tsx:721-769` → `WorkspaceService.saveCurrentBoard :983-989` → storage/`boardUpdated`/tab sync/close-snapshot tracking.
3. **Export image**: menu PNG/JPG `app-menu-items.tsx:98-145`, mod+Shift+E, or command `:356-364` → `saveAsImage` `utils/image.ts:67-86` → selected elements if non-empty, else whole board → `boardToImage`/`safeToImage` `utils/common.ts:143-276` → current scoped fetch fallback → Plait `toImage` at ratio 4/padding 20 and transparent/white fill → base64 Blob → `download`. Rejection shows one fixed Chinese message.
4. **Clear board**: menu `app-menu-items.tsx:147-168`, hotkey `with-hotkey.ts:178-186`, or command `command-registry.ts:383-390` sets only `appState.openCleanConfirm` → always-mounted `CleanConfirm` `clean-confirm.tsx:6-30` passes no invocation/reference owner → shared `ConfirmDialog` actions `ConfirmDialog.tsx:149-188` and `FloatingFocusManager` `dialog.tsx:137-162` → cancel/Escape closes without board mutation but has no stable reference to restore; explicit Confirm → `board.deleteFragment(board.children)` → frame-related deletion wrapper `with-frame.ts:688-710` → core path refs/remove operations → history batch/after-change → workspace persistence.
5. **Clean invalid media**: menu `app-toolbar.tsx:93` → local `isScanning` → scan root image/video `url` fields `app-menu-items.tsx:373-401` → unbounded `Promise.all` of `checkUrlValidity :330-368` → boolean false array with scan-time indices → reverse-index `Transforms.removeNode :424-429` → history/after-change/persistence → success message. There is no timeout/AbortController/cancel UI; this is recorded as a hypothesis boundary until timing requirements are established.

**Types/state/side effects**: board owns elements/history/selection/viewport/theme; App owns durable workspace projection; `isScanning` owns one mounted cleanup run; browser owns file UI/download; unified cache owns virtual media Blob/metadata. File schema is `type:'drawnix'`, numeric version, `source:'web'`, elements, viewport and optional base64 media. File operations produce filesystem/cache/board side effects; menu actions carry existing `data-track` attributes but no result analytics was found. Diagnostics must not expose real URLs/files/credentials.

## Confirmed issues

### [CANVAS-FILE-CLEANUP-001]

**Status**: confirmed; implementation blocked by `prevent-network-failure-media-cleanup` approval. **User impact/current vs expected**: offline/transient/CORS/DNS failure is reported as a successfully cleaned invalid medium and the element is durably removed. An unknown reachability result must preserve content and be reported separately from confirmed invalidity.

**Reproduction/evidence**: synthetic remote image; both fetches rejected with `TypeError('synthetic network unavailable')`. Raw result: methods `['HEAD','GET']`, removals `1`, remaining children `0`, success `Cleaned 1 invalid media`, error messages `0`. Exit 0, 1/1 file/test, 72 ms, 1.66 s report. Source sink is `app-menu-items.tsx:330-365,403-435`; i18n explicitly calls the result invalid at `i18n.tsx:282-286,471-475`.

**Root/call chain**: cleanup entry → boolean probe → both rejection catches → `false` → `invalidElements` → `Transforms.removeNode` → Plait after-change/history → App save/IndexedDB/tab sync. The boolean contract erases “unknown”.

**Candidate/alternative/risk**: preferred tri-state valid/invalid/unknown with bounded fallback, only readable terminal absence deletion and aggregate unknown feedback. Treat-all-failure-as-invalid is the proven root; retry/backoff alone cannot resolve offline/CORS and is rejected. Risk is retaining actually missing media when proof is unavailable; manual rerun after recovery is preserved.

**Validation/rollback**: classifier/component/board/App tests for response matrix, mixed results, undo/autosave and no URL exposure; browser online/404/offline/undo/reload. Roll back classifier/feedback/tests only; no data migration/cache purge, but the misdeletion risk returns.

### [CANVAS-FILE-CLEANUP-002]

**Status**: confirmed; same approval owner. **User impact/current vs expected**: a concurrent insertion that shifts indices can cause cleanup to delete an unrelated new element while retaining the scanned invalid image. Cleanup must resolve the current target identity/path at mutation time.

**Reproduction/evidence**: start with `['target-image','existing-shape']`; hold HEAD pending; insert `concurrent-new-shape` at index 0; resolve readable 404. Raw result: one removal at `[0]`; final IDs `['target-image','existing-shape']`. Exit 0, 1/1 file/test, 68 ms, 1.65 s. Source captures index at `:386-400`, awaits at `:406-413`, then deletes old index at `:424-429`.

**Root/call chain**: scan-time array index crosses an async network boundary without a path ref or stable-ID re-resolution. Preferred fix re-resolves the captured element identity immediately before reverse removals. Risk is element deletion/replacement during scan; tests cover insert/delete/reorder and must never fall back to an occupied stale index. Rollback is contained in cleanup mutation resolution.

### [DRAWNIX-EXPORT-SNAPSHOT-003]

**Status**: confirmed; implementation blocked by `stabilize-drawnix-file-export-snapshot` approval. **User impact/current vs expected**: a file saved while editing can contain a newly added virtual-media element without its embedded bytes, reducing cross-device recoverability. One file must represent one point-in-time board snapshot.

**Reproduction/evidence**: export began with media A; first cache read was deferred; media B was added; read resumed. Raw file element IDs `['first','second']`, embedded URLs only `['/__aitu_cache__/image/a.png']`, cache reads `1`. Exit 0, 1/1 file/test, 5 ms, 1.25 s. Source awaits entry-time URL collection at `json.ts:76` and reads live children/viewport later at `:82-83`.

**Root/call chain**: menu/hotkey/command → async serializer → entry-time URL set → await cache → later live board structural read → file save. Preferred fix captures a JSON-compatible elements/viewport snapshot before the first await and uses it for collection and output. Blocking editing, rescanning live state or changing file version are rejected. Main risk is extra large-board allocation; five-sample before/after measurement is required, with no speed/memory claim yet. Rollback removes snapshot helper/tests; schema remains version 1.

### [DRAWNIX-FILE-OUTCOME-004]

**Status**: confirmed; implementation blocked by `improve-drawnix-file-transfer-feedback` approval. **User impact/current vs expected**: non-cancel save/open rejection has no UI recovery signal at current entries. English image-export failure is shown in Chinese. The current command says “Save as JSON” but writes `.drawnix`. Non-cancel failure must be consumed once/localized; cancellation remains silent; copy must identify the actual file action.

**Reproduction/evidence**: controlled Promise-like diagnostic recorded save called once, returned `.then` observed 0, callback return `undefined`, error feedback 0; open called once, fulfil `.then` 1, reject `.catch` 0, callback return `undefined`, error feedback 0. Exit 0, 1/1 file and 2/2 tests, 60/8 ms, 1.64 s. Production 1280×720 command search `保存` returned only `保存为 JSON`; screenshot retained. `image.ts:82-85` contains the fixed Chinese message and no i18n key exists.

**Root/call chain/candidate**: async helper outcome is discarded at menu/hotkey/command boundaries; image utility owns fixed copy. Preferred typed outcomes plus entry-owned localized handling using React `t`/existing non-React `getTranslation`; correct label but retain command ID/shortcut/target. Catching in data with fixed copy or adding a retry product is rejected. Risk is duplicate messages and caller signature drift; enumerate every caller and test exactly once. Rollback affects transient outcomes/copy/tests only.

### [DRAWNIX-MEDIA-PARTIAL-005]

**Status**: confirmed; same file-transfer approval owner. **User impact/current vs expected**: `.drawnix` export/import can settle normally while a referenced virtual medium is absent from the file or cannot be restored. Best-effort structural transfer may remain, but the user must receive a partial count and retry signal.

**Reproduction/evidence**: export cache returned null: output retained virtual URL, `embeddedMedia` absent, warn 1, Promise fulfilled. Import cache write rejected: cache writer 1, console error 1, `loadFromBlob` still resolved equal parsed data. Exit 0, 1/1 file and 2/2 tests, 3/18 ms, 1.23 s. Source catches/continues at `embedded-media.ts:102-129,150-169` and outer helpers have no outcome channel.

**Root/candidate/risk/validation/rollback**: per-item failures are collapsed into successful-only array/void. Preferred aggregate-safe success/failure counts propagated without persisted URLs or schema changes; partial file/import continues with localized warning. Whole-operation rejection would discard recoverable structure and is rejected. Tests cover mixed media, privacy, invalid file/current-board preservation, successful restores and retry. Rollback removes result types/messages; no migration.

### [CANVAS-CLEAR-FOCUS-010]

**Status**: confirmed; implementation blocked by `improve-canvas-clear-confirmation-interface` approval. **User impact/current vs expected**: after cancelling the existing destructive confirmation, keyboard and pointer users lose their workflow position because focus lands on `BODY`. Closing must return focus to the connected invoking workflow control or a documented same-root fallback without reopening the ephemeral menu/palette.

**Reproduction/evidence**: current production `dist/apps/web`, loopback, in-app Chromium, zh-CN, DPR 1. At 1280×720, application menu → Clear Board opened one named dialog with initial focus on Cancel; Escape closed it and `document.activeElement` was `BODY`. At 390×844, the real expanded-toolbar → application-menu → Clear Board path opened the same dialog; pointer Cancel closed it and focus again became `BODY`. No Confirm action or deletion was executed. Evidence strength is high: two real entry/viewport paths plus the complete source writer/consumer chain.

**Root/call chain**: all three entries at `app-menu-items.tsx:147-168`, `with-hotkey.ts:178-186`, and `command-registry.ts:383-390` write one boolean; the always-mounted caller at `clean-confirm.tsx:6-30` supplies no `DialogTrigger`, invocation owner, or reference; `dialog.tsx:137-162` can manage focus inside the dialog but has no stable workflow reference to restore. Menu and palette rows unmount, so restoring the immediate active row alone is insufficient.

**Candidate/alternative/risk**: capture a non-persisted, same-root workflow owner/fallback per entry and coordinate palette handoff with the F-31 owner; on Cancel, Escape, outside dismissal or completed Confirm, resolve connectivity and return once. Storing a DOM node in `DrawnixState`, always focusing the global menu trigger, reopening an ephemeral surface, or globally changing all shared dialogs is rejected. Risks are disconnected owners, multiple Drawnix roots and palette rAF focus races.

**Validation/rollback**: focused entry/confirmation tests cover connected/disconnected owners, initial Cancel, containment, Escape/pointer Cancel/Confirm, exact-one close/delete and no later palette focus steal; browser matrix covers keyboard/pointer/touch and same-root fallback. Roll back only transient owner/handoff wiring and tests; no storage, schema, history or cache recovery is required, but BODY focus returns.

### [CANVAS-CLEAR-COMPACT-011]

**Status**: measured and confirmed against the repository compact touch-target contract; implementation blocked by the same approval. **User impact/current vs expected**: both existing clear-confirm actions measure 62×36 CSS px at compact viewports, so their vertical activation size is 8 px below the repository's 44 px compact convention at `styles/_responsive.scss:33`. F-29 compact/coarse-pointer actions must reach at least 44×44 without enlarging text or changing desktop density.

**Reproduction/evidence**: current production build, in-app Chromium, zh-CN, DPR 1, no throttle. At 320×568 the dialog measured 288×186.1875 and both actions 62×36; at 390×844 it measured 358×160.59375 and both actions 62×36; at 640×360 it measured 440×160.59375 and both actions 62×36. In all three samples the complete dialog remained inside the viewport and body scrolling was locked. Native action writers are `ConfirmDialog.tsx:164-185`; the F-29 caller has no scoped compact class at `clean-confirm.tsx:15-29`. Evidence strength is high for these three viewport states; real coarse-pointer hardware remains an acceptance gap.

**Candidate/alternative/risk**: use an F-29 caller opt-in/scoped class to raise only compact or primary coarse-pointer action boxes to 44×44, preserving current glyph/text size, copy, width, theme and desktop density. A global shared `ConfirmDialog` change is rejected because source search finds 30 consumer files plus the primitive and no full caller matrix. Risk is footer wrapping or extra height at 320×568/640×360.

**Validation/rollback**: add geometry assertions at 320×568, 375×667, 390×844, 640×360 and desktop; verify full containment, scroll lock, zh/en, light/dark, zoom/high-DPI and matched before/after screenshots. Roll back the F-29 scoped style/class and focused tests together; no data recovery is needed.

## Hypotheses, blockers and non-problems

- **[DRAWNIX-IMPORT-VIEW-006] pending product-semantics decision**: export stores viewport; import passes and assigns it, then always calls `fitViewport`, which overwrites it; the unused theme parameter resets theme to default because the file schema has no theme. Both “restore saved view” and “fit imported cross-device content” are plausible. Resolve intended viewport/theme behavior and test desktop/compact before any change.
- **[DRAWNIX-VALIDATION-007] hypothesis**: validation checks type/elements array/`typeof viewport === 'object'` but not version/source/element shape. No current incompatible version fixture or browser crash was reproduced. Build malicious/non-current synthetic fixtures and define forward-version policy before changing validation or migration.
- **[CANVAS-FILE-CLEANUP-PERF-008] hypothesis**: `Promise.all` has no concurrency bound/timeout/cancel. No five-run request/main-thread/latency measurement exists. Measure representative 1/10/100-media online/offline states and define timeout/cancel semantics before proposing performance work.
- **[IMAGE-EXPORT-PARTIAL-009] hypothesis**: `safeToImage` substitutes a transparent pixel for failed canvas-image fetches. The current source proves fallback activation but no same-data exported artifact comparison was captured. Render a synthetic failing image and compare pixel/content bounds before classifying user-visible content loss.
- Clear board has explicit confirmation and uses Plait removal operations/history/autosave; no contrary current evidence was found. File picker abort normalization is explicit. Selected-only image export is current source behavior, not a defect without a contrary spec. Viewport/theme/version observations remain hypotheses rather than edits.

## Current UI, tests, performance and visual evidence

- Production `dist/apps/web`, loopback, in-app Chromium, zh-CN/light appearance, DPR 1, no throttle. At 1280×720 the app menu had 13 items, initial focus `打开`; ArrowDown → `保存文件`, End → `版本`; Escape closed to 0 menu items but focus did not return to the menu trigger. Generic application-menu return remains F-26/F-28 adjacency; the distinct confirmation invocation/return chain is F-29-owned by `improve-canvas-clear-confirmation-interface`.
- At 390×844 all 13 application-menu actions measured 32 px high. At 320×568 the menu client/scroll heights were 416/510 and End made `版本` fully visible; at 640×360 they were 208/510 and the menu remained internally scrollable. Compact action geometry belongs to the expanded `improve-settings-toolbar-accessibility`; F-29 does not restyle menu rows. At 390×844, ArrowRight on focused `导出图片` left `aria-expanded=false`, one menu total and zero PNG/JPG items, confirming the existing F26-MENU-001 submenu boundary rather than a new F-29 owner.
- Clear-confirm production samples are recorded under CANVAS-CLEAR-FOCUS-010/COMPACT-011: desktop Escape and compact pointer Cancel both returned to `BODY`; 320×568, 390×844 and 640×360 dialogs fit and locked body scroll, while both actions were 62×36. Initial focus was Cancel and the dialog had a programmatic name/description. `aria-modal=null` remains a shared `ConfirmDialog` observation across 30 consumer files plus the primitive and is not classified as an F-29 caller defect without that matrix. Browser-control Tab did not move from Cancel, but the control layer's key semantics were uncertain, so this was not classified as product focus-containment evidence.
- Command panel search `保存` returned one current label `保存为 JSON`. No file picker, download, clear, cleanup, storage inspection, clipboard or real network action was invoked. Browser tab/server closed; port 7400 has no listener.
- Screenshots: `app-menu-desktop-1280x720-before.jpg`, `command-palette-desktop-1280x720-before.jpg`, `command-palette-save-desktop-1280x720-before.jpg`, `app-menu-compact-390x844-before.jpg`, and `clear-confirm-compact-390x844-before.jpg`. They are before-only evidence; no visual correction or “more beautiful” claim exists. English selection was not forced through storage/script, so that state remains open.
- Direct Vitest without `vite.config.ts` failed before collection because `@plait-board/react-board` alias was unresolved: exit 1, 1 failed suite, 0 tests, 1.48 s. The corrected workspace-aware commands produced 5/5 diagnostic tests across four files; all four temporary files were deleted. Existing `with-hotkey.test.ts` exit 0, 1/1 file, 21/21 tests, 22 ms tests, 1.21 s; it mocks save/image functions and contains no F-29 assertion.
- No runtime performance change and no five-sample before/after result; no faster/smaller/lower-memory claim. No full suite/build was rerun because only docs/OpenSpec/binary evidence changed; broad baseline remains section 2 and will be rerun only after approved runtime implementation.

## Exit, rollback and next gate

F-29 **fact modeling is complete for the currently reachable source and safe synthetic/browser evidence, but the feature does not meet exit criteria**. Seven confirmed/measured findings are blocked behind four independent approvals; four hypotheses need product semantics or measurements. Actual changes are only ledger/evidence and proposal/design/tasks/deltas plus five screenshots. No runtime, permanent test, style, storage, cache, migration, user file or board was modified.

Without Git metadata, rollback is patch-based: delete the four F-29 change directories and F-29 evidence, reverse the ledger/cross-feature/coverage updates, and delete the five generated screenshots. There is no data/cache recovery. Runtime implementation remains blocked until the user explicitly approves the corresponding independent change.
