# F-24 Music Player And Shared Audio Playback Diagnostics

## Feature Loop

**Feature / user scenario**: a user plays an audio asset from the canvas, media library, or music-player tool, or starts local reading from a knowledge note/card; sees current item, progress, queue, subtitles, errors, and the global overlay; changes speed/mode/volume, switches items, pauses/resumes/stops, minimizes/restores the player, and creates/manages persistent playlists and favorites that survive refresh/backup.

**Scope**: canvas audio nodes and generic audio click entry; media-library/context entry; knowledge-base and canvas-text reading entry; tool launch and shared queue; remote cache fallback; single HTMLAudioElement and Web Speech; RxJS-style external-store projection; global overlay/music-player UI; playlist metadata/items stores and React Context; localStorage preferences; backup/restore; existing tests, accessibility tree, desktop geometry, and warm restore.

**Out of scope**: provider generation/quality and task execution (F-08/F-10/F-20); media-library asset commit/delete transaction ownership (`ensure-media-library-write-consistency`); outer WinBox geometry/focus/title controls (`fix-tool-window-viewport-transition` and `improve-tool-window-accessibility`); new playlist features, cross-tab distributed locking, cloud sync, provider cancellation guarantees, and unmeasured cache/CORS performance changes.

**Specs / active changes**: current `canvas-audio-playback` specifies shared speed/modes, persistent playlists/favorites, canvas/playlist queues, in-place nodes, global overlay, and close/stop. `backup-restore` includes playlists. Active `refactor-toolbox-plugin-runtime` is 8/9 with only critical tests incomplete; its original registry premise is stale but the reachable player/minimize behavior exists. New approval-only boundaries:

- `control-audio-playback-request-lifecycle`: 1 requirement / 3 scenarios / 5 of 14 tasks complete.
- `ensure-audio-playlist-write-consistency`: 2 requirements / 6 scenarios / 6 of 19.
- `improve-music-player-control-accessibility`: 1 / 3 / 4 of 13.

All three strict validations exited 127 because OpenSpec CLI is unavailable. Manual audit confirmed proposal/design/tasks/delta presence, one ADDED operation per delta file, at least one fourth-level Scenario per requirement, and unique names for all four new requirements. No runtime implementation is authorized before approval.

## Forward Call Chains

### Audio and reading playback

1. Canvas audio activates through `AudioNodeContent.tsx:458-488` or the generic canvas click handler `drawnix.tsx:1499-1522`; selected audio also enters at `popup-toolbar.tsx:2277-2319`. Media-library context action builds asset/queue sources at `MediaLibraryGrid.tsx:504-547`. Knowledge note reading starts at `KBNoteEditor.tsx:210-238`; canvas text/card reading starts at `popup-toolbar.tsx:1240-1281`. Music-player queue/list entries call the shared controls at `MusicPlayerTool.tsx:355-364,545-603`.
2. `tool-launch-service.ts:42-72` opens/reuses the registered music-player window, installs canvas/playlist/reading queue metadata, then toggles audio or reading. Direct canvas-node paths call `togglePlaybackInQueue` through `useCanvasAudioPlayback.ts:23-83`.
3. `CanvasAudioPlaybackService` normalizes/deduplicates queues, owns active index/source/media type/mode/rates/volume/timing/error/analysis, and notifies `useSyncExternalStore` consumers (`useCanvasAudioPlayback.ts:13-21,86-97`). Drawnix refreshes the background canvas queue on board changes and calls stop/clear on unmount (`drawnix.tsx:1124-1134`).
4. Audio `togglePlayback` reaches `startPlayback` (`canvas-audio-playback-service.ts:869-930`): reading is cleared, one audio element is created, HTTP(S) URLs are resolved through `cacheRemoteUrl` (`:932-965`), source/metadata/state are written, then `audio.play()` settles. `play/pause/ended/time/metadata/error` listeners update shared state at `:494-599`; analysis is optional and falls back without stopping playback.
5. Reading sources normalize Markdown, language and estimated segments at `reading-playback-source.ts:43-181`; `startReading/beginReadingSegment` owns `SpeechSynthesisUtterance`, a version guard, 250 ms estimated progress, pause/resume/cancel, segments and errors (`canvas-audio-playback-service.ts:795-1100`). Reading speed mirrors `tts.rate`.
6. Shared state renders the music-player tool (`MusicPlayerTool.tsx:660-887`), global overlay (`CanvasAudioPlayer.tsx:333-558`), audio-node feedback, subtitle panel, and error MessagePlugin bridge (`drawnix.tsx:1049-1116`). Mode/audio-rate/layout/position use localStorage; reading rate uses settings storage. Queue/active session itself is memory-only and clears on app ownership teardown.

### Playlist persistence and recovery

1. Music-player tabs/list/context menu and media-library audio cards invoke `AudioPlaylistContext` create/rename/delete/add/remove/favorite methods. Context displays success/error messages and reloads both projections after mutation (`AudioPlaylistContext.tsx:30-147`).
2. `AudioPlaylistService` initializes system `favorites`, reads/sorts metadata, and reads item arrays (`audio-playlist-service.ts:21-103`). Create/rename/delete write metadata and items (`:105-170`); membership/favorite read/replace the full item array and separately update metadata timestamp (`:172-269`).
3. Durable owners are localForage database `aitu-audio-playlists`, stores `audio_playlists` and `audio_playlist_items`. `environment-backup-service.ts:168-207` exports both; replace restore clears both at `:391-420`; import writes both and initializes favorites at `:524-551`.
4. Final visible playlist metadata/membership has one service writer per operation and one Context projection writer. Asset deletion cleanup is called through `removeAssetFromAllPlaylists`, but the asset commit/delete boundary remains owned by the existing media-library consistency change.

## Reverse Trace, State, And Boundaries

- Final active audio metadata is written only by `startPlayback`; reading metadata/segments only by `beginReadingSegment`; stop reset only by `stopAndClear`. All visible player/node/tool states subscribe to that singleton.
- Final audio network/cache work originates only in `resolvePlaybackAudioUrl`; local/blob/data paths skip it. Cache failure logs a warning and returns the original URL. Offline success therefore depends on a usable cached/original URL and was not proven here.
- Final playback errors originate in current/stale `audio.play()` rejection, media error event, unsupported/failed Web Speech, and reach a single Drawnix MessagePlugin bridge. Raw `Error.message` is not persisted by this feature; whether a real browser/provider message contains sensitive data remains unverified.
- Pause/resume/previous/next/modes exist. There is no physical abort signal for cache resolution; stop/clear currently only resets shared state. Retry is user reactivation. Refresh does not resume the memory-only queue/session, while playlists/preferences restore from durable stores.
- Playlist names/items use current public types at `audio-playlist.types.ts:1-115`; no schema version or transaction/journal owner exists. Backup captures both stores and all allowed `aitu:` localStorage player preferences.
- Multi-tab playlist mutation and playback preference live synchronization were not exercised. The new playlist proposal is explicitly limited to proven single-runtime races.
- Permanent tests cover playback modes/queues/audio analysis/reading/rates and three basic playlist cases. `CanvasAudioPlayer.test.tsx` contains one explicit skipped placeholder, so overlay interaction/accessibility has no permanent regression coverage.

## Confirmed Issues

### [F24-PLAY-001]

**Status**: 已证实. **Evidence strength**: deterministic source ordering plus deferred cache mock.

**User impact / reproduction**: start remote track A, then B before A cache resolution; resolve B first and A last. B becomes active, then A replaces it and plays. Current behavior violates the latest click. Expected behavior is that B remains authoritative.

**Call chain / root cause**: any audio entry → queue/control → `togglePlayback` → `startPlayback` → await cache at `:875` → state/media assignment `:882-919` → UI. No request identity exists before the await.

**Range / plan / alternative**: all HTTP(S) audio entries; local URLs skip the proven boundary. Preferred `control-audio-playback-request-lifecycle` adds a monotonic intent check. Merely reordering cache calls or adding `useMemo` cannot establish ownership. Risk is continued obsolete cache work; no cancellation claim. Validate both completion orders, final source/state/queue and current-owner error. Rollback removes counter/checks/tests; no data cleanup.

### [F24-PLAY-002]

**Status**: 已证实. **Evidence strength**: deferred two-attempt `play()` mock.

**User impact / reproduction**: allow A to reach a deferred `audio.play()`, start/complete B, then reject A with a sentinel. B remains named active but becomes `playing=false` and displays A's error. Expected obsolete A settlement cannot mutate B.

**Call chain / root cause**: A/B share one audio element; each `startPlayback` awaits `audio.play()`, and every catch writes current shared state at `:921-929` without attempt identity. Same proposal owns the fix; do not replace the shared audio element without evidence. Validate stale/current rejection, play event, pause/resume and analysis. Rollback is code/test-only.

### [F24-PLAY-003]

**Status**: 已证实. **Evidence strength**: deferred cache mock plus static teardown chain.

**User impact / reproduction**: begin A, call `stopAndClear` while cache is pending, then resolve A. The service reactivates A and plays after the user closed/stopped or Drawnix unmounted. Expected cleared/reading state remains authoritative.

**Call chain / root cause**: close overlay/hook/unmount → `stopAndClear :1487-1514`; pending `startPlayback` retains its stack and later writes. The intent counter must advance on stop/clear and reading activation. Physical cache abort is optional and must not be claimed. Validate close, teardown, reading switch and late settlement. Rollback requires no migration.

### [F24-PLAYLIST-001]

**Status**: 已证实. **Evidence strength**: concurrent in-memory localForage diagnostic.

**User impact / reproduction**: invoke two distinct adds to one playlist concurrently. Both read the same old array, each writes a one-item replacement, and the final durable list contains only 1 of 2 accepted items. Expected both distinct additions persist.

**Call chain / root cause**: UI/context → `addItemToPlaylist` → metadata read → item array read → full replacement `:187-205` → reload. There is no accepted-order mutation owner. Preferred `ensure-audio-playlist-write-consistency` serializes service mutations and reads inside the owner; per-component disabling was rejected because multiple consumers/callers remain. Measure serialization latency. Rollback drains journal then removes owner/tests.

### [F24-PLAYLIST-002]

**Status**: 已证实. **Evidence strength**: concurrent deterministic create diagnostic.

**User impact / reproduction**: concurrently create the same trimmed name; both uniqueness checks complete before either write and two playlists with the same name persist. Expected existing uniqueness rule survives overlapping calls.

**Call chain / root cause**: two Context callers → `createPlaylist :105-124` → independent `listPlaylists` checks → different IDs/two writes. The same mutation owner rechecks inside acceptance order. A database uniqueness index would require a larger migration and is not selected for the proven one-runtime race. Validate create/rename concurrency and same/different names. Cross-tab uniqueness remains unknown.

### [F24-PLAYLIST-003]

**Status**: 已证实. **Evidence strength**: four injected second-store failures with durable-map inspection.

**User impact / reproduction**: fail items write after metadata create, items removal after metadata delete, or metadata timestamp write after item add/remove. Each API rejects and Context reports failure, but durable stores contain a partial result. Expected failure and durable outcome agree and recover across restart.

**Call chain / root cause**: Context operation → service sequential store A/store B → rejection → MessagePlugin error → reload. The two localForage instances have no shared transaction/recovery owner. Preferred proposal keeps schemas and adds a privacy-safe prepared/committed journal plus initialization recovery; simply swapping write order moves the partial failure. Risks are temporary snapshot size, write amplification and recovery correctness. Test every phase/failure, idempotence, backup replace clear, large list cost. Before rollback, recover/drain the journal; legacy records stay intact.

### [F24-PLAYLIST-004]

**Status**: 已证实. **Evidence strength**: isolated jsdom React diagnostic with reversed deferred completions.

**User impact / reproduction**: start reload A, then reload B; complete B with a newer projection and A last with an older projection. The UI first shows B then regresses to A. Expected only the latest reload owns `playlists`/`playlistItems` projection.

**Call chain / root cause**: mutation/mount/manual reload → `loadPlaylists :30-43` → parallel metadata/items reads → unconditional `setPlaylists/setPlaylistItems`. No request generation exists. Preferred same consistency change adds latest-load identity; global event bus or new state library is unnecessary. Validate overlapping success/failure/unmount and messages. Rollback removes owner/tests only.

### [F24-A11Y-001]

**Status**: 已证实. **Evidence strength**: current source plus live Chromium DOM/accessibility snapshot.

**User impact / reproduction**: play/pause a reading, minimize the music-player tool, inspect or tab through the global overlay. Previous, play/pause, next, layout and close appear as empty `button` entries; DOM has no `aria-label`, `title` or text. A screen-reader user cannot identify five existing actions. Expected names match current operations without exposing track/note/private data.

**Call chain / root cause**: shared state → `CanvasAudioPlayer` render `:400-429,511-538` → native icon-only buttons wrapped by visual `HoverTip`; the tooltip wrapper does not name the control. Music-player tool equivalents at `:692-805` are explicitly named. `improve-music-player-control-accessibility` adds localized/state-aware names only. Visible icons/geometry/callbacks stay fixed. Validate accessibility tree, play/pause/layout rerender, disabled buttons, privacy, keyboard/pointer parity and same-state screenshots. Rollback removes labels/tests; no data change.

## Adjacent Fact, Hypotheses, And Blockers

- **Outer WinBox accessibility (confirmed, already owned)**: the player header controls are pointer `SPAN`s with no role/name/tab stop, matching existing `improve-tool-window-accessibility`. F-24 does not duplicate that proposal.
- **Remote cache-before-play latency (hypothesis)**: source proves a wait, but no real asset/cache network sample was available. No faster/slower conclusion or loading-state change is authorized. Validate local synthetic delayed cache and five real authorized cache-hit/miss samples before deciding.
- **CORS/original-URL fallback (hypothesis)**: the element sets `crossOrigin='anonymous'` and cache failure falls back to the original URL. No provider/CORS failure was reproduced; do not change origin policy based on source shape.
- **Raw `Error.message` UX/privacy (hypothesis)**: play rejection can surface its message, but no real sensitive provider/browser error was observed and this feature does not persist it. Test credential-shaped synthetic redaction separately before any safety proposal.
- **Responsive/dark/English/formal E2E (blocked)**: the in-app Browser is fixed at 1280×720; formal Playwright lacks `chromium_headless_shell` revision 1200. Missing 768×1024/390×844, dark, English, zoom/high-DPI, touch, offline and reduced-motion evidence is a test-environment blocker, not a product defect.

## Baseline And Measurements

- Empty desktop: 520×640 player fully inside 1280×720; 0 audio assets, 10 knowledge readings, 0 favorites; play/previous/next disabled until a reading list is selected. Screenshot `empty-desktop-1280x720.png`.
- Local reading: one existing note used only browser SpeechSynthesis; 20 subtitle segments; no provider/network request. Minimize preserved shared queue/progress and global overlay; restoring preserved state. Temporary 1.25x/list-loop selection synchronized across surfaces and was restored to 1x/sequential. Screenshot `paused-reading-overlay-desktop-1280x720.png`.
- Overlay current geometry: 760×50 at x260/y10. Buttons measured 28×28 except primary 32×32; this is raw desktop geometry only, not a compact touch-target defect conclusion.
- Warm restore five samples `[408,552,582,539,514]` ms; median 539, range 408–582. Measurement is page Date elapsed from overlay open-tool click until the existing WinBox left minimized state, with warm app/tool, normal network/CPU and Browser polling overhead. No cold/before-after data, so no performance improvement claim.
- Isolated diagnostics: playback/playlist 2 files/9 tests exit 0 (2.01 s); Context 1/1 exit 0 (5.03 s). All storage/cache/media/speech boundaries mocked. Temporary tests deleted and absence verified exit 0.
- Permanent default-node run: exit 1; 3 files = 1 failed, 1 passed, 1 skipped; 21 passed, 2 failed, 1 skipped. Both failures are localStorage persistence assertions in an environment where `localStorage is not defined`, so classified test environment. With jsdom: exit 0, 20 passed/1 skipped; missing IndexedDB emitted configuration-writer noise. Playlist service's 3 tests passed. `CanvasAudioPlayer` remains an explicit skipped placeholder.
- Drawnix typecheck equivalent command via bundled Node/tsc: exit 0, no diagnostics, approximately 36 s. Targeted ESLint for 13 chain files: exit 1, 22 existing problems (1 `@nx/enforce-module-boundaries` error on `@aitu/utils`; 21 warnings). No runtime file changed, so no new regression.
- OpenSpec strict validation: 3 commands, each exit 127. CLI unavailable; manual format/scenario/name/conflict audit complete.

## Exit Review

- Complete feature boundary and forward/reverse chain: documented.
- Confirmed facts vs hypotheses/blockers: separated.
- Runtime/style/permanent tests/storage/user data: unchanged.
- Current positive desktop reading/minimize/shared-preference flow: verified with local browser API only.
- Confirmed correctness/storage/a11y fixes: blocked by three new OpenSpec approvals; outer window remains blocked by two existing F-15 changes.
- Performance optimization/visual redesign: none; no improvement claim or post-fix screenshot.
- Responsive/dark/English/offline/formal E2E and cross-tab writes: blocked or unknown.
- Rollback: delete the three new change directories, this evidence directory and ledger entries. No runtime state, migration, provider request, cache cleanup, playlist/note mutation, or user data recovery is required.
