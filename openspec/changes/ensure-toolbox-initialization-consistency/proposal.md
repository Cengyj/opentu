# Change: Ensure Toolbox Initialization Consistency

## Why

`ToolboxService` starts an asynchronous localForage read in its constructor but exposes only synchronous catalog reads and does not expose or await the initialization boundary before mutations. A controlled diagnostic held the initial read, successfully added a custom tool, and then released an older stored snapshot. The late read removed the accepted tool from memory while the last persisted write still contained it.

Reachable consumers also have no initialization boundary. The drawer and pinned launcher read the catalog synchronously and receive no completion notification.

These behaviors can hide persisted custom tools or lose an accepted in-session mutation when storage initialization is slower than the caller. Correcting the readiness and persistence semantics is user-observable and crosses storage/recovery boundaries, so implementation requires approval. The uncalled `useToolFromUrl.ts` hook was removed as a separate no-behavior cleanup after full-repository reference search and a direct `?tool=prompt-history` browser check both proved that it was not a production entry. GitHub `toolSyncService` is also excluded: it is called only by `SyncEngine.syncPaged()`, and full-repository reference search found no caller for `syncPaged()`; the reachable `SyncEngine.sync()` path does not invoke tool synchronization.

## What Changes

- Give the custom-tool catalog one explicit, shared asynchronous initialization boundary instead of constructor fire-and-forget plus elapsed-time guesses.
- Ensure the reachable add and remove operations do not read or mutate a provisional catalog before initialization has settled successfully; retained internal persisted mutations use the same service invariant without being presented as separate user features.
- Refresh the open toolbox after the persisted custom-tool catalog becomes ready while keeping built-in tools immediately available.
- Make pinned custom-tool launchers wait for actual catalog readiness rather than a provisional empty list.
- On storage initialization failure, preserve the existing built-in catalog, do not overwrite an unread custom-tool snapshot, and surface the failure through the existing caller feedback/logging boundary.

## Impact

- Affected specs: `toolbox-plugin-runtime`
- Affected code: `packages/drawnix/src/services/toolbox-service.ts`, `packages/drawnix/src/components/toolbox-drawer/ToolboxDrawer.tsx`, `packages/drawnix/src/components/toolbar/minimized-tools-bar/MinimizedToolsBar.tsx`, and focused tests
- Preserved storage/API data: localForage key `aitu:custom-tools`, storage version `1.0`, tool IDs/manifests, URL templates, permissions, pin keys, and analytics payload schemas remain unchanged
- User-visible trade-off: operations that require persisted custom tools wait for the actual local read; built-in tools remain usable immediately

## Evidence

- `packages/drawnix/src/services/toolbox-service.ts:34-37` starts `initialize()` without retaining its promise.
- `packages/drawnix/src/services/toolbox-service.ts:66-90` assigns a loaded snapshot directly to `this.customTools`; `:115-183`, `:233-277` accept mutations without waiting for that read.
- Controlled Node 24.14.0 / Vitest 3.2.4 diagnostic: hold initial `getItem`, call `addCustomTool`, release a prior snapshot. The accepted tool was then absent from `getToolById`, while the captured persisted snapshot contained only the accepted tool; 1/1 test passed, exit 0. The temporary diagnostic was deleted.
- `packages/drawnix/src/components/toolbox-drawer/ToolboxDrawer.tsx:304-354` memoizes synchronous catalog reads using only local React filters/refresh state; the service emits no initialization completion signal.
- Before deletion, `packages/drawnix/src/hooks/useToolFromUrl.ts` had no production import/call outside its own comment/declaration; application Chromium at 320×568 retained `?tool=prompt-history` and opened no window. Its separate fixed-delay diagnostic was not product evidence, so the uncalled file was removed rather than included in this behavior change.
- `packages/drawnix/src/services/github-sync/tool-sync-service.ts` is imported only by `sync-engine.ts`; its sole call is inside `syncPaged():2463-2537`, and full-repository search finds no `syncPaged()` caller. That provisional-read path is not a reachable existing feature and is excluded.

## Approval

Implementation is blocked until the user approves the readiness, failure, and mutation-order semantics in this change.
