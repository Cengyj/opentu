# Change: Allow Banana Prompt Clipboard Write

## Why

The reachable Banana Prompt manifest describes the tool as allowing users to view and copy AI prompts. Its current public bundle uses `navigator.clipboard.writeText()` whenever the Clipboard API exists in a secure context. The fallback based on `document.execCommand("copy")` runs only when that API is absent or the context is not secure; a rejected `writeText()` call is caught and logged without invoking the fallback.

The WinBox external-tool iframe has no `allow` attribute. A five-sample local cross-origin Chromium 149 probe, with browser permissions granted to the child origin, reported `clipboard-write` as disallowed by Permissions Policy and the permission state as `denied` in every iframe without `allow`. The otherwise identical write-only iframe reported `clipboard-write` allowed/prompt and `clipboard-read` disallowed/denied in all five samples. The probe did not call the Clipboard API and did not read or write the system clipboard.

Granting a cross-origin iframe a browser feature permission changes a user-visible security boundary, so implementation requires approval. The minimum confirmed permission is write-only and only for Banana Prompt in a WinBox.

## What Changes

- Allow an external built-in tool manifest to declare the browser features required by its WinBox iframe.
- Declare only `clipboard-write` for Banana Prompt; do not grant `clipboard-read`.
- Keep the WinBox `allow` attribute absent for Chat-MJ, Pose Library, custom URL tools, and every tool without an explicit declaration.
- Preserve the current iframe sandbox tokens, URL, dimensions, lifecycle, window state, analytics, and external-network behavior.
- Do not change the canvas iframe's existing feature policy or any serialized board/catalog data in this change.
- Treat the declaration as a parent Permissions Policy allowance, not a promise that the browser, operating system, user activation state, or external page will always complete a clipboard write.

## Impact

- Affected specs: new `external-tool-clipboard-permission` capability
- Affected code: `ToolDefinition`, the Banana Prompt built-in manifest, the WinBox external iframe renderer, focused manifest/renderer tests, and F-21 documentation
- Security boundary: one cross-origin built-in WinBox receives `clipboard-write`; no iframe receives clipboard read access from this change
- Data/API impact: no storage schema, migration, cache key, network API, provider routing, task, workflow, or analytics schema change
- Related changes: `secure-external-tool-credential-launch` owns credential destination/preflight; `improve-external-iframe-load-recovery` owns iframe lifecycle feedback; neither owns Feature Policy permissions
- Rollback: remove the manifest declaration, renderer projection, type field, and focused tests; no data recovery or migration is required

## Evidence

- `packages/drawnix/src/tools/built-in-manifests.tsx:126-134` registers Banana Prompt and describes viewing and copying prompts.
- `packages/drawnix/src/components/toolbox-drawer/ToolWinBoxManager.tsx:418-427` renders the WinBox iframe with `src`, `title`, `style`, and `sandbox`, but no `allow` attribute.
- `packages/drawnix/src/components/tool-element/tool.generator.ts:540-581` is a separate canvas renderer and currently assigns `allow="clipboard-read; clipboard-write"`; this change does not modify that path.
- Public document capture: `https://www.aiwind.org/` returned HTTP 200, 453,805 bytes, SHA-256 `f8ac33b15e2fbdc3b4837be393944149df98cbea70ea98e8d4088ed53faec1d2`, with 20 scripts.
- The copy implementation was in `/_next/static/chunks/f03595ad43de9b1b.js`, SHA-256 `8a38595cdff445d292a42526bbd4463dd0b63c30d29e85c6e99958453cbf5b73`, at offsets 29297-29677. Its rejected `writeText()` branch logs and exits instead of entering the fallback.
- Chromium `149.0.7827.55`, five fresh pages: iframe without `allow` reported write policy false/denied 5/5; `allow="clipboard-write"` reported write true/prompt and read false/denied 5/5; the existing canvas-style read/write control reported both true/prompt 5/5. A direct top-level positive control reported both true/granted.
