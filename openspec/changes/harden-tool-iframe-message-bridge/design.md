## Context

The bridge is a privilege boundary between untrusted iframe documents and host
canvas/task operations. A string `toolId` is not an identity because any frame
can forge it, and a persisted tool definition is untrusted because canvas and
toolbox data can be imported. Browser-provided `MessageEvent.source` and
`MessageEvent.origin`, matched against an iframe registered by the live
renderer, provide the required runtime identity.

## Goals / Non-Goals

- Goals:
  - Reject forged, stale and cross-origin messages before deduplication or any
    handler runs.
  - Keep exactly one bridge listener per board while canvas tool renderers are
    live, and retain no listener after the last renderer is destroyed.
  - Require an explicit trusted manifest capability for every host mutation or
    billable action.
  - Ensure replies cannot be delivered to another origin.
  - Use one deterministic HTTP(S)-only URL policy for all toolbox data paths.
  - Keep provider credentials out of the generic iframe initialization channel.
- Non-Goals:
  - Change the Chat-MJ URL template or external page credential behavior.
  - Add CSP/frame-src policy, redesign sandbox permissions or add a consent UI.
  - Change task routing, image-generation semantics, tool window lifecycle or
    imported data formats.

## Decisions

- The lazily loaded ToolGenerator acquires a synchronous board-scoped bridge.
  Concurrent/live generators share that runtime through reference counting.
  The last release destroys the service (including its global `message`
  listener and pending, handler, dedupe and iframe-registration maps) and
  removes the cached runtime from the board, so a later tool can create one
  clean replacement.
- The renderer registers `{ toolId, iframe, capabilities }` with the bridge.
  Registration resolves an exact non-opaque HTTP(S) origin. Messages must match
  a connected current iframe's `contentWindow` and origin before their message
  ID enters the bounded dedupe set. `iframe.isConnected` is checked even if an
  explicit unregister is delayed by teardown ordering.
- `tool:ready` is the only capability-free inbound command. Insert text, insert
  image, request data, close and generate image each map to a distinct manifest
  capability. Replies may resolve only an existing pending host message and
  still require the same registered source and origin.
- Capabilities come from a built-in registry manifest only when the live canvas
  element's current `toolId` and URL exactly match that manifest's iframe
  definition. Persisted capability fields and custom tools grant no capability.
  A URL, component or manifest-identity change first unregisters and stops the
  old iframe, clears its cache entry, then creates/registers the replacement;
  an invalid replacement remains unregistered.
- `sendToTool` uses the registered iframe directly and its exact origin; it does
  not query the DOM and never uses `'*'`.
- `board:init` contains only `boardId` and theme. Provider key, base URL and
  model are not part of the generic bridge contract.
- A pure URL-policy helper resolves absolute or relative input against the
  application base and accepts only a syntactically valid final `http:` or
  `https:` URL. Toolbox add/update/import and iframe rendering consume that
  helper, so `javascript:`, `data:`, `file:`, `blob:` and malformed URLs fail
  before navigation while valid relative local tools remain supported.

## Invariants

- A rejected source, origin, type, payload or capability invokes zero host
  handlers and creates zero image tasks or provider requests.
- A rejected message ID cannot poison deduplication for a later valid message.
- Registration and teardown do not persist runtime windows, origins or
  capabilities.
- A board has at most one live bridge service regardless of its iframe count;
  after the final ToolGenerator release it has zero bridge listeners and no
  cached runtime. A stale or duplicate release cannot destroy a newer runtime.
- A detached iframe cannot invoke a handler even during a teardown/replacement
  race, and an old capability set cannot survive a URL, component or manifest
  identity change.
- Authorized requests continue through the existing single image task handler;
  this change adds no second executor, router or result parser.
- No provider credential, full settings payload or image bytes enter bridge
  diagnostics or initialization messages.

## Risks / Trade-offs

- A third-party tool that previously relied on an undocumented host mutation
  will now be rejected unless a trusted built-in manifest explicitly grants the
  exact capability.
  - This is intentional least privilege; tests prove the trusted path continues
    through the unchanged handler.
- An imported tool may reuse a built-in ID.
  - Runtime capability resolution also matches the trusted manifest definition,
    not the ID alone.
- URL validation at import can encounter legacy malformed records.
  - Reject only the unsafe record at the centralized boundary and preserve all
    valid records; do not rewrite or migrate unrelated toolbox data.

## Verification And Rollback

- Unit tests cover forged/detached source, wrong origin, dedupe poisoning,
  unsupported envelope/payload, unauthorized and authorized capabilities,
  exact outbound origin, iframe replacement teardown, shared-runtime reference
  counting, secret-free init and URL policy across all consumers.
- Existing tool image-generation handler/runtime tests prove task behavior after
  authorization, including closed-tool zero-submit and exact bridge replies.
- The touched-scope run passed 6 focused files / 45 tests with focused lint at
  zero errors. Final verification passed `pnpm test` with 292 files / 2,218
  tests (2,217 passed, 1 skipped, 0 failed), Drawnix and Web typecheck,
  `check:cycles` with zero cycles, `git diff --check`, and
  `NX_DAEMON=false pnpm exec nx build web`, all with exit 0. The final startup
  graph was 1,941,175B, `drawnix-app` was 481,924B, every single startup asset
  was at or below 512,000B, and startup analyzer 9/9, release static 44/44 and
  manual contract 14/14 passed. Full-repository lint remains exit 1 at 433
  errors / 2,441 warnings versus HEAD's 439 / 2,471, with zero new diagnostics.
- `openspec validate harden-tool-iframe-message-bridge --strict` cannot run in
  the current environment: `openspec: command not found` (exit 127). Strict
  validation therefore remains explicitly incomplete.
- Rollback bridge registration/capabilities/URL policy and their tests together;
  no data migration or cache operation is required.
