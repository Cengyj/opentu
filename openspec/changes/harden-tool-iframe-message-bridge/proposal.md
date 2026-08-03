# Change: Harden Tool Iframe Message Bridge

## Why

The canvas tool bridge accepted `postMessage` data by `toolId` alone, looked
the iframe up through a DOM selector, sent replies with `targetOrigin = '*'`,
and delivered provider configuration in the generic `board:init` payload.
Current production callers also allowed an iframe message to reach canvas
mutation handlers or create a potentially billable image task without proving
which registered frame and origin sent it. Imported canvas metadata can contain
arbitrary tool identifiers and URLs, so persisted metadata cannot be treated as
an authorization source.

The toolbox URL write boundaries were inconsistent as well: add/update used a
prefix check while import and canvas render did not share the same URL policy.
Malformed or non-network schemes therefore could reach a renderer through a
different entry.

## What Changes

- Register the exact connected iframe window and its resolved origin before
  accepting bridge messages. Unregister and stop the previous iframe before a
  URL/component/manifest-identity replacement as well as renderer destruction.
- Validate every inbound envelope before deduplication; require the registered
  connected frame, `event.source`, exact `event.origin`, supported message type
  and explicitly trusted manifest capability for host mutations or image
  generation.
- Send host-to-tool messages only to the registered iframe's exact origin.
- Keep `board:init` limited to non-secret board identity and theme data.
- Make external and user-authored tools capability-free by default; persisted
  capability fields are never an authority. Capabilities are read from the live
  built-in registry only when the current element's manifest ID and URL match.
- Apply one final-HTTP(S) URL policy at add, update, import and render
  boundaries, preserving relative local URLs that resolve to the application
  HTTP(S) origin.
- Load the iframe bridge with the first canvas ToolGenerator, share one
  synchronous board-scoped service across live generators, and destroy its
  global listener/cache when the last generator releases it.

## Impact

- Affected specs: `toolbox-plugin-runtime`
- Affected code: lazy canvas ToolComponent/ToolGenerator runtime, tool
  communication types/service, toolbox persistence/import, tool
  image-generation bridge and focused tests
- Preserved behavior: internal tools, window lifecycle, canvas geometry,
  sandbox declarations, custom-tool persistence, provider routing and task
  execution remain unchanged after an authorized message reaches the existing
  handler
- Data impact: no schema change or migration; invalid imported URLs are rejected
  at the existing read/write/render boundaries instead of being normalized or
  rewritten
- Related but excluded change: `secure-external-tool-credential-launch` owns the
  Chat-MJ URL-template credential decision and remains unimplemented here
