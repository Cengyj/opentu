# F-22 Model Benchmark Workbench Diagnostics

## Feature Loop

**Feature / user scenario**: a user opens “模型测试” from the toolbox or a configured provider/model shortcut, selects text/image/video/audio targets and a comparison mode, enters a prompt/knowledge context/concurrency, starts and monitors the comparison, reviews timing/cost/preview/error data, rates or rejects results, exports history, stops or reruns work, and reopens persisted sessions after refresh.

**Scope**: registered manifest and lazy component; toolbox and settings entries; launch handoff; provider/model discovery and selection; prompt/knowledge context; session/entry types and KV state; concurrency workers; text client and media adapters; timing/cost/ranking; stop/delete/refresh ownership; RxJS UI projection; preview/error/export/analytics privacy; badge consumers; desktop empty state, content selection/label/language semantics, and window geometry.

**Out of scope**: model quality, provider billing correctness without a declared price source, real paid calls, task queue/media library/canvas insertion (explicit non-goals of the benchmark delta), provider protocol correctness already audited in F-09, and outer WinBox geometry/focus behavior already owned by F-15 changes.

**Specs / active changes**: `add-model-benchmark-workbench` remains active. Its checklist was corrected from 7/10 to 10/19 after adding audit/verification detail and unchecking the unsupported “cost captured” and “ranking UI complete” claims. Four independent approval changes were added:

- `ensure-model-benchmark-storage-consistency`: 1 requirement / 3 scenarios / 4 of 15 tasks complete.
- `control-model-benchmark-run-lifecycle`: 1 / 4 / 5 of 17.
- `sanitize-model-benchmark-diagnostics`: 1 / 3 / 4 of 14.
- `scope-model-benchmark-launch-handoff`: 1 / 3 / 4 of 13.

An additional interface-only change, `improve-model-benchmark-content-accessibility`, owns selected-state, label/region, and scoped zh/en content behavior; it does not take lifecycle, storage, diagnostics, ranking, handoff, outer-window, compact-target, or theme ownership. Its task count and manual validation result are recorded after the 2026-07-30 check below. No runtime implementation is authorized before approval.

## Forward Call Chain

1. `built-in-manifests.tsx:106-114` and `tools/tools/model-benchmark/index.tsx:6-54` register/lazy-load the 1280×860 internal tool. Toolbox card/window actions reach `toolWindowService.openTool`; settings uses `handleLaunchModelBenchmark()` at `settings-dialog.tsx:2479-2509`.
2. `model-benchmark-launcher.ts:16-61` optionally writes `ModelBenchmarkLaunchRequest` plus `launchedAt` to a global atom, resolves the manifest/fallback, calls `openTool({autoMaximize:true})`, and tracks non-secret selection metadata. The internal manifest does not enable multiple windows, so the tool service's default path reuses its primary instance.
3. `ModelBenchmarkWorkbench.tsx:399-680` subscribes to benchmark RxJS state, provider profiles, runtime discovery, and selected session. Local builder state owns modality, compare mode, selections, prompt preset/text, knowledge refs, concurrency, ranking mode, and UI locks.
4. The launch effect at `:844-1052` waits for store/model readiness, applies profile/model/mode fallback, and may create/run a shortcut session. Manual start at `:1054-1078` uses only a component-local lock, calls `createSession`, then `runSession`.
5. `model-benchmark-service.ts:603-641` creates a `ModelBenchmarkSession` and pending entries, publishes it, fires a whole-store KV write, and records metadata-only analytics. The singleton starts `load()` in its constructor at `:487-530`; persistence is `void kvStorageService.set` at `:532-547`.
6. `runSession` at `:774-893` resolves prompt preset and optional knowledge context, resets all entries, creates a shared cursor with `1..concurrency` workers, then invokes `runEntry` for each target. There is no run-owner map, AbortController, stop method, or interrupted state.
7. `executeBenchmark` at `:241-484` routes text to `defaultGeminiClient.sendChat` with `modelRef`; image/video/audio resolve the existing adapter and settings context, then call its generation method. First response is captured from streaming/submission/progress callbacks or falls back to completion time.
8. `runEntry` at `:895-1026` writes running/completed/failed state, timings, sanitized preview or `Error.message`, persists after each mutation, and tracks entry analytics. A final session mutation selects completed/partial/failed.
9. Workbench state subscription renders filtered history, ranked entries, previews, raw JSON, errors, rating/favorite/reject, and export. Excel export reads timing, `estimatedCost`, preview, and error fields at `:1081-1365`; `ModelBenchmarkBadge.tsx:16-49` reads a summary synchronously when its parent renders.

## Reverse Trace

- Final benchmark KV state has one writer: `persist()` after every service mutation. Its callers are load-independent session create/remove/activate/rank/feedback/run/entry/final updates.
- Final provider requests have four writers: text client plus image/video/audio adapters, all reachable only through `runEntry` → `runSession`. The current service has no cancellation writer.
- Final ranking order is written by `rankBenchmarkEntries(activeSession.entries, activeSession.rankingMode)` at `Workbench:659-667`. Session ranking mode comes from create input/default state; `setRankingMode` has no reachable UI caller.
- Final cost display/export/value ranking all read `entry.estimatedCost`; the only runtime assignment is the entry initializer `null` at service `:256`.
- Final raw-data details have one UI writer at `Workbench:1489-1555`; durable raw data originates from client/adapter responses and passes unchanged through `sanitizePreview`.
- Final user error and analytic `errorMessage` originate from `summarizeError(Error.message)` and are written at service `:982-1024` without a redaction boundary.
- Final settings prefill originates in the global launch atom. No identity-checked clear/ack writer exists, so the component-local signature ref cannot prevent replay after remount.
- Final favorite/reject badges read the service synchronously; only the workbench subscribes to its observable. Whether parent rerenders are sufficient for timely badge refresh remains unverified.

## Runtime, Data, And Boundary Model

- **Inputs/outputs**: `CreateBenchmarkSessionInput` contains modality, compare mode, prompt preset/text, optional knowledge refs, ranking mode, targets, and source. `ModelBenchmarkTarget` owns provider/profile/model/modality/vendor/selection key. Service returns a session synchronously and `runSession(): Promise<void>`.
- **Defaults/transforms**: text modality, cross-provider, low-cost text JSON preset, concurrency 2, ranking speed. UI clamps concurrency to `1..AI_GENERATION_CONCURRENCY_LIMIT`. Knowledge refs are normalized and expanded into an execution prompt only at run time.
- **State owners**: Workbench owns builder/UI locks; service BehaviorSubject owns in-memory sessions and ready flag; KV key `aitu:model-benchmark:sessions` owns durable history; adapters/providers own remote work; tool-window service owns window state; analytics owns event copies.
- **Side effects**: KV reads/writes, provider calls, runtime discovery reads, knowledge-context reads, Excel download, tool/window and benchmark analytics. The benchmark does not create task history, media history, or canvas elements by design.
- **Concurrency/races**: worker cursor bounds entries inside one invocation, but the same session has no singleflight. Constructor hydration can overwrite mutations. Whole-state writes can complete out of order. Removal can race with running provider promises.
- **Timeout/cancel/retry**: no service timeout, stop, AbortSignal, cancelled/interrupted state, or provider-call ownership after deletion. Rerun resets every entry; refresh does not resume or normalize running state.
- **Persistence/migration**: one whole-store key; max 12 sessions sorted by `updatedAt`; preview text/URLs are bounded, but raw data is not. No schema/version field or migration handles orphaned running statuses.
- **Cache/offline**: benchmark service has no Cache API owner. Provider/network availability belongs to existing clients/adapters. No offline provider test was run.
- **Privacy/observability**: analytics excludes prompt content but includes raw provider error message on failure. Full raw responses and prompt/session data enter KV. No real credential or provider sample was inspected.
- **Tests**: the permanent `model-benchmark-service.test.ts` contains six pure preset/ranking/selection tests. It does not import the service singleton or exercise storage, execution, cancellation, recovery, launch handoff, UI, export, or analytics.

## Issues

### [F22-COST-001]

**Status**: 已证实事实. **Evidence strength**: exhaustive assignment/caller search plus isolated successful mock run.

**User impact**: users are promised cost comparison/export/value ranking, but every real completed entry remains “未知”; cost mode has no measured input and cannot deliver the stated comparison.

**Reproduction/static proof**: `createEntryFromTarget` writes `estimatedCost:null` at service `:241-262`; full-source search finds no later assignment. A successful mocked text run completed with `estimatedCost === null`, while UI/export/value-score callers read it at Workbench `:1128,1208-1209,2160-2162` and pure ranking `:156-220`.

**Current vs expected**: current runtime never captures cost. The active delta expects estimated cost and cost sorting. Proposed expected behavior uses a declared compatible price/unit/request quantity; otherwise remains explicitly unknown and never fabricates zero.

**Call chain/root cause**: target → entry null initializer → provider execution → completion mutation omits cost → KV/RxJS → UI/export/ranking. The data field and pure consumers were implemented without an owning price calculation boundary.

**Affected range**: all four modalities and every session. Timing, preview, manual feedback, and speed ranking remain available.

**Candidate/alternative**: finish the original active change with an existing price source and unit-safe estimator. Hiding cost UI was rejected because the approved capability explicitly includes cost; treating null as zero was rejected as false data.

**Risk/validation/rollback**: wrong units or request quantities can mislead spending decisions. Add price-present/absent tests per modality, UI/export currency/unit assertions, and no-extra-request assertions. Roll back estimator/control tests; stored `null` remains compatible.

### [F22-RANKING-002]

**Status**: 已证实事实. **Evidence strength**: reachable DOM observation plus complete caller search.

**User impact**: the result header displays a ranking label, but users cannot change speed/cost/balanced/value-for-money mode as the change checklist claimed.

**Reproduction/static proof**: service `setRankingMode()` exists at `:676-705`; no production caller exists. Workbench local `setRankingMode` is used only to copy the active session at `:647-652`. Browser 1280×720 exposed all four modality and three compare-mode buttons but no ranking control.

**Current vs expected**: current session creation uses local default `speed`; result ordering reads the stored mode. Active delta expects filter/sort by speed/cost/rating/favorite. Proposed completion exposes reachable controls and persists the selected session mode, while cost-dependent modes remain truthful for unknown cost.

**Call chain/root cause**: builder default → session rankingMode → pure rank → label/order. The service/pure layer was completed but the UI mutation path was never wired.

**Candidate/alternative**: implement compact controls in the result header and call the existing service. Removing other pure modes was rejected because it would reduce the active specified capability.

**Risk/validation/rollback**: switching can reorder focused cards; preserve stable IDs/focus and test null-cost ordering, keyboard names, session reopen, export. Roll back UI/caller/tests without data migration.

### [F22-LIFECYCLE-003]

**Status**: 已证实事实. **Evidence strength**: active specification, exhaustive service/UI trace, and three controlled lifecycle diagnostics.

**User impact**: users cannot stop running comparisons; double start can duplicate paid requests; deleting an active session erases local tracking while its provider call continues; refresh can leave permanent-looking “running” history.

**Reproduction**: with deferred mock `sendChat`, start the same one-entry session twice; two provider calls were observed. In a separate run, delete after the call starts; sessions became empty while the call later resolved. Load a persisted running session; session and entry remained running. No provider was contacted.

**Current vs expected**: current has component-local manual-start lock only, no service singleflight/stop/cancel, unconditional delete, and unchanged refresh state. Proposed lifecycle change gives one run owner, truthful stop, active delete guard, and interrupted refresh normalization without auto-resume.

**Call chain/root cause**: UI/shortcut → independent `runSession` stack → workers/provider; deletion mutates only local state; persisted status outlives the runtime stack. Execution state is durable but its owner/cancellation identity is not.

**Affected range**: all modalities, manual/shortcut/rerun calls, external cost/side effects, history/export/status analytics.

**Candidate/alternative**: `control-model-benchmark-run-lifecycle` specifies singleflight, pending cancellation, supported abort, truthful non-abortable stopping, active deletion guard, and additive cancelled/interrupted states. Simply disabling the start button was rejected because service/shortcut callers remain; reporting cancelled immediately was rejected for non-abortable work.

**Risk/validation/rollback**: adapters differ in abort support and additive states affect export/sort. Test four modalities, abortable/non-abortable late settle, duplicate start, delete, refresh, partial results, rerun, and no hidden requests. Rollback first tolerantly maps additive states, then removes owner/UI/tests.

### [F22-STORAGE-004]

**Status**: 已证实事实. **Evidence strength**: deterministic happens-before trace plus two deferred KV diagnostics.

**User impact**: a session/feedback/run action accepted during startup can disappear; overlapping writes can leave durable history older than the visible in-memory history.

**Reproduction**: hold constructor `get`, create a session, then resolve an older empty snapshot; visible state becomes empty. After readiness, create two sessions while holding writes, resolve the two-session write first and one-session write last; in-memory state has two, simulated durable state one. Both assertions passed.

**Current vs expected**: current `void load` and `void set` have no shared readiness/order/failure semantics. Proposed storage change waits for authoritative hydration, commits accepted writes in order, and shows safe unsaved feedback while keeping existing key/schema.

**Call chain/root cause**: constructor load and every mutation are independent whole-state replacers for the same key. RxJS publication precedes unobserved durability.

**Affected range**: create/remove/active/ranking/feedback and every entry/session run mutation; up to 12 retained sessions.

**Candidate/alternative**: one initialization result plus per-key accepted-write chain. Per-session database redesign/journal was rejected as larger than the confirmed same-runtime race; delaying by elapsed time cannot establish readiness.

**Risk/validation/rollback**: slow storage delays mutations and ordered writes add queue latency. Test read failure, all pre-ready callers, rejection recovery, active ID/retention, and five-run 1/10/50 mutation matrix with zero loss. Rollback boundary/UI/tests; no migration.

### [F22-DIAGNOSTICS-005]

**Status**: 已证实事实. **Evidence strength**: forward/reverse source trace plus credential-shaped sentinel propagation tests; no real leak claim.

**User impact**: arbitrary provider response envelopes enter durable local history and raw JSON UI; arbitrary `Error.message` enters durable state, user feedback, Excel, and analytics. Those boundaries have no size/allowlist/redaction policy.

**Reproduction**: successful mock response containing `Bearer F22_SENTINEL_ONLY` was present in entry `preview.rawData` and the last KV snapshot. Rejected mock error containing `Bearer F22_ERROR_SENTINEL_ONLY` was present in `errorSummary`, KV, and the failure analytics payload. Both are synthetic sentinels.

**Current vs expected**: current text/media executors attach raw response; `sanitizePreview` passes it unchanged; `summarizeError` returns raw message. Proposed safe boundary persists normalized bounded preview fields and safe error category/status/reason, excludes raw envelopes/messages from storage/UI/export/analytics, and ignores legacy raw fields on read.

**Call chain/root cause**: provider response/error → preview/errorSummary → whole-store KV → details/export; error additionally → analytics. One object is reused for debugging and user/durable consumers with different privacy needs.

**Affected range**: all benchmark modalities, local history size/privacy, export, error UI, analytics. No evidence says an actual provider response currently contains a credential.

**Candidate/alternative**: modality preview DTO plus bounded allowlist/redaction/generic fallback. Merely increasing length limits was rejected because recursive/credential-shaped/unknown fields remain; background store deletion was rejected without separate destructive authorization.

**Risk/validation/rollback**: less raw debugging detail. Retain category/status and safe known reason; table-test recursive/oversized/HTML/URL/bearer/control values and four success previews. Rollback DTO/normalizer/read filter/tests; omitted data cannot be reconstructed but no migration command is needed.

### [F22-HANDOFF-006]

**Status**: 已证实事实 for persistent global request; settings end-to-end click is environment-blocked. **Evidence strength**: source ownership trace plus isolated launcher diagnostic.

**User impact**: after a settings shortcut is consumed, closing and remounting the workbench can replay the stale prefill.

**Reproduction/static proof**: launcher writes the global atom and has no clear/ack. A diagnostic called the launcher and read the same non-null request twice. Workbench deduplicates only with a ref that resets on mount. Existing `toolInstanceId` is supplied by `ToolWinBoxManager` but ignored.

**Current vs expected**: current is a persistent global request. Proposed expected behavior gives each request an identity, waits for compatible discovery, then identity-checks and acknowledges it once; later generic open has no stale prefill and does not auto-run.

**Call chain/root cause**: settings → global atom before `openTool` reuse/new → workbench local signature. The handoff has no acknowledgement and the signature resets on remount.

**Affected range**: settings shortcuts, remount/reopen, sequential shortcut races, and discovery delay. Toolbox open with no historical shortcut is unaffected.

**Candidate/alternative**: identity-checked compare-and-ack after apply or terminal target resolution. Clearing immediately after publish was rejected because discovery/render can be delayed; unconditional clearing can erase a newer request.

**Risk/validation/rollback**: remount/ack ordering can lose a newer request. Test reused/new, sequential shortcuts, StrictMode, delayed/failed discovery, generic open, launch failure, and no-auto-run. Rollback request identity/ack/effect/tests; no storage change.

### [F22-WINDOW-GEOMETRY-007]

**Status**: 实测结果, owned by existing `fix-tool-window-viewport-transition`; no duplicate F-22 implementation/change.

**User impact**: at the tested desktop viewport, the auto-maximized benchmark window/root extended 140 CSS px below the viewport. The document had no page scroll, and the workbench main/history containers had no additional internal scroll range for that clipped height.

**Environment/reproduction/raw values**: Codex in-app Chromium, current Vite, 1280×720 CSS px, DPR 1, light/zh, normal unthrottled host network/CPU. Open toolbox → model benchmark. WinBox `0,0,1280×860`; root `0,48,1280×812`; viewport/body/document 1280×720; main clientHeight/scrollHeight both 812 and bottom 860. Screenshot captures the visible 1280×720 crop.

**Current vs expected/root cause**: manifest/fallback both request 1280×860 and launcher asks auto-maximize; existing outer-window viewport invariant should keep the maximized rectangle inside current viewport. F-15 already owns that primitive and rollback, so F-22 records another affected caller only.

**Validation**: after the existing change is approved, repeat identical data/theme at 1280×720, 768×1024, and 390×844; require window within viewport, all builder/history/results reachable, and restore size preserved. No F-22 code change now.

### [F22-BADGE-008]

**Status**: 待验证假设; no code change.

**Why suspected**: `ModelBenchmarkBadge` calls `getModelBenchmarkSummary()` during render but does not subscribe to the service. Its AI-input and chat-selector parents have no benchmark observable subscription. The workbench does subscribe, so a feedback mutation does not itself schedule badge-parent rendering.

**Missing user evidence**: dropdown mount/open can cause a fresh render, which may be sufficient for the intended usage. No configured benchmark result was created and no real-model selector mutation was exercised, so a visible stale badge is not confirmed.

**Validation plan**: component test with an open selector and externally emitted favorite/reject mutation, then browser with synthetic persisted session; verify live update and reopen behavior before deciding whether to use `useSyncExternalStore`/RxJS subscription. Do not change code based only on subscription shape.

### [F22-RESPONSIVE-009]

**Status**: 未知/阻塞.

**Missing evidence**: real 390×844/768×1024 workbench content, dark theme, English strings, high-DPI/zoom, keyboard focus/stop/live states, slow/offline provider, and visual states with large histories/results. In-app Browser is fixed at 1280×720 and formal Playwright cannot launch because `chromium_headless_shell` revision 1200 is absent.

**Classification/validation path**: environment/test-coverage blocker, not product defect. Restore the pinned browser revision or a viewport-capable surface; use synthetic providers and deterministic histories, then capture same-data/theme screenshots and DOM/focus measurements. Outer geometry stays with F-15.

### [F22-CONTENT-STATE-A11Y-010]

**Status**: 已证实; implementation awaits `improve-model-benchmark-content-accessibility`. **Evidence strength**: production state transition/DOM plus reverse source proof for result feedback.

**User impact/current vs expected**: modality, comparison mode, history filter, active history session, score, favorite, and reject all have a visual current state, but assistive technology cannot determine it. The expected interface exposes the same state without changing selection, feedback, analytics, or benchmark execution.

**Reproduction and raw result**: production `dist/apps/web`, in-app Chromium, `127.0.0.1:7394/?sw=0`, 1280×720/DPR 1, one state sample, no throttle configured. All 4 modality, 3 comparison, and 5 history-filter buttons had `aria-pressed=null`, `aria-selected=null`, and `aria-current=null`. Clicking image moved its class to `active`, focused the image button, and replaced the text preset with the current image preset; the programmatic state values remained null. The test then restored text. No provider/storage/export action occurred.

**Call chain/root cause**: Workbench local modality/compare/filter state or service active-session/feedback state → conditional CSS class at `ModelBenchmarkWorkbench.tsx:1603-1756,2184-2247` → visible result. State ownership is present, but output wiring ends at CSS. Native buttons already provide Enter/Space activation and are a non-problem.

**Candidate/risk/validation/rollback**: add one consistent radio/tab/pressed contract and expose session/feedback states. Risk is duplicate tab stops, unexpected arrows, or duplicate callbacks. Test pointer/Tab/Enter/Space/chosen-arrow behavior with exact calls and focus. Rollback removes only state/group semantics and tests.

### [F22-FORM-A11Y-011]

**Status**: 已证实; implementation awaits the same content change. **Evidence strength**: production accessibility snapshot/DOM and source relationship trace.

**User impact/current vs expected**: model/provider concepts are visible next to controls but their accessible names come only from different placeholder instructions; prompt has no persistent label after its placeholder disappears. Users navigating fields cannot reliably correlate purpose and instruction. Expected labels remain available while values change and identify existing regions without altering inputs.

**Reproduction and evidence**: production DOM showed zero `labels`, no `aria-label`, and no `aria-labelledby` for history search, model select input, provider select input, and prompt textarea. The accessibility snapshot exposed visible generic `对比模型:` followed by textbox `搜索并选择要横向对比的模型`, and generic `参测供应商:` followed by a placeholder-named textbox. `最大并发` has `aria-label=最大并发` and is a confirmed non-problem. The root already exposes `aside` as complementary and `main`; the only content heading in empty state is the result `h3`.

**Call chain/root cause**: builder/local state → TDesign/native inputs at `ModelBenchmarkWorkbench.tsx:1603-2058` → placeholder fallback in the accessibility tree. Visible labels and inputs are siblings without stable IDs/relationships.

**Candidate/risk/validation/rollback**: add persistent localized labels plus labelled history/builder/result structure at F-22 wrappers; do not change shared TDesign defaults. Risk is unstable generated IDs or names containing raw data. Verify empty/synthetic sessions, editing after placeholder disappears, long data, callback bytes, and no credential/prompt/error in names. Rollback relationships/headings/tests only.

### [F22-CONTENT-I18N-012]

**Status**: 已证实 static language-owner defect; implementation awaits the same content change.

**User impact/current vs expected**: the application exposes an existing Chinese/English provider and the outer tool manager consumes it, but all Workbench content remains hard-coded Chinese. English users therefore receive a localized shell boundary with Chinese history, builder, confirmation, result, and safe feedback content. Expected application-authored copy follows initial/live language while arbitrary provider/model/session/prompt/result/error data remains unchanged.

**Static proof and call chain**: `I18nProvider` owns `language/t/setLanguage` at `i18n.tsx:589-631`; `ToolWinBoxManager.tsx:24,38` consumes it for the outer surface. `ModelBenchmarkWorkbench.tsx` has no `useI18n` import/call and contains its application strings directly across `:53-109,399-479,1081-1365,1489-1555,1603-2265`. Therefore no language state can reach content rendering. This conclusion does not depend on a filename or comment.

**Candidate/risk/validation/rollback**: add typed F-22 application keys and initial/live zh/en tests with non-secret sentinels. Do not translate raw provider/user data or change export columns without a separate contract. Risk is partial localization or data mutation; verify callback/export/analytics bytes. Rollback keys/consumers/tests; no migration.

### Content-interface non-problems and remaining unknowns

- Native content buttons already support keyboard Enter/Space; this loop does not replace them or claim pointer-only behavior.
- `aside`, `main`, the result `h3`, delete button name, knowledge-context button name, and concurrency input name are present in production.
- Running/stopping/live state stays with `control-model-benchmark-run-lifecycle`; storage loading/failure stays with `ensure-model-benchmark-storage-consistency`; error body stays with the diagnostics owner; ranking control stays with the original capability change; outer dialog/focus/geometry stays with F-15.
- Desktop controls measured 28–40 px high, including 32 px modality and 34 px comparison/history controls. The stylesheet keeps fixed 34 px history filters and has no compact override for these controls, but the repository has no formal F-22 target-size threshold and no compact runtime sample. Touch-size remediation remains unknown, not a confirmed defect or part of the proposal.
- The Workbench stylesheet hard-codes light surfaces, but the reachable application did not expose a verified global dark-theme owner in this run. Dark-theme remediation remains unknown rather than inferred from color literals.

## Baseline And Verification Results

- Git metadata remains absent; worktree cleanliness/history cannot be checked.
- Isolated F-22 diagnostics: exit 0; 1/1 file passed, 8/8 tests passed, 2.10 s. All external clients/adapters/storage/analytics were mocked; only sentinels were used. Temporary test deletion verified with exit 0.
- Permanent `model-benchmark-service.test.ts`: exit 0; 1/1 file, 6/6 tests, 1.31 s.
- 2026-07-30 content-interface documentation recheck of the same permanent pure test: exit 0; 1/1 file, 6/6 tests, 1.12 s. No runtime source or test was changed.
- Drawnix typecheck: `nx run drawnix:typecheck --skip-nx-cache`, exit 0, 33 s.
- Targeted ESLint over seven F-22 chain files: exit 1; 25 problems (3 errors, 22 warnings). All three errors are existing Workbench lint baseline (`@nx/enforce-module-boundaries`, empty interface, empty destructuring); warnings include existing unused draft controls/hooks and service `rawData:any`. No runtime file was modified, so none is a new regression.
- Full Drawnix lint was not rerun because F-22 changed no runtime file and F-21 already recorded the same repository baseline class: exit 1, 377 errors/1742 warnings plus four hover findings.
- Formal Playwright remains unable to launch: required `chromium_headless_shell` revision 1200 absent.
- Six related OpenSpec strict validations: each exit 127; CLI unavailable. Manual structure/scenario/name audit completed.
- 2026-07-30 content-interface production run: current `dist/apps/web`, Chromium 1280×720/DPR 1, one sample per state, no configured throttle. No provider request, export, storage inspection, credential read, or permanent setting mutation; text modality was restored, tab closed, and local server stopped.
- `improve-model-benchmark-content-accessibility`: strict validation exit 127 because the CLI remains unavailable. Manual check passed: proposal/design/tasks/delta present, 3 requirements/9 scenarios, every scenario has WHEN/THEN, requirement names are repository-unique, capability has one active owner, and tasks are 6/24.

## Performance And Visual Evidence

No performance optimization or visual/runtime change was implemented, so no faster/smaller/more-beautiful claim is made. One current-state warm-window sample was collected with the app already loaded: five close → toolbox card click → `.model-benchmark` visible trials at 1280×720/light/zh, normal unthrottled host network/CPU: `[362, 346, 430, 363, 350]` ms; median 362 ms, range 346–430 ms. This includes Browser control/driver overhead, is not a cold-load benchmark, and has no before/after comparison.

Current screenshot: `workbench-empty-desktop-1280x720.png` (true PNG, 1280×720). It proves reachable empty builder/result states, four modalities, three compare modes, disabled `开始测试 (0)`, no ranking/stop control, and the visible viewport crop. No post-fix image exists.

## Exit Review

- Fact model and forward/reverse F-22 chain: complete.
- Confirmed findings and hypotheses separated: complete.
- Runtime fixes: blocked by the corrected original change plus four new approval changes and the existing outer-window change.
- Safe desktop empty-state, lifecycle/storage/diagnostic mock evidence, focused test/typecheck: complete.
- Real settings shortcut: blocked by zero configured models; no settings/credentials were modified.
- Real provider success/failure/cost/stop/offline: intentionally not run without credentials/paid-call authorization; mocks establish code behavior only.
- Responsive/dark/English/full E2E and post-fix performance/visual comparison: blocked/pending.
- Content selected-state, label/region, and language findings have one approval-only owner; no implementation or after screenshot exists. Compact touch geometry and global dark-theme applicability remain unknown rather than included without evidence.
- Rollback: remove five new change directories, revert the original change documentation, and delete this evidence directory/ledger updates. No runtime state, cache, migration, provider request, or user data was changed.

F-22 is **fact-model complete and implementation-blocked pending approval/environment restoration**, not verified complete.
