## Context

URL templates intentionally keep `${apiKey}` unresolved in catalog/canvas persistence and substitute only at iframe render time. That protects exports and storage, but does not decide whether a built-in third-party origin is authorized to receive the credential. Launch validation is split between drawer UI handlers and render/service boundaries, so alternate entries do not share one invariant.

## Goals / Non-Goals

- Goals:
  - Prevent silent delivery of the application's provider credential to the built-in Chat-MJ origin.
  - Make missing-sensitive-variable behavior consistent for all existing launch and render paths.
  - Preserve user-authored custom URL templates, unresolved persistence, and successful tool lifecycle semantics.
- Non-Goals:
  - Add a new credential vault, proxy, provider, trust registry, or external-tool account flow.
  - Claim that the current third-party page is malicious or that a real key has been misused.
  - Redesign custom-tool authoring, iframe sandbox permissions, loading recovery, or outer WinBox accessibility.

## Decisions

- Replace the Chat-MJ built-in URL with its credential-free external route; do not include global provider key/base URL data in query, fragment, path, DOM attributes, logs, analytics, or persistent state.
- Keep the custom-tool `${apiKey}` option because its authoring UI already identifies the value and warns the user to trust the destination. This change does not broaden that option to built-ins.
- Add a pure sensitive-template preflight result used at both state-creation and canvas-render boundaries. It reports only a stable reason/variable name, never the resolved value or raw URL.
- `openTool()` and `openNewToolInstance()` reject before pin/state/analytics mutation when a required sensitive value is missing. Existing callers handle the current `undefined`/new optional result with localized settings guidance.
- Drawer insertion checks before `ToolTransforms.insertTool()`. Persisted canvas rendering and settings refresh do not assign `iframe.src` while a sensitive value is missing.
- Canvas-to-popup attempts window creation before removing the canvas element; removal occurs only after a non-rejected open result.
- Tests use sentinel settings and synthetic tools only. No real settings storage, browser credential, external request with a key, or analytics payload is inspected.

## Invariants

- Catalog and canvas serialization retain original template strings and never persist resolved secrets.
- A rejected launch creates no iframe request, window state, pin mutation, canvas deletion, or “actually used” analytics event.
- A configured user-authored custom URL follows the same successful lifecycle as before.
- Chat-MJ, Banana Prompt, and Pose Library remain reachable external iframe tools with their existing names, categories, default geometry, and sandbox declarations.

## Risks / Trade-offs

- Chat-MJ users lose automatic reuse of the Opentu provider key.
  - Preserve the credential-free external shell and document that external-page configuration is separate; do not create a second Opentu credential field in this change.
- A service-level rejection can leave callers silent.
  - Require caller tests for drawer, launcher, context new-window, and canvas popup feedback, plus a service invariant test.
- Canvas settings refresh can retain a previously resolved key in an already-loaded document after the key is removed.
  - On settings change, replace the iframe with the safe missing-configuration state rather than retaining or reassigning the sensitive URL.
- Other active toolbox changes may touch window state or accessibility.
  - Keep preflight orthogonal to registry, viewport, focus, title-control, and catalog-readiness contracts.

## Verification And Rollback

- Unit/component tests cover sentinel non-delivery for built-ins; configured/missing custom templates; drawer window/insert; launcher click/new-window; canvas initial render/settings refresh/popup; no state deletion/mutation/analytics on rejection.
- Static assertions ensure raw key/sentinel never reaches built-in manifest output, iframe attributes, logs, accessible names, analytics, or persistence.
- Browser-check Chat-MJ credential-free open and missing custom-template feedback with synthetic settings only.
- Run focused tests, Drawnix/full typecheck, lint, full tests, cycles, build, size, startup, and available E2E against baseline.
- Roll back manifest/preflight/callers/tests together; no migration, cache deletion, or historical-data cleanup is required.

