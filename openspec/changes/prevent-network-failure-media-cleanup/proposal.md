# Change: Prevent network failure from deleting canvas media

## Why

The reachable application-menu action is named “Clean Invalid Media”, but its URL probe currently maps two rejected fetches to `false` and immediately removes the corresponding canvas element. A deterministic jsdom diagnostic with one remote image and synthetic network rejection recorded two calls (`HEAD`, then `GET`), one `Transforms.removeNode`, an empty board, and the success message “Cleaned 1 invalid media”. Network unavailability does not establish that the media URL is invalid, so the current boolean boundary can turn offline, transient network, DNS, CORS, or browser-policy failure into user-content deletion. A second diagnostic held a 404 response pending, inserted a new element at index 0, and then resolved the scan: cleanup removed stale path `[0]`, deleting the new element while preserving the scanned image.

The removal enters Plait history and the application autosave chain, so the incorrect classification is durable unless the user notices and undoes it before leaving. Correcting that classification and feedback changes visible deletion/offline behavior and therefore requires approval before implementation.

## What Changes

- Replace the internal boolean URL result with an explicit `valid` / `invalid` / `unknown` outcome and a non-sensitive reason suitable for aggregate UI feedback and diagnostics.
- Delete a canvas media element only after a definitive invalid result. Preserve it when network reachability, cross-origin policy, method support, server availability, or another probe boundary leaves validity unknown.
- Treat `blob:` and `data:` URLs as the current valid fast paths; retain the existing successful opaque-response compatibility path.
- Do not treat an unsupported or inconclusive `HEAD` response as proof of invalidity. Use the bounded fallback probe only when it can improve classification.
- Report confirmed removals separately from preserved unknown items, and keep the action retryable by running the existing command again after connectivity recovers.
- Preserve the existing Plait operation/history and workspace autosave paths for confirmed removals. Do not introduce a new store, migration, background monitor, automatic retry, cache purge, or provider/network service.
- Add focused tests for valid, definitively invalid, unknown/offline, CORS/method fallback, mixed-result, duplicate activation, history/autosave adjacency, and localized feedback, followed by same-state browser verification.

## Impact

- Affected specs: new `canvas-media-cleanup-safety`
- Affected code: `packages/drawnix/src/components/toolbar/app-toolbar/app-menu-items.tsx`, F-29 focused tests, and F-29 evidence/documentation
- Related boundaries: `ensure-media-library-write-consistency` covers asset-library metadata/cache transactions, not this canvas menu action; F-03 owns workspace persistence, which this change must preserve; F-06/F-13 own media rendering/cache availability, not cleanup classification
- Data/storage impact: no board, element, cache, workspace, backup, `.drawnix`, task, asset, localStorage, IndexedDB, or migration format change. Confirmed invalid elements continue through existing remove operations; unknown elements are intentionally no longer deleted.
- Network impact: no new endpoint or credential. The current bounded HEAD/GET strategy is retained with safer classification; request contents and URL privacy must not be added to analytics or user-visible diagnostics.
- Rollback: revert the tri-state classifier, aggregate feedback and focused tests together. No migration or cache cleanup is required, but rollback restores the verified risk that a network failure can delete canvas media.

## Evidence

- Reachable entry: `packages/drawnix/src/components/toolbar/app-toolbar/app-toolbar.tsx:89-93`.
- Probe: `packages/drawnix/src/components/toolbar/app-toolbar/app-menu-items.tsx:326-368` returns `false` after HEAD and GET both reject; a non-OK HEAD also returns immediately without distinguishing absence, method rejection, authorization, or temporary server failure.
- Destructive sink: `packages/drawnix/src/components/toolbar/app-toolbar/app-menu-items.tsx:373-444` maps every `false` result to `invalidElements`, calls `Transforms.removeNode`, then reports the elements as invalid media.
- Persistence chain: `@plait/core` `Transforms.removeNode` calls `board.apply`; `packages/react-board/src/wrapper.tsx:191-193,87-97` forwards the after-change snapshot; `apps/web/src/app/app.tsx:721-769` saves it through `WorkspaceService.saveCurrentBoard`; `packages/drawnix/src/services/workspace-service.ts:951-989` persists it and emits `boardUpdated`.
- Network diagnostic environment: Node `v24.14.0`, Vitest `3.2.4`, jsdom, one synthetic remote image, `fetch` rejected with `TypeError('synthetic network unavailable')`; no real network, storage, clipboard, or user board was accessed. Command with `vite.config.ts`: exit 0, 1/1 file and 1/1 test, 72 ms test, 1.66 s process report.
- Index-race diagnostic under the same environment: initial IDs `['target-image','existing-shape']`; after the request began, `concurrent-new-shape` was inserted at index 0; resolving HEAD as readable 404 produced one removal at `[0]`; final IDs were `['target-image','existing-shape']`. Exit 0, 1/1 file and 1/1 test, 68 ms test, 1.65 s report.
- Permanent coverage search found no direct app-menu import/export or invalid-media cleanup test. Both diagnostic files were deleted after recording the results.
