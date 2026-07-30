## Context

F-21 covers the complete user intent of opening one of the existing external iframe tools and using it inside Opentu. Banana Prompt is a reachable built-in URL tool whose product description explicitly includes copying prompts. Its public implementation selects the asynchronous Clipboard API in a secure context. The WinBox renderer does not project any Permissions Policy declaration, so Chromium rejects the write before the external page can complete its own copy flow.

The canvas renderer has an independent, currently broad `clipboard-read; clipboard-write` policy. That difference was an investigation signal, not authorization to standardize both surfaces. This change owns only the confirmed WinBox failure and leaves the canvas contract unchanged.

## Goals / Non-Goals

### Goals

- Remove the parent-frame Permissions Policy block from Banana Prompt's existing WinBox copy flow.
- Grant only the confirmed `clipboard-write` feature and only to the Banana Prompt manifest.
- Express the grant as typed manifest data rather than an ID-specific renderer exception.
- Keep all undeclared external WinBox tools fail-closed with no `allow` attribute.
- Add regression tests for the positive declaration and the negative/default cases.

### Non-Goals

- Clipboard read access.
- A generic permission editor for custom tools.
- Changes to iframe sandbox tokens, navigation, credential handling, lifecycle feedback, external content, or browser permission prompts.
- Changes to the canvas iframe's existing `allow` attribute or serialized tool metadata.
- Guaranteeing copy success when user activation, browser/OS permission, page code, or the external site independently refuses it.

## Decisions

### 1. Use an optional typed WinBox feature-permission declaration

Add an optional manifest field for the WinBox iframe features a tool requires. The renderer serializes a non-empty declaration into the iframe `allow` attribute and omits the attribute otherwise.

This keeps permission ownership beside the existing URL and sandbox declaration and avoids a renderer branch keyed to `banana-prompt`. The field remains runtime manifest data; this change does not copy it into `PlaitTool` metadata or persistent custom-tool records.

### 2. Banana Prompt receives write-only access

The Banana manifest declares exactly `clipboard-write`. The public bundle evidence proves a write call and contains no evidence that its copy action needs clipboard read. Chat-MJ, Pose Library, and user-authored custom tools receive no declaration from this change.

### 3. Preserve the sandbox and canvas boundaries

Permissions Policy and sandbox permissions are distinct browser controls. The existing five Banana sandbox tokens remain unchanged. The canvas renderer's existing `clipboard-read; clipboard-write` behavior is explicitly outside this change to avoid combining a confirmed WinBox repair with an unmeasured canvas security-policy change.

### 4. Test the parent policy contract without touching the system clipboard

Permanent unit/component tests verify the rendered attributes and negative cases. A local cross-origin browser fixture verifies `allowsFeature('clipboard-write')`; it does not need to call `writeText()` or inspect clipboard contents. Manual external verification may click Banana's own copy control only after approval, in an isolated browser profile with a non-sensitive prompt, but it is not required to establish the parent policy contract.

## Invariants

- Banana's tool ID, name, URL, dimensions, category, sandbox, opening/minimize/restore/pin behavior, and request count remain unchanged.
- Undeclared WinBox tools render without an `allow` attribute.
- No `clipboard-read` token is introduced by this change.
- Canvas tool serialization, restore, refresh, and current Feature Policy remain unchanged.
- No task, workflow, provider, cache, storage, analytics, or migration path changes.

## Risks / Trade-offs

- The external origin gains the ability to request clipboard writes while embedded in Banana's WinBox. Restricting the declaration to one manifest and write-only access is the least-privilege boundary supported by the confirmed use case.
- External bundle behavior can drift. Renderer tests protect Opentu's policy contract; evidence records the audited public content hashes and does not claim permanent control over the third-party page.
- A browser may still deny a write because of user activation or platform permission. UI/error ownership remains with the external page; the specification does not promise unconditional success.
- A future developer could reuse the manifest field too broadly. Negative tests for undeclared built-ins and a documented permission-review requirement reduce that risk.

## Alternatives Considered

- **Add `allow="clipboard-read; clipboard-write"` to every WinBox iframe**: rejected because no read requirement or cross-tool need was proven.
- **Hard-code `tool.id === 'banana-prompt'` in the renderer**: rejected because it hides the security grant away from the manifest and is harder to audit.
- **Rely on Banana's legacy fallback**: rejected because its current secure-context branch does not run the fallback after `writeText()` rejection.
- **Change the canvas policy in the same patch**: rejected because canvas already follows a different path and narrowing it requires independent reachability and behavior evidence.

## Verification And Rollback

- Red/green renderer tests: Banana has exactly `clipboard-write`; Chat-MJ, Pose, and an undeclared custom URL have no `allow`; no rendered value contains `clipboard-read`.
- Manifest/type tests: only Banana declares the new field; current sandbox arrays and URLs are byte-for-byte unchanged.
- Five fresh-page local cross-origin policy samples after implementation, recording engine, origins, raw policy/permission states, and the fact that the Clipboard API was not called.
- Focused Drawnix tests, typecheck, targeted lint, then repository-wide verification compared with the recorded baseline.
- Browser recheck of Banana open/minimize/restore/reopen and the existing canvas behavior; no provider or paid task is invoked.
- Roll back the type field, one manifest declaration, renderer projection, and focused tests together. No persisted data, cache, or user content needs restoration.

