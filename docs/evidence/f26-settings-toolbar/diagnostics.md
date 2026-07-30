# F-26 settings and toolbar diagnostics

Date: 2026-07-30 (Asia/Shanghai)

## Browser environment

- Current production build served from `http://127.0.0.1:7333/?sw=0` on loopback.
- In-app Chromium surface; exact browser version unavailable.
- Viewport 1280×720 CSS px, DPR 1, Chinese UI, no configured CPU or network throttling.
- No provider credential or paid/external model request was used.

## Application menu keyboard result

1. Open the application menu and move focus to the language item.
2. Press `ArrowRight`: English submenu item count remains 0.
3. Reopen/focus the language item and press `Enter`: the whole menu closes and menu count becomes 0.
4. Focus the toolbar More button and press `Enter`: its panel/menu item count remains 0.

The source chain explains the observed result: submenu open is only assigned from mouse enter; Enter/Space issues a button click; the click forwards selection to the outer application menu; the outer menu closes on selection. The More wrapper toggles on click only when runtime touch detection returns true.

### Compact application-menu geometry and scrolling

A supplemental current-production run used loopback, the in-app Chromium surface, zh-CN, DPR 1 and no configured CPU/network throttle. It did not activate file, export, clear, cleanup, provider, clipboard or storage mutations.

- At 390×844, all 13 existing application-menu parent/leaf actions measured 32 CSS px high. This is 12 px below the repository compact touch-target convention at `packages/drawnix/src/styles/_responsive.scss:33`.
- At 320×568, the menu had `clientHeight=416` and `scrollHeight=510`; pressing End made the final `版本` row completely visible inside the menu.
- At 640×360, the menu had `clientHeight=208` and `scrollHeight=510`; it remained internally scrollable and contained by the viewport.
- At 390×844, focusing `导出图片` and pressing ArrowRight left `aria-expanded=false`, one menu in the DOM and zero PNG/JPG leaf items. This reconfirms F26-MENU-001 at a compact viewport; it is not a new export-function defect.

**[F26-MENU-COMPACT-016] Status and impact**: measured and confirmed against the existing 44×44 compact convention; implementation waits for `improve-settings-toolbar-accessibility` approval. Current application-menu actions expose 32 px vertical activation boxes in the measured compact state. Expected behavior is at least 44×44 for compact or coarse-pointer interaction while preserving the existing 32 px desktop density, icon/text size, order and callbacks.

**Call chain/root**: app-toolbar trigger → `app-toolbar.tsx:54-111` Popover → `app-menu-items.tsx` composition → shared `Menu`/`MenuItem` rows → current fixed desktop-size styling → 32 px DOM rectangles. The menu already owns bounded height, overflow and active-row reveal, as the 320×568 and 640×360 controls show; the confirmed correction is row activation geometry rather than page-scroll or menu-height replacement.

**Candidate/alternative/risk/verification/rollback**: add compact/pointer-coarse minimum activation geometry to existing application-menu parents/leaves only, retaining desktop density and internal scrolling. Shrinking text, unlocking body/canvas scrolling or globally enlarging all menu primitives is rejected. Risk is fewer simultaneously visible items and submenu placement pressure; verify 320/375/390/640×360/tablet/desktop, pointer/touch/keyboard, active-row reveal, both submenus, zh/en, light/dark and matched screenshots. Roll back the scoped compact rules/tests only. The expanded change now has 3 requirements, 8 scenarios and 17 tasks with 5 evidence tasks complete; all requirement names and the `settings-toolbar-accessibility` capability have one active owner. CLI strict validation remains unavailable.

Before-only artifact: `docs/evidence/f29-canvas-file-maintenance/app-menu-compact-390x844-before.jpg`, JPEG 390×844, 37,913 bytes, SHA-256 `5f71ee68c4d410910f57c8c60e4abd68e6407e91eb4b1f96e81834a291dec0e1`. Its storage under F-29 reflects the browser session that first exposed the shared menu geometry; ownership remains F-26/F-28. No after image or visual-improvement claim exists.

## Canvas switch accessibility result

The live accessibility tree for the canvas settings view contained the visible heading/copy followed by an unnamed `switch`. The source renders no explicit label relationship or `aria-label` on that `Switch`.

## Shared Settings window and navigation result

A second current-production run was served from `http://127.0.0.1:7396/?sw=0` in the same in-app Chromium surface at 1280×720 CSS px, DPR 1, Chinese UI, and no configured CPU/network throttle. No browser storage or credential was read, no setting was changed, and no provider/discovery/price/health/benchmark request was issued.

### Open, root, and title-bar controls

The application-menu Settings item sets `appState.openSettings`; Drawnix conditionally mounts `SettingsDialog`; `SettingsDialog` passes `modal={false}` and `onClose={handleWindowClose}` into `WinBoxWindow`; WinBox creates the actual root/title/control DOM. The resulting `.winbox-settings-window` had:

- root `role=null`, `aria-label=null`, `aria-labelledby=null`, `aria-modal=null`, `tabindex=null`;
- visible `.wb-title` text `设置`, with no `id` relationship or role;
- present control spans: split, minimize, maximize, full, close;
- visible controls: split, maximize, close;
- all three visible controls: `SPAN`, `role=null`, `aria-label=null`, `tabindex=null`;
- hidden minimize/full controls remained present in DOM but CSS-hidden.

Opening Settings through the current application-menu pointer path produced one Settings window and left `document.activeElement` on `BODY`. After focusing the provider navigation button, Escape left the window count at 1. Pointer activation of the current `.wb-close` changed the window count from 1 to 0 and again left focus on `BODY`.

The reverse close chain is WinBox `onclose` → `WinBoxWindow.handleClose` → the latest `SettingsDialog.handleWindowClose`. That owner returns while discovery is open or persistence is active; otherwise it delegates to `handleCancel`, which closes immediately only when there are no pending drafts and otherwise preserves the existing asynchronous save-before-close behavior. Any proposed Escape path must enter this owner exactly once and restore focus only after the window actually closes.

### Four-view navigation and active panel

The shared navigation is an unlabeled native `ASIDE`; the content root is a `DIV` with no role, name, ID, or labelled-by relationship. Provider, model preset, canvas display, and speech playback are native buttons and remain pointer reachable. After pointer activation moved the visible active CSS class from provider to model preset and then canvas display:

- all four buttons still had `aria-current=null`;
- all four had `aria-pressed=null` and `aria-selected=null`;
- all four had `aria-controls=null`;
- the selected view existed only in React `activeView` plus `settings-dialog__nav-item--active` styling.

The forward transition is navigation button `onClick` → `handleViewChange` → one existing `settings/view_changed` analytics call → `activeView` state → `renderActiveView` → the one shared content root. The reverse render chain from every visible provider/preset/canvas/speech surface returns to the same four writers in `VIEW_SECTIONS`; there is no other writer of the current visual nav class.

### Shared-shell language ownership

`I18nProvider` already owns live `zh|en` state and contains `settings.title` in both languages. `SettingsDialog` does not consume `useI18n`; `VIEW_SECTIONS` and the WinBox `title` prop are fixed Chinese. This proves the shared title/navigation caller bypasses the existing language owner. It does not prove that provider/model/TTS/preset content belongs in the same change: F-09 owns provider/model application copy, while this F-26 boundary owns only the shared title, nav/panel framing, and Settings-specific title-bar action names.

### Screenshot

- `settings-shell-desktop-1280x720-before.jpg`: 1280×720 JPEG, 50,745 bytes, SHA-256 `e9c62b1662ba891b1caf8c91b363b49efa7bbc4224f6ccfade23f22bb82bf18f`.
- The screenshot is a before-only artifact. No CSS/runtime implementation or after screenshot exists, so it supports no visual-improvement claim.

### Shared WinBox minimum-size and restore follow-up

The initial one-cycle geometry observation was not promoted to a conclusion. A clean second production page at `http://127.0.0.1:7397/?sw=0`, 1280×720 CSS px, DPR 1, then isolated the same stored-versus-rendered boundary across three existing callers:

- Settings declares `height="88%"`, which resolves to 634 px, and `minHeight={680}`. Three close/reopen plus maximize/restore cycles produced initial→restored heights `634→634`, `680→634`, and `680→634` at `(77,43)`, width 1126.
- AI image generation declares `height="60%"` (432 px) and `minHeight={500}`. Its current initial→restored rectangles were `1024×500 @ (128,144)` → `1024×432 @ (128,144)`.
- AI video generation declares `height="60%"` (432 px) and `minHeight={600}`. Its current initial→restored rectangles were `896×600 @ (192,144)` → `896×432 @ (192,144)`. The initial rectangle bottom was 744, 24 px past the 720 px viewport because centering used the raw 432 px height before the rendered clamp.
- Media Library is the same-viewport negative control: `height="85%"` resolves to 612 px, above `minHeight={500}`; initial and restored rectangles both remained `1088×612 @ (96,54)`.

No task was submitted, no setting was changed, no credential/browser storage was read, and no provider/discovery/price/health/benchmark request was issued.

The source establishes the complete root cause:

1. Shared callers pass percentage dimensions plus minimums to `WinBoxWindow`.
2. On first lazy load, `winboxLoaded=false`; the constraint effect runs and returns before an instance exists, and does not depend on `winboxLoaded`/readiness, so it does not rerun merely when construction becomes possible.
3. WinBox's non-autosize constructor parses and stores the raw percentage dimension without its minimum (`node_modules/winbox/src/js/winbox.js:229-257`).
4. On a cached mount, the wrapper constraint effect sets the minimum and calls explicit `resize(rawWidth,rawHeight)`. WinBox stores the raw values, clamps only local rendered variables, and does not write the clamp back to stored `width/height` (`:1265-1284`).
5. The wrapper has already saved the raw normal rectangle at `WinBoxWindow.tsx:933-940`.
6. Maximize uses skip-update full-viewport dimensions; restore calls no-argument `resize()`, which reuses the stored raw rectangle (`winbox.js:1071-1129`). The rendered minimum and stored normal state therefore diverge.

This is now a confirmed shared correctness/geometry problem, not a performance or aesthetic claim. `fix-winbox-minimum-size-consistency` owns only cold/warm current-viewport normal-size synchronization, final centered placement, and maximize/restore consistency. It does not change declared caller sizes or absorb generation orientation, tool/media viewport transitions, accessibility, compact redesign, or z-index.

### Proposal validation, focused baseline, and cleanup

- `openspec validate improve-settings-surface-accessibility --strict`: command unavailable, exit 127. This is a tool blocker, not a validation pass.
- Manual change audit: 4/4 required files; 3 unique requirements; 11 scenarios; 11 `WHEN`; 11 `THEN`; 7/28 tasks; each requirement has one active owner; `settings-surface-accessibility` has one active owner.
- Existing settings-focused Vitest command with the fixed workspace Node: exit 0; 6/6 files and 17/17 tests passed; Vitest duration 2.65 s, process wall time 3.15 s. The repeated “Crypto functionality is not available” stderr is jsdom environment noise already present in settings-manager tests; it did not fail assertions. No current permanent test covers the proposed shared shell contract.
- `openspec validate fix-winbox-minimum-size-consistency --strict`: command unavailable, exit 127. Manual audit: 4/4 required files; 2 unique requirements; 8 scenarios; 8 `WHEN`; 8 `THEN`; 7/25 tasks; both requirements and `winbox-size-constraints` each have one active owner.
- Existing F-08/media content negative-control Vitest command: exit 0; 5/5 files and 26/26 tests passed; Vitest duration 4.19 s, process wall time 4.71 s. Browserslist age and missing third-party source-map messages are tool noise; no permanent test currently exercises the shared WinBox geometry state.
- The Settings window was pointer-closed with no pending draft, the in-app Browser tab was closed, terminal session `75735` received Ctrl-C and exited 0, and port 7396 had no remaining listener.
- No temporary diagnostic test or screenshot staging file remains.
- The geometry follow-up closed all Settings/generation/media windows, closed its Browser tab, stopped terminal session `10692` with exit 0, and left port 7397 with no listener.

## Toolbar persistence positive control

1. Right-click Pen and choose remove: visible Pen button count changed from 1 to 0.
2. Refresh: count remained 0.
3. Right-click Shape and choose reset to default: Pen count returned to 1.
4. Refresh again: count remained 1.

This confirms the normal IndexedDB path for the tested remove/reset operations. It does not test rejection or rapid overlapping completion order.

## Toolbar overlapping-write ordering diagnostic

A fixed-Node 24.14.0/Vitest 3.2.4/jsdom diagnostic replaced only the `kvStorageService.set` boundary with two controlled deferred completions. The singleton was initialized with the default configuration; it accepted `hideButton('freehand')` and then `showButton('freehand')`. The second write was completed first and the first write last. Raw outcome:

- current service configuration after both accepted operations: `freehand.visible=true`;
- controlled durable record after reverse completion: `freehand.visible=false`;
- a fresh `initializeAsync()` reading that durable record: `freehand.visible=false`;
- 1/1 file and 1/1 test passed, exit 0, test 6 ms, Vitest 1.20 s, process wall 1.69 s.

The diagnostic proves the current service has no accepted-operation sequence owner and will restore an older whole-record candidate when its asynchronous storage boundary settles in reverse. It does not prove how often real Chromium IndexedDB connections settle in that order: browser storage was not inspected or modified, and no incidence rate is claimed. The reachable chain remains context menu/More/drag drop → `useToolbarConfig` synchronous operation → `ToolbarConfigService` candidate → independent fire-and-forget `kvStorageService.set` → later `initializeAsync` read → provider projection. The service is also exported by both package entrypoints.

This confirmed race is `F26-TOOLBAR-ORDER-014`. It is intentionally separate from the sequential rejection/rollback contract in `ensure-toolbar-config-write-consistency`; the new approval-only `preserve-toolbar-config-mutation-order` owns domain-local semantic-operation sequencing. The temporary diagnostic file was deleted, no runtime code changed, and no user toolbar setting or persistent browser record was touched.

After proposal/evidence synchronization, the existing `use-toolbar-config.test.tsx` baseline passed 1/1 file and 1/1 test, exit 0, test 37 ms, Vitest 1.39 s, process wall 1.88 s. It covers async initialization projection only; it is not misreported as permanent overlap coverage.

## TTS rendering sample

- System voice options: 157.
- Buttons in the TTS settings view: 193.
- Descendants under `.project-drawer-tts`: 1,799.
- Five same-data switches from Canvas Display to the last voice becoming visible: 381, 369, 380, 380, 357 ms; median 380 ms, range 357–381 ms.

That first number is not application render latency. A supplemental run used the same production artifact at `http://127.0.0.1:7398/?sw=0`, the same in-app Chromium surface, 1280×720 CSS px, DPR 1, Chinese UI, 157 system voices, and no configured CPU/network throttle. Seven warm locator actions measured Canvas Display at 315–326 ms (median 319), Speech Playback at 292–308 ms (median 302), and clicking the already-active Speech Playback button—no view transition—at 301–323 ms (median 306). The browser driver/action wait therefore dominates the locator duration; the earlier 380 ms value cannot support a product bottleneck claim.

Two narrower diagnostics separated the remaining work:

- The existing search was toggled between a guaranteed no-match value and one whitespace character. `trim()` makes the whitespace query restore the same 157 rows without changing saved TTS settings. Removing 157 rows took `[28,40,25,24,29,24,24]` ms (median 25); restoring them took `[41,35,36,37,36,37,34]` ms (median 36); filling the already-present whitespace value took `[20,25,24,25,23,21,23]` ms (median 23). The observable incremental median above the driver no-op is therefore 13 ms. Restored state was 157 rows/1,799 descendants; seven forced last-row layout reads were all 0 ms at millisecond resolution. This bounds the current all-row commit in this environment but is not a browser-profiler or memory result.
- The browser evaluation sandbox exposes DOM metadata but not `speechSynthesis` or `performance`, so the exact 157 DOM-derived voice records were passed to the fixed workspace Node 24.14.0 runtime. A deterministic shuffle (`0x5f3759df`) and 7 samples × 200 sorts measured the current comparator at 3.517–3.562 ms/sort (median 3.543). One instrumented sort made 937 comparisons, 1,874 `find` calls, and 144,724 element probes. A diagnostic score-precompute comparator measured 0.168–0.175 ms/sort (median 0.171). This confirms a bounded algorithmic inefficiency in `TtsSettingsPanel.tsx:142-165`; it does not establish a user-visible bottleneck or a Chromium before/after improvement.

`F26-PERF-005` is therefore closed as a non-problem at the current evidence threshold. No memoization, virtualization, lazy rendering, runtime test, or OpenSpec change was added. Virtualization would alter scroll/focus/accessibility semantics and would still require an independently approved change if future browser-profiler, long-task, memory, or larger-dataset evidence demonstrates user impact.

The first direct Vitest invocation used workspace-root file filters with the package-root `src/**/*.test.*` include and exited 1 before collection with “No test files found”; this was an invocation/configuration error, not a test failure. The corrected fixed-Node command used `--root packages/drawnix`: 2/2 files and 5/5 tests passed, exit 0, Vitest duration 1.91 s, process wall time 2.41 s. The missing third-party sourcemap and two `board.getRectangle is not a function` messages are existing test-fixture noise in the canvas reading-queue case; assertions and exit status passed. No permanent TTS full-list/performance test was added because no runtime contract changed.

## Application-menu stacking over Settings

A clean current-production page was served from `http://127.0.0.1:7399/?sw=0` in the in-app Chromium surface at 1280×720 CSS px, DPR 1, Chinese UI, and no configured CPU/network throttle. The application menu remains available while the non-modal Settings WinBox is open. Opening both produced:

- application-menu rectangle `(61,39)–(302.1875,551)`, 241.1875×512 CSS px, computed `z-index: 5000`;
- Settings rectangle `(77,43)–(1203,677)`, 1126×634 CSS px, computed `z-index: 5000`;
- intersection `(77,43)–(302.1875,551)`, 225.1875×508 = 114,395.25 CSS px²;
- top-left, center, and bottom-right `elementFromPoint` samples in the intersection hit `.wb-nw`, `.settings-dialog__nav-shell`, and `.settings-dialog__sidebar-list`; 0/3 belonged to the menu.

The matched screenshot shows only the menu's approximately 16 CSS px strip left of the Settings window; the remainder is visually covered, and pointer hit testing reaches Settings. This is current behavior. The expected behavior for an already available global application menu is that its visible overlapping surface and submenus remain pointer operable without mutating the underlying non-modal window.

Two controls separate the defect from menu-content or generic portal failure:

- after Settings was closed, the unchanged menu center was topmost menu content and WinBox count was 0;
- the existing Settings provider context menu computed at 20,000 remained topmost above the same 5000 Settings window.

The complete layer chain is toolbar menu trigger/open state → `components/toolbar/app-toolbar/app-toolbar.tsx:54-111` → `PopoverContent` portal with caller `style={{ zIndex: Z_INDEX.POPOVER_APP }}` at line 80 → `components/popover/popover.tsx:197-220`, whose line 211 spreads caller style and then overwrites it with `zIndex: 5000` → WinBox registration → `services/winbox-manager-service.ts:17,115-130`, which compactly assigns 5000 + window index → `components/winbox/winbox-custom.scss:6-10`, which applies the variable with `!important` → browser stacking and pointer hit testing → Settings receives the overlap. The current TypeScript `POPOVER_APP` value is 4500, but it is not the effective menu layer. Numeric drift alone remains insufficient evidence for any other surface.

The before-only artifact is `app-menu-behind-settings-1280x720-before.jpg`: 1280×720 JPEG, 62,387 bytes, SHA-256 `a2ce9470f4de4f0403c5e88bf24d97669bcc727918fbcc5002cb64f69e44d640`. No runtime/CSS implementation or after screenshot exists, so no visual-improvement claim is made.

This confirmed defect is `F26-APP-MENU-STACK-015`. The first approval design proposed only a backward-compatible shared-Popover layer override and an AppToolbar opt-in at 5500. A complete reverse inventory invalidated that fixed-only design before implementation:

- production source contains six static `WinBoxWindow` JSX sites across five consumer files, plus runtime tool-window and nested WinBox component instances;
- `tool-window-service.ts:318-323,325-428,616-624` defaults every explicitly multi-window or URL tool to `launchMode='new'`, accepts every `openNewToolInstance`, generates a new ID, and has no count guard;
- four built-in manifests explicitly support multiple windows and three built-in URL tools inherit multiple-window behavior; the toolbox open path and `MinimizedToolsBar.tsx:135-154` new-window command are reachable writers;
- `ToolWinBoxManager.tsx:296-380` renders every active state as `WinBoxWindow`;
- the manager's `5000 + zeroBasedIndex` formula therefore gives the 501st registered window 5500. This is a source-proven supported-path upper-bound absence, not a claim that users commonly open 501 windows.

The change now proposes one Drawnix-scoped outer WinBox stacking context at the WinBox band. All internal activation indices remain ordered but are contained below the sibling application-menu 5500 layer; absent-context `container || document.body` fallback and multiple independent Drawnix roots remain unchanged. `WinBoxWindow.tsx:608-624` and upstream `winbox.js:114,315` already accept an explicit root, which is an implementation seam, not proof that re-rooting is behavior-neutral. Equal geometry, pointer events, lifecycle, fullscreen/maximize/restore, nested portals, multiple roots, host cleanup, 501+ controlled layers, and higher-overlay order remain mandatory approval-stage tests. No window limit, arbitrary larger number, or global z-index normalization is proposed.

A planned standalone Chromium containment probe produced no result: the in-app Browser evaluation surface rejects DOM mutation as read-only, and address-bar attempts left the probe tabs at `about:blank`. This is a diagnostic-environment limitation, not a product failure or proof of host behavior. All blank probe tabs were finalized; no file/server/runtime state was created for that attempt.

Unselected Popover callers retain current effective 5000; WinBox activation values, menu placement/content/dismissal/focus/analytics, higher overlays, storage, cache, tasks, provider/settings data, and global z-index normalization remain unchanged by contract. The change is no longer described as a narrow numeric override: it is an approval-gated application-menu fix with a necessary Drawnix-scoped WinBox containment boundary.

`openspec validate fix-application-menu-window-stacking --strict` could not run because the CLI is unavailable, exit 127. After the multi-window correction, manual audit found 4/4 required files, 2 requirements, 6 scenarios, 6 `WHEN`, 6 `THEN`, 6/20 checked tasks, unique requirement names, and one `application-menu-stacking` capability owner. This is not reported as strict validation. No dedicated permanent host/WinBox/Popover/AppToolbar stacking test currently exists, and no runtime code was changed before approval.

The Settings/menu/context-menu surfaces were closed without changing settings/provider data; the browser tab was closed; the local 7399 server received Ctrl-C; and the port had no remaining listener. No credential/browser storage was read and no provider, paid, or task request was issued.

## Unresolved hypotheses and boundaries

- Language resets to Chinese on provider recreation/refresh because no persistence key or restore writer exists, but no current formal requirement establishes language persistence. It remains a candidate proposal, not a defect.
- Generic z-index normalization is closed as a non-problem at the current evidence threshold: constants, Sass, documentation, and local values drift, but static numeric mismatch does not prove a shared defect. The concrete application-menu/Settings occlusion is separately confirmed above and belongs only to `fix-application-menu-window-stacking`.
- Toolbar reverse completion is no longer a hypothesis: the controlled service-boundary diagnostic is recorded above, while actual Chromium incidence remains unknown. Any ordering implementation belongs only to the approval-gated `preserve-toolbar-config-mutation-order` change.
- Provider-page unnamed switches belong to F-09, not this F-26 accessibility change.
- Shared Settings root/title controls/nav/current-panel/i18n belong to the approval-only `improve-settings-surface-accessibility`; the independently confirmed shared normal-size/minimum/restore state fork belongs to `fix-winbox-minimum-size-consistency`; application-menu-over-window stacking belongs to `fix-application-menu-window-stacking`. Provider/model content, toolbox-specific viewport transitions, storage durability, theme, clear-confirm action geometry and all other overlay layers remain outside those changes. Canvas switch/menu keyboard behavior and the measured application-menu compact activation geometry belong only to `improve-settings-toolbar-accessibility`.
- Formal Playwright responsive/visual execution remains blocked by the missing configured Chromium revision; no mobile/tablet result is claimed.
