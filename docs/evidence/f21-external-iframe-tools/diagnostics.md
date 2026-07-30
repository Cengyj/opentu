# F-21 External Iframe Tools Diagnostics

## Feature Loop

**Feature / user scenario**: a user opens Chat-MJ, Banana Prompt, or Pose Library from the toolbox, optionally inserts a URL tool on canvas, then uses the external page inside the existing WinBox/canvas runtime. The user can minimize, restore, pin, reopen, open another instance, convert a canvas tool to a popup, and use Banana Prompt's advertised prompt-copy action without Opentu's parent frame pre-emptively denying the minimum write permission.

**Scope**: the three reachable built-in manifests; drawer card/window/insert actions; pinned launcher and context new-window actions; window service/state; URL-template resolution; WinBox and canvas iframe rendering; settings refresh; popup conversion; sandbox/feature permissions; loading/error/retry feedback; Banana's public copy control flow; local persistence/analytics/privacy boundaries.

**Out of scope**: external-site account forms, generation, download/content quality, system clipboard contents, paid/provider calls, a custom-tool permission editor, outer WinBox viewport/focus/title-control behavior already owned by F-15 changes, and registry/catalog architecture. The Banana copy audit is limited to Opentu's parent Permissions Policy and the public bundle's current branch behavior; it does not make Opentu responsible for browser/OS/user-activation or third-party failures.

**Specs / active changes**: formal `toolbox` and `toolbox-plugin-runtime`; `refactor-toolbox-plugin-runtime`; `ensure-toolbox-initialization-consistency`; `remove-deleted-custom-tool-runtime-state`; `fix-tool-window-viewport-transition`; `improve-tool-window-accessibility`. The first refactor remains 8/9 and its proposal predates the current partial registry implementation, so F-21 does not duplicate it.

**Current approval state**: no runtime implementation is authorized. Three independent changes were added for approval:

- `secure-external-tool-credential-launch`: 2 requirements, 5 scenarios, tasks 4/18 complete.
- `improve-external-iframe-load-recovery`: 1 requirement, 5 scenarios, tasks 4/17 complete.
- `allow-banana-prompt-clipboard-write`: 1 requirement, 4 scenarios, tasks 4/19 complete.

OpenSpec CLI validation was attempted for all three and exited 127 (`openspec: command not found`). Manual validation confirmed proposal/design/tasks/delta-spec presence, four-level Scenario headings, at least one Scenario per requirement, and no same-named formal/active requirement outside each new change. The new `external-tool-clipboard-permission` capability has one active owner.

## Forward Call Chain

1. `built-in-manifests.tsx:95-145` registers the three tools. Inputs/defaults are `ToolDefinition` values: ID/name/category, URL, default width/height, and the shared five-token sandbox list. Banana's description at `:126-134` explicitly includes viewing and copying prompts.
2. `ToolboxDrawer` groups registry results through `ToolList.tsx:29-73`; `ToolItem.tsx:114-134,137-193` maps card click and explicit actions to window/insert callbacks.
3. Drawer insert/window handlers at `ToolboxDrawer.tsx:190-217,269-296` call `needsApiKeyConfiguration()`. Missing Chat-MJ key stores `{tool, action}` in a component ref, opens settings, and resumes after settings close at `:79-99`; successful window action calls `toolWindowService.openTool()` at `:225-263`; successful insert calls `ToolTransforms.insertTool()` with the unresolved template at `:104-184`.
4. Alternate window entries do not enter those handlers: pinned launcher click calls `openTool()` at `MinimizedToolsBar.tsx:95-115`; context new-window calls `openNewToolInstance()` at `:121-138`; canvas popup calls `openTool()` after deleting the element at `tool.generator.ts:662-674`.
5. `tool-window-service.ts:318-441` owns open/reuse/new state, multi-instance selection, pin mutation, position, activation order, RxJS notification, and window analytics. It accepts `ToolDefinition` and returns an instance ID (or existing optional failure) without inspecting URL variables.
6. `ToolWinBoxManager.tsx:395-438` projects open states to WinBox. Internal components have a Suspense fallback; URL tools call `processToolUrl(tool.url)` inline and render an iframe with title and sandbox. The external branch at `:418-427` has no `allow` writer.
7. Canvas rendering at `tool.generator.ts:255-276,540-589` creates status/iframe/interaction overlay, substitutes the template at render time, adds `toolId` as a search parameter, applies sandbox and `allow="clipboard-read; clipboard-write"`, and caches the iframe. Settings changes refresh cached template iframes at `:52-76`.
8. External response/content stays owned by the cross-origin document. Opentu observes only iframe lifecycle signals. Window state flows back through the service observable to WinBox and minimized toolbar; canvas state persists the unresolved URL and metadata through the existing board/workspace save chain.

## Reverse Trace

- Final WinBox iframe `src` has one writer: `ToolWinBoxManager.tsx:418-427`; all writers originate in `toolWindowService` state, whose user callers include drawer, minimized launcher/context actions, canvas popup, and other internal feature callers.
- Final canvas iframe `src` has two writers: initial `createIframe()` at `tool.generator.ts:540-589` and settings refresh at `:64-75`; their persisted source is a `PlaitTool` inserted by the drawer or restored with the board.
- Final window close/minimize/restore/pin state is written by `tool-window-service.ts` and projected through `observeToolStates()` at `MinimizedToolsBar.tsx:80-90` and the WinBox manager subscription.
- Missing-key user feedback has writers only in drawer insert/window handlers; launcher/context/popup state has no equivalent writer.
- WinBox external loading/error/retry UI has no writer because no such state exists. Canvas loader/error text is written at `tool.generator.ts:255-276`, but its stacking makes it non-visible beneath the iframe.
- WinBox external Feature Policy has no writer: no manifest field is projected and the only iframe branch at `ToolWinBoxManager.tsx:418-427` omits `allow`. The external Banana document is the only writer of its copy attempt; the captured public bundle chooses `navigator.clipboard.writeText()`, whose rejection catch logs and exits without invoking its API-missing fallback.

## Runtime, Data, And Boundary Model

- **Input/output types**: manifests and service use `ToolDefinition`; it currently models sandbox `permissions` but no iframe Feature Policy field. Canvas uses `PlaitTool`; URL processing returns `{url: string, missingVariables: string[]}`; state service returns an instance ID and publishes `ToolWindowState[]`.
- **Defaults/transforms**: three tools use manifest dimensions 1000×700, 800×600, and 900×700. WinBox measured content heights subtract its chrome. URL templates are replaced from `geminiSettings`; missing values retain their literal placeholder. Canvas adds `toolId` to the URL search params.
- **State owners**: drawer owns a transient pending action ref; service owns window/pin/activation maps and RxJS notifications; board owns `PlaitTool`; DOM/renderers own iframe and loader nodes; external pages own their internal session/content.
- **Side effects**: window/pin state mutation, localStorage pin persistence, board insertion/removal and later workspace persistence, iframe network navigation, analytics on successful drawer/service actions, settings-change DOM refresh.
- **Concurrency/races**: multiple windows are independent service instances; settings refresh iterates cached iframes. Current external WinBox has no lifecycle state. Canvas `onload/onerror` closures target their local loader, but no attempt token or retry exists.
- **Timeout/cancel/retry**: no WinBox timeout or retry. Canvas has no timeout/retry; `onerror` changes text only. Window close and canvas removal cancel by DOM unmount/removal; no explicit timer exists today.
- **Persistence/migration**: custom catalog/board store unresolved templates; window open rectangles are session state; pin preferences persist. No F-21 migration is required by either proposal.
- **Cache/offline**: third-party pages are not an Opentu offline guarantee. No F-21 Cache API/IndexedDB writer was found; availability depends on network and target origin.
- **Error propagation**: external page errors are not normalized into application state. WinBox provides no feedback; canvas relies on an unreliable `onerror` event and covered text.
- **Privacy/observability**: tool analytics contain ID/name/category/type, not URL/key. Runtime template substitution sends the resolved URL to the iframe. No real key was read or sent in this audit.
- **Tests**: only `services/__tests__/tool-window-service.test.ts` covers four default pin/window cases. No permanent Chat-MJ/Banana/Pose, URL-template, sandbox, external loading/error, or alternate-entry gate test was found. `apps/web/public/iframe-test.html` is a generic manual fixture, not a product-entry regression test.

## Issues

### [F21-CREDENTIAL-BOUNDARY-001]

**Status**: 已证实事实. **Evidence strength**: deterministic mock execution plus static forward/reverse trace.

**User impact**: opening the built-in Chat-MJ path with an application provider key gives that credential to scripts executing in the fixed third-party iframe origin without the warning shown for user-authored custom URLs.

**Reproduction/static proof**: mock `geminiSettings.get()` with `F21_SENTINEL_KEY_DO_NOT_USE`; resolve the registered Chat-MJ URL; parse it with `URL`. The destination origin is `https://vercel.ddaiai.com`, and its hash contains the sentinel. One isolated file/two tests passed; the temporary test was removed. No real setting was read.

**Current vs expected**: current built-in manifest silently interpolates the global key. Expected under the proposed security boundary: built-in external tools never receive application provider credentials; Chat-MJ opens its existing credential-free shell.

**Call chain**: manifest `:95-103` → `processToolUrl()` `url-template.ts:18-20,78-108` → WinBox `ToolWinBoxManager.tsx:418-427` or canvas `tool.generator.ts:540-589` → third-party document `location.hash`.

**Root cause**: persistence safety (substitute only at render) was treated as destination authorization; the built-in manifest bypasses the custom-tool warning/choice boundary.

**Affected range**: users with a configured application key who open/insert/restore Chat-MJ; window and canvas render/settings-refresh paths. No evidence of server receipt or malicious use is claimed.

**Candidate / alternative**: preferred proposal removes built-in key interpolation and retains the credential-free external shell. Alternative explicit per-origin consent or a dedicated credential vault was rejected for this loop because it adds storage/product/architecture surface without evidence that the existing shell requires it.

**Risk / validation / rollback**: risk is loss of automatic Chat-MJ configuration. Verify credential-free shell, sentinel non-delivery, no URL/key in DOM/log/analytics/storage, and existing lifecycle. Roll back the manifest/preflight/test set; no migration.

### [F21-LAUNCH-GATE-002]

**Status**: 已证实事实. **Evidence strength**: deterministic service test plus exhaustive caller trace.

**User impact**: after a key is removed, a pinned/custom credential-template tool can be opened from launcher/new-window/popup without the drawer's settings guidance. Canvas popup also deletes the element before knowing whether the window can render a usable URL.

**Reproduction/static proof**: with mocked empty key, `needsApiKeyConfiguration()` returns true and `processToolUrl()` retains `${apiKey}`, but `toolWindowService.openTool()` returns an instance whose status is `open`. Direct callers are at `MinimizedToolsBar.tsx:95-115,121-138` and `tool.generator.ts:662-674`; only drawer handlers at `ToolboxDrawer.tsx:190-217,269-296` gate.

**Current vs expected**: current outcome depends on entry. Proposed expected behavior is one preflight invariant: reject before window/iframe/analytics/pin/canvas mutation and show privacy-safe recovery.

**Call chain**: launcher/context/canvas title action → service state creation → WinBox inline URL processing; or persisted canvas → create/refresh iframe. Reverse sink trace finds no shared guard.

**Root cause**: validation is located in two UI callbacks rather than state creation and render boundaries.

**Affected range**: any explicitly user-authored `${apiKey}` tool reachable outside drawer; Chat-MJ until issue 001 removes its built-in template.

**Candidate / alternative**: central state/render preflight with caller-local feedback; reorder canvas removal after successful open. Copying drawer checks into each caller was rejected because it leaves future entries unguarded.

**Risk / validation / rollback**: service optional-return handling can become silent; require caller tests and no-mutation assertions. Roll back preflight and popup reorder together; stored templates remain compatible.

### [F21-WINDOW-LOAD-FEEDBACK-003]

**Status**: 实测结果. **Evidence strength**: one controlled browser observation plus source proof; not a performance benchmark.

**User impact**: a user can see a large blank external-tool window with no indication whether the tool is loading or stuck. Pose Library remained blank at the 3-second check and later loaded after the additional 10-second wait.

**Reproduction**: desktop evidence used the Chromium in-app Browser, local app port 7200, 1280×720, normal network/CPU, light Chinese UI: open toolbox → unique “动作场景库” entry → wait 3000 ms → screenshot/DOM check → wait 10000 ms → body/screenshot check. A second direct headless Chromium `149.0.7827.55` run used the current Vite app on port 7396, a fresh isolated context per tool/viewport, 390×844 and 768×1024, light/zh-CN, DPR 1, normal unthrottled network/CPU, one sample per Banana/Pose combination. All four 3000 ms screenshots showed a blank white iframe area with no Opentu lifecycle feedback. Raw screenshots, hashes and bounds are in `metrics.json`.

**Current vs expected**: current WinBox external branch renders only iframe. Proposed expected behavior is visible loading, honest slow state, known-error alert, and explicit retry without claiming the remote cause.

**Call chain**: tool entry → window service → `ToolWinBoxManager.tsx:395-438` → iframe; there are no `onLoad`, `onError`, timer, status or retry nodes.

**Root cause**: Suspense feedback exists only for internal React tools; the URL branch has no lifecycle state model.

**Affected range**: all external URL tools on slow/offline/blocked networks; current reachability was confirmed for Banana and Pose at desktop, mobile, and tablet. The four direct responsive samples extend the missing-feedback observation but do not establish a speed distribution.

**Candidate / alternative**: per-instance loading/slow/error/retry overlay with a 10-second slow threshold. A hard timeout failure was rejected because a later successful cross-origin load is valid and failure detection is incomplete.

**Risk / validation / rollback**: overlay may briefly cover usable content; remove on load and measure transitions. Verify fake timers, stale callbacks, multiple instances, same sandbox/request count, responsive screenshots. Roll back lifecycle UI/timers/tests; no data action.

### [F21-CANVAS-LOAD-LAYER-004]

**Status**: 已证实事实. **Evidence strength**: deterministic CSS/DOM construction proof.

**User impact**: canvas external tools do not visibly show their authored loading or `onerror` text because the white iframe is stacked above it; no retry exists.

**Reproduction/static proof**: `tool.generator.ts:255-276` appends loader then iframe. Loader CSS at `:520-534` uses `position:absolute; z-index:1`; iframe CSS at `:558-570` uses `position:absolute; background:#fff; z-index:10`. The error branch only changes the same covered loader text at `:272-276`.

**Current vs expected**: current status exists in DOM but is covered. Proposed expected behavior places status/recovery above the iframe and keeps it accessible/operable.

**Call chain**: persisted/inserted `PlaitTool` → `render()` → `createLoader()` + `createIframe()` → iframe lifecycle closure → hidden status.

**Root cause**: stacking order contradicts the feedback intent; the implementation has no retry state or attempt cleanup model.

**Affected range**: every canvas-rendered external iframe during loading and reported error.

**Candidate / alternative**: share the lifecycle semantics of change 003 while keeping renderer-local presentation. Merely increasing one z-index was rejected because it would not provide slow/error recovery, keyboard semantics, or stale-attempt tests.

**Risk / validation / rollback**: overlay can conflict with the existing interaction-protection overlay (`z-index:100`); define explicit ordering and test selection/click behavior. Rollback is local DOM/style/test removal.

### [F21-IFRAME-PERMISSION-005]

**Status**: 已证实事实，等待 `allow-banana-prompt-clipboard-write` 审批. **Evidence strength**: current public bundle control-flow capture plus 5/5 controlled cross-origin Chromium policy results and the local source/reachability trace.

**User impact**: the reachable Banana Prompt manifest advertises viewing and copying prompts, but the WinBox parent frame denies the cross-origin document's `clipboard-write` feature before Banana's current asynchronous copy branch can complete. Banana catches that rejection, logs `Failed to copy`, and does not enter its legacy fallback.

**Reproduction / measured environment**: on 2026-07-30, fetch `https://www.aiwind.org/` without credentials or form interaction. The HTTP 200 document was 453,805 bytes with SHA-256 `f8ac33b15e2fbdc3b4837be393944149df98cbea70ea98e8d4088ed53faec1d2` and referenced 20 scripts. Bundle `/_next/static/chunks/f03595ad43de9b1b.js`, SHA-256 `8a38595cdff445d292a42526bbd4463dd0b63c30d29e85c6e99958453cbf5b73`, selects `navigator.clipboard.writeText()` when the API and secure context exist; only the API-missing/non-secure branch reaches textarea plus `execCommand("copy")`; the rejection catch logs and exits. Then run five fresh pages in headless Chromium `149.0.7827.55` with two random loopback origins and child-origin browser clipboard permission granted. The iframe without `allow` reported write policy false/permission denied 5/5; `allow="clipboard-write"` reported write true/prompt while read stayed false/denied 5/5; the canvas-style read/write control reported both true/prompt 5/5; the direct top-level control reported both true/granted. The probe called no Clipboard API and read/wrote no system clipboard.

**Current vs expected**: current WinBox iframe at `ToolWinBoxManager.tsx:418-427` has no `allow`, so the browser policy denies the feature. Expected under the proposal: only Banana's WinBox receives `clipboard-write`; it receives no `clipboard-read`, and tools without an explicit declaration keep no clipboard allowance. This removes the parent-policy denial but does not guarantee success against browser, OS, user-activation, or external-page refusal.

**Complete call chain**: `built-in-manifests.tsx:126-134` Banana entry/description → toolbox registry/list/card → `ToolboxDrawer` or pinned launcher → `toolWindowService.openTool()` → state observable → `ToolWinBoxManager.tsx:418-427` iframe without `allow` → Chromium Permissions Policy returns false/denied → public Banana click handler chooses `navigator.clipboard.writeText(prompt)` → promise rejection → catch logs and exits. Reverse trace from the final failure finds no Opentu Feature Policy writer and no external fallback on rejection. The canvas writer at `tool.generator.ts:580-581` is a separate path with a broader existing policy and is not modified by this change.

**Root cause**: the shared tool definition models iframe sandbox tokens but the WinBox renderer has no explicit least-privilege Feature Policy declaration, while Banana's existing user action relies on an API that cross-origin frames cannot use under the default parent policy.

**Affected range**: Banana Prompt opened in a WinBox on the audited Chromium policy model. No failure is attributed to Pose, Chat-MJ, canvas embedding, a specific operating-system clipboard, or all browser versions without separate evidence.

**Candidate / alternative**: preferred change adds a typed, optional WinBox feature-permission declaration and sets exactly `clipboard-write` on Banana's built-in manifest. The renderer omits `allow` when undeclared. Blanket `clipboard-read; clipboard-write` was rejected for lack of need; a Banana ID conditional was rejected because it hides the security grant; relying on fallback was rejected because the current rejection path does not call it; changing canvas policy was separated for lack of evidence.

**Risk / validation / rollback**: Banana's external origin gains write-request capability inside its WinBox; the least-privilege declaration limits that boundary. After approval, add negative/default renderer tests, rerun five no-write policy samples, verify Banana lifecycle and an isolated non-sensitive copy, and verify all other WinBox tools remain without clipboard allowance while canvas behavior/data stay unchanged. Roll back the type field, manifest declaration, renderer projection, and focused tests together; no storage, cache, migration, or user-data recovery is needed.

### [F21-RESPONSIVE-006]

**Status**: 实测结果，覆盖仍不完整；没有新增 F-21 外窗几何缺陷.

**Measured environment / steps**: current Vite development server at `http://127.0.0.1:7396/`; explicit cached headless Chromium `149.0.7827.55`; fresh isolated context for each tool/viewport; 390×844 and 768×1024; light/zh-CN; DPR 1; normal unthrottled network/CPU; one run per Banana/Pose combination. Expand the reachable toolbar when needed → open toolbox → click the real manifest card → wait for the titled iframe → wait 3000 ms → capture viewport/document/WinBox/iframe/close geometry, iframe attributes and screenshot. No external control, form, account, copy, download, credential or provider call was used.

**Raw result / current vs expected**: mobile Banana WinBox was `(8,122,374,600)`, Pose `(8,72,374,700)`; tablet Banana `(8,212,752,600)`, Pose `(8,162,752,700)`. Visible area equalled total area for all four. Close controls were wholly within the viewport; document `scrollWidth` equalled `clientWidth` at 390 and 768. Thus no F-21-specific outer overflow was observed. All four 3-second screenshots were nevertheless blank white content areas without Opentu feedback, which is additional evidence for `F21-WINDOW-LOAD-FEEDBACK-003`, not a new responsive root cause. A non-empty cross-origin body text read is not treated as proof that pixels were usable because the screenshots remained blank.

**Ownership / remaining blocker**: `fix-tool-window-viewport-transition` and `improve-tool-window-accessibility` continue to own outer geometry/controls; `improve-external-iframe-load-recovery` owns the blank lifecycle surface. Dark theme, English, high DPI/zoom, keyboard/focus, reduced motion, controlled slow/offline/error/retry, and after-state comparisons remain unverified. Formal Playwright still cannot launch because configured revision 1200 is absent; the explicit revision-1228 run is evidence, not a formal suite pass.

## Baseline And Verification Results

- `git status --short`: exit 128, “not a git repository”; worktree cleanliness/history cannot be checked.
- Isolated sentinel diagnostic via fixed Node + Vitest: exit 0; 1 file passed, 2 tests passed; 3.64 s. Temporary test removed and absence verified.
- Focused `tool-window-service.test.ts`: exit 0; 1 file passed, 4 tests passed; 3.57 s.
- `nx run drawnix:typecheck` through fixed Node: exit 0.
- Targeted ESLint over ten F-21 chain files: exit 0; 0 errors, 19 warnings. Warnings are existing static signals, not automatically classified as defects.
- `nx run drawnix:lint`: exit 1; 2119 problems (377 errors, 1742 warnings) plus four unrelated hover-check findings. This matches the known first-party lint baseline class and is not attributed to F-21.
- Public Banana bundle inspection through fixed Node: exit 0; HTTP 200; 453,805-byte HTML; 20 scripts; four clipboard-pattern findings in one hashed bundle. No credential, form, copy control, or clipboard was used.
- Local cross-origin clipboard policy probe through fixed Node and cached Chromium 149: exit 0; 5/5 without-allow samples returned write false/denied; 5/5 write-only samples returned write true/prompt and read false/denied; 5/5 read/write controls returned both true/prompt; the top-level positive control returned both true/granted. `clipboardApiCalled=false`; `systemClipboardReadOrWritten=false`.
- Direct responsive Chromium probe: exit 0; four isolated Banana/Pose samples across 390×844 and 768×1024. All WinBox/close rectangles were within the viewport and document scroll width matched client width; all four 3000 ms screenshots showed blank iframe content without Opentu feedback. The Vite server was stopped after capture; the temporary script was removed.
- Formal responsive Playwright: unable to run because the required `chromium_headless_shell` revision 1200 is absent.
- OpenSpec strict validation for all three new changes: exit 127; CLI unavailable. The clipboard change has 4/4 files, 1 requirement, 4 scenarios, 4/19 tasks; manual structure/name/conflict validation completed and its capability has one owner.

## Performance And Visual Evidence

No faster/smaller/memory claim is made and no runtime optimization was implemented. Browser timing has one run only. Raw UX-state values: Banana usable by the 3000 ms check; Pose blank at 3000 ms and usable after the additional 10000 ms wait, bounding the observed load completion only to `(3000, 13000]` ms. Screenshots:

- `banana-loaded-1280x720.png`
- `pose-loading-blank-1280x720.png`
- `pose-loaded-1280x720.png`
- `banana-mobile-390x844-before.png`
- `pose-mobile-390x844-before.png`
- `banana-tablet-768x1024-before.png`
- `pose-tablet-768x1024-before.png`

Window-control measurements (32×32, no title/ARIA label) are retained in `metrics.json` but remain owned by the existing F-15 accessibility proposal. No F-21 “more beautiful” claim is made.

## Exit Review

- Fact model and complete F-21 call chains: complete.
- Confirmed issues and hypotheses separated: complete; the former clipboard hypothesis is now a confirmed parent-policy defect with independent bundle and browser evidence.
- Runtime fixes: blocked by the three required OpenSpec approvals.
- Desktop success/slow and direct mobile/tablet current-state verification: complete for the recorded one-run conditions.
- Synthetic loading failure, dark/English/high-DPI/keyboard/reduced-motion, post-fix comparisons/clipboard behavior, and formal E2E: explicitly blocked/pending.
- Typecheck/focused tests: pass; full lint remains baseline-failing.
- Specification/documentation: proposals and evidence updated; formal specs remain unchanged pending approval.
- Rollback: current additions are documentation/change proposals/screenshots only and can be removed independently; no runtime state, cache, migration, or user data was changed.

F-21 is **blocked pending three independent approvals and test-environment restoration**, not “verified complete.”
