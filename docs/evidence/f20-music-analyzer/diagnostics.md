# F-20 Music Analyzer Diagnostics

## Scope, environment, and safe boundary

- User flow: open “爆款音乐生成”; analyze a local audio source or create lyrics; edit lyrics; submit existing Suno music generate/continue/infill tasks; observe progress/history/generated clips; insert existing results into the canvas.
- Browser: Codex in-app Chromium against current Vite workspace source at `127.0.0.1:7200`, Chinese UI, rendered light theme, DPR 1, no network/CPU throttling.
- No credential was entered and no paid/provider generation request was made. Browser evidence covers reachability, empty/create/reference states, geometry, DOM semantics, and console output. Provider completion states use current source and deterministic unit tests only.
- The directory has no Git metadata, so commit identity, worktree cleanliness, and historical blame cannot be established.
- Geometry and DOM have one controlled sample per state; they are not performance measurements. No speed, memory, or bundle improvement is claimed.

## Reachability and complete current chain

1. `built-in-manifests.tsx:81-92` registers the multi-window tool and its 520×700 default size; `tools/tools/music-analyzer/index.tsx:6-58` lazy-loads the component.
2. `MusicAnalyzer.tsx:33-168` owns record/navigation projection and shared task sync across Create/Lyrics/Generate/History.
3. Upload analysis: `CreatePage.tsx:377-430` → `cacheAudioSource()` → CHAT task → `TaskQueueService.executeMusicAnalyzerAnalyzeTask()` → Gemini analysis → task result/event → `syncMusicAnalyzerTask()` → record/UI.
4. Lyrics: Create/Lyrics → AUDIO Suno lyrics or dedicated CHAT Gemini → task queue → task sync → record/version/UI.
5. Music: Generate → 1–4 AUDIO tasks → Suno adapter → submit/fetch polling → audio/cover cache → task storage/event → generated-clip sync → record/history/canvas auto insertion.
6. Durable record key is `music-analyzer:records`, capped at 50; upload source cache cleanup currently runs only on record prune/delete.

## Confirmed direct fix: F20-CLIP-ID-SOURCE-001

- Current-before behavior: `audio-api-service.ts` normalized `clip_id || id`, and both result aggregation and shared audio task sync again fell back to list-row `id`. Generate uses `generatedClips[].clipId` as the continue/infill target.
- Expected behavior: formal `openspec/specs/audio-generation/spec.md:25-41` requires the remembered polling `clip_id` and explicitly forbids substituting row `id`.
- Red test: 2 files, 15 tests; 13 passed and 2 failed, exit 1. Received `provider-row-id`/`provider_row_id` where continuation ID had to be absent.
- Fix: preserve row `id` only as row metadata; `clipId`, `primaryClipId`, `clipIds`, and record projection now derive only from `clip_id`/remembered `clip_id`.
- Green test: 2/2 files and 15/15 tests passed, exit 0. Existing `indexedDB is not defined` LLM logger stderr is test-environment noise and did not fail assertions.
- Risk/rollback: clips without real `clip_id` remain playable but continuation/infill stays disabled, matching the formal spec. Rollback the four fallback removals and two tests; no task/record/cache migration.

## Confirmed pending issues and ownership

### F20-CANCEL-PROPAGATION-002

- Reproduction/static proof: cancel a running AUDIO or Music Analyzer dedicated CHAT task. The queue controller aborts, but the Suno adapter/API and dedicated executors do not consume the signal. Cancelling while audio/cover caching can still be overwritten by unconditional completion.
- Current vs expected: current local `cancelled` can coexist with ongoing polling/cache/finalize; expected is one stable local cancelled terminal state and no late record/insert.
- Root chain: `cancelTask():2172-2189` → controller at `:618-620` → AUDIO params `:654-707` → adapter `default-adapters.ts:304-330` → audio API `:875-1118`; cache guard window `task-queue-service.ts:709-865`; dedicated CHAT owners `:1501-1780`.
- Decision: implementation is blocked on updated `fix-task-queue-external-cancellation`. Alternative “ignore progress only” leaves network/cache/writeback active and is rejected. Rollback is isolated signal/guard/tests; no remote cancellation is promised.

### F20-RECORD-MUTATION-003 and F20-TASK-RESTORE-READINESS-004

- Measured reproduction: release two real `updateRecord()` calls after both read the same record. Expected `{title:"New",starred:true}`; received `{title:"Old",starred:true}`. One file/three tests: two passed, diagnostic failed, exit 1; temporary diagnostic removed.
- Root chain: multi-window/autosave/task/favorite/delete → `music-analyzer/storage.ts:56-80` → `record-storage.ts:48-106` whole-array load/modify/set. No per-key accepted-order boundary exists.
- Recovery chain: `useWorkflowTaskSync.ts:57-65` scans once → deferred task restore → `restoreTasks():2425-2434` emits only the first map task. A later restored Music Analyzer completion can receive no domain event.
- Decision: `fix-music-analyzer-record-consistency` waits for approval. It must consume the single application task-storage-ready owner shared with the existing workflow/video/MV/comic changes; no Music-specific poller is allowed.

### F20-LYRICS-MODEL-ACTION-005

- Static proof: `utils.ts:176-197` treats every Suno-named audio model as lyrics-capable; `suno-model-aliases.ts:40-64` forces continuation aliases to music; `audio-api-service.ts:221-238` gives forced alias action precedence over explicit lyrics.
- Current vs expected: choosing a displayed continuation alias can submit music from a lyrics flow. Expected is that selector capability and executable action agree.
- Decision: added a capability-filter requirement to pending `add-suno-lyrics-task-and-canvas-flow`; no model filtering or preference rewrite before approval.

### F20-BATCH-CREATION-FEEDBACK-006

- Static proof: `GeneratePage.tsx:297-347` sequentially creates tasks but writes all IDs only after the loop. A mid-loop throw leaves accepted tasks running, skips their record association, and reports one failure; late batch projection can still show results.
- Decision: extended `improve-generation-dialog-task-creation-feedback`. Approved behavior would retain/associate accepted tasks and show accepted/rejected counts; accepted tasks are not rolled back.

### F20-UPLOAD-CACHE-OWNERSHIP-007

- Static proof: `CreatePage.tsx:399` caches before task creation; `audio-source-cache.ts:18-45` writes the whole file; executor rejects `>20MB` only at `task-queue-service.ts:1518-1530`; `storage.ts:38-54` cleans only record-owned snapshots.
- Decision: `fix-music-analyzer-upload-cache-lifecycle` proposes preflight using the existing limit, page cleanup if no task is accepted, and task/record last-owner cleanup while preserving failed/cancelled task retry. No quota/performance claim exists without five samples.

### F20-PROVIDER-ERROR-BOUNDARY-008

- Static proof: `audio-api-service.ts:917-930,977-984` appends arbitrary response text to thrown messages; task writeback stores the message; Create/Lyrics render it.
- Confirmed scope: arbitrary provider body propagation. Unknown: whether a current real provider error contains a credential; no provider sample was requested.
- Decision: `sanitize-suno-provider-error-feedback` proposes bounded allowlist/redaction and safe diagnostics. No runtime sanitization before approval.

### F20-RESPONSIVE-009

- Desktop `1280×720`: window `x=124..644, y=162..862`; 142 CSS px below viewport.
- Tablet `768×1024`: the same 520×700 window fits.
- Mobile transition `390×844`: only 266 CSS px visible; close control `x=488.90625..518.90625` is outside viewport.
- Close/reopen in the same mobile viewport: window `x=124..524`; close `x=482..512`, still outside.
- Decision: shared outer-window issue, appended to existing `fix-tool-window-viewport-transition`; no F-20-specific positioning code.

### F20-CONTENT-A11Y-010

- Live DOM: navigation names are `history`/`starred`, history back is `←`, no pressed/selected/tab state is exposed, and no live regions exist.
- Reference upload is a pointer `div` plus hidden 0×0 unlabeled file input; history rows are pointer-only generic `div` elements with nested controls.
- Title-bar spans are owned by `improve-tool-window-accessibility`. Shared ComboInput behavior is owned once by `improve-video-workflow-form-accessibility`.
- Decision: `improve-music-analyzer-accessibility` owns localized content names/state, upload/history keyboard parity, live feedback, and compact 44×44 hit areas; implementation waits for approval.

## Artifacts and current status

- Screenshots: `desktop-1280x720.png`, `tablet-768x1024.png`, `mobile-390x844.png`.
- Raw values: `metrics.json`.
- `file` identifies all three screenshots as true PNG files at 1280×720, 768×1024, and 390×844. Ruby `JSON.parse` accepts `metrics.json` without error.
- The Vite server was stopped after capture and port 7200 had no listening process.
- Only the formal `clip_id` restoration and incomplete test mock were implemented. All other confirmed behavior/storage/security/accessibility changes are approval-gated.

## Final verification and OpenSpec audit

- Focused F-20 tests: 9/9 files and 48/48 tests passed, exit 0. The two clip-ID regression files were first observed red at 13/15 with two expected failures, then green at 15/15, exit 0.
- Drawnix typecheck passed, exit 0. Focused ESLint passed with 0 errors and 14 pre-existing `no-explicit-any` warnings. Repository `pnpm typecheck` passed 5/5 projects; `pnpm check:cycles` passed.
- Repository `pnpm test` exited 1: 182/187 files passed, 4 failed, 1 skipped; 1157/1161 tests passed, 3 failed, 1 skipped. The failures are outside the F-20 chain: GPT Image Blob mock, Sora duration, Gemini cached-image conversion, and a PPT mock missing an export.
- `pnpm build:web` passed: main build 7931 modules in 1m57s and service worker 54 modules in 1.75s. The single observed MusicAnalyzer chunks were JS 40.44 kB raw/12.21 kB gzip and CSS 10.54/2.20 kB; these are not before/after performance measurements.
- `pnpm size` exited 1 only because AI Chat was 844.36 kB gzip against 140 kB. Diagram, Office, Editor, and Media Viewer were within their recorded budgets. `pnpm verify:startup` passed all four entry budgets with no chunk cycle.
- Formal Playwright remains an environment blocker: configuration requires `chromium_headless_shell` revision 1200 while only revision 1228 is cached. No browser was installed and no result was fabricated.
- The nine F-20-related active changes currently have task counts 6/18, 5/15, 4/14, 4/14, 5/17, 4/13, 6/18, 6/19, and 0/22. Their deltas contain 23 requirements and 61 scenarios; every requirement has at least one level-four Scenario, proposal/design/tasks files are present, and no requirement name collides with a formal or other active requirement.
- `openspec validate <id> --strict` exited 127 for all nine changes because the CLI is unavailable. Manual structure/conflict checks do not constitute strict CLI validation.
