## Context

The built-in manifest list is synchronous, while custom tools are loaded from localForage. Today both are presented through one synchronous service even though only one side is ready at construction time. Mutations can therefore operate on a provisional empty array, and consumers use render timing or a 100 ms timer as a substitute for storage readiness.

## Goals / Non-Goals

- Goals:
  - Establish one initialization result shared by all custom-tool consumers.
  - Prevent a late initialization read from overwriting an accepted mutation.
  - Prevent launcher flows from treating a provisional catalog as authoritative.
  - Preserve immediate access to built-in tools and all existing persisted formats.
- Non-Goals:
  - Do not redesign the toolbox drawer, custom-tool form, registry, window service, iframe permissions, or pinning model.
  - Do not add cloud storage, new tool types, retries, migrations, optimistic conflict resolution, or cross-tab synchronization.
  - Do not change manifest IDs, URL templates, analytics schemas, or localForage keys.
  - Do not revive or redesign the unreachable `syncPaged()` / GitHub custom-tool synchronization path.

## Decisions

- Decision: retain one initialization promise/result in `ToolboxService` and expose a typed readiness method for consumers that require custom tools.
  - Alternative: poll `isInitialized` or increase the 100 ms delay.
  - Rejected because: elapsed time does not establish that IndexedDB succeeded and cannot prevent a late overwrite.
- Decision: asynchronous persisted mutations wait for successful initialization before reading or changing `customTools`.
  - Alternative: accept mutations immediately and replay them after the read.
  - Rejected because: replay requires a new mutation journal and conflict rules; waiting is smaller and these public mutation APIs are already asynchronous.
- Decision: built-in catalog reads remain synchronous, while the drawer performs one readiness-triggered refresh for custom entries.
  - Alternative: make every catalog getter asynchronous and block the entire drawer.
  - Rejected because: this expands the public API and delays built-in tools that require no IndexedDB state.
- Decision: an initialization read failure is remembered. Persisted mutations do not write a provisional empty catalog; reachable callers receive the failure through their existing error/message boundary.
  - Alternative: swallow the read failure and allow later writes.
  - Rejected because: a transient unreadable store could then be overwritten with an incomplete catalog.
- Decision: pinned custom launchers await the same readiness result before resolving their full tool definition.
  - Alternative: poll the synchronous catalog getter.
  - Rejected because: readiness already provides the exact completion signal and polling adds duplicate lookup states.

## Invariants

- Built-in tools remain available before, during, and after custom catalog initialization.
- A mutation that resolves successfully is represented in both the in-memory catalog and the completed persisted write.
- A late initialization callback cannot overwrite a mutation that has started against an initialized catalog.
- Initialization failure does not trigger `setItem` with a provisional/empty custom catalog.
- `aitu:custom-tools` version/key/schema, pin keys, and tool definitions remain compatible.
- No raw custom URL, credentials, or API key is added to analytics or new error messages.

## Risks / Trade-offs

- Slow IndexedDB delays custom-tool mutations and persisted custom-launcher resolution by the same duration; built-in tools remain immediate.
- A remembered initialization failure makes custom-tool writes fail instead of risking overwrite. Existing UI feedback/logging must distinguish this environmental failure without leaking stored content.
- Consumers can accidentally continue using provisional synchronous getters; focused reverse-call tests must cover every production caller.
- StrictMode or repeated drawer mounts could attach duplicate completion work; the readiness promise must be idempotent and refresh only mounted consumers.

## Verification

- Service tests hold/resume the initial read and cover reachable add/remove ordering, retained internal mutation invariants, read failure, duplicate readiness calls, and storage snapshots.
- Drawer tests prove built-ins render immediately and persisted custom tools appear once readiness resolves without filter interaction.
- Launcher tests prove catalog reads occur after readiness and initialization failure does not resolve a provisional catalog as a launchable custom tool.
- Re-run tool-window tests, Drawnix typecheck/lint, full typecheck/unit/cycles/build/size/startup, and available toolbox smoke/feature/visual/responsive flows.

## Rollback

- Remove the readiness result/method, consumer awaits/refresh, and focused tests.
- No database, localStorage, tool manifest, or canvas migration is required; all existing custom-tool records remain in the unchanged `1.0` format.
