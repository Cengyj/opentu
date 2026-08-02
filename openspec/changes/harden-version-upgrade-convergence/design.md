# Design: Version upgrade and release convergence

## Context

Version convergence has three distinct authorities that currently do not form one explicit state machine:

- bootstrap and the Service Worker know committed, pending, waiting, and activation state;
- a deferred UI consumes a page event and decides whether any update action is visible;
- task storage exposes persisted statuses that may or may not correspond to a live executor.

The current consumer treats `activeTasks.length > 0` as sufficient to render nothing. The controlled Chromium timeline proves this can suppress a ready update even when no live execution owner has been established. Separately, the deployed BusyBox server emits no cache policy for version-sensitive files, so correct release bytes do not guarantee timely browser revalidation.

## Current Implementation Boundary

The current change state already implements the page-local `releaseId` runtime, authoritative replace/clear and metadata fencing, deferred prompt replay, per-release confirmation latch, retryable missing-worker state, dedicated approved-activation reload, Service Worker release-state compatibility boundary, release-scoped caches, manifest identity checks, production-only explicit commit handling, `updateViaCache: 'none'`, no-store metadata fetches, pinned Nginx configuration, release-contract/gate tooling, prior static-cache retention, and independently versioned automatic image-routing evidence.

Task ownership convergence is intentionally only conservative at this point. The prompt remains visible when active tasks exist, labels them `unknown-authority(reason='projection-unavailable')`, and disables normal confirmation. The dispatch-token/session-heartbeat and remote-query-lease projections needed to distinguish `live`, `recovering`, `stale-orphan`, `storage-error`, and `inconsistent-state` have not been implemented. Consequently, the reason-complete blocker UI, background-throttling classification, and authoritative stale reconciliation remain design targets rather than current-code facts.

No terminate-and-upgrade action, production forced activation/navigation bridge, or `clients.navigate` behavior is implemented. `FORCE_UPGRADE` remains development-only. Real Chromium A-to-B convergence and a final local Docker candidate have now passed; post-deploy verification against both public domains remains outstanding until this exact candidate is deployed, and local fixture/container success is not recorded as proof of those public environments.

## Goals and Non-Goals

Goals:

- Make a distinct ready version discoverable regardless of deferred mount timing or stale task history.
- Base task safety on current execution ownership/recovery facts rather than a persisted status label alone.
- Preserve running work by default and require explicit approval for destructive interruption.
- Produce one commit transition per confirmed pending version and guarantee post-activation reload convergence.
- Define deterministic cache behavior in the container artifact itself.
- Give every build one immutable release identity without changing its human-facing/npm semver semantics.
- Invalidate only stale automatic image-routing evidence instead of deleting user configuration or media data.
- Prove the same release identity, bytes, and headers at the container boundary and both public image domains.
- Provide an honest operational path for clients already running old code.

Non-goals:

- Automatically terminate live tasks merely because an update exists.
- Force `skipWaiting` and navigate every client without approval.
- Retroactively alter an already-loaded legacy page or promise that a new deployment alone can execute code in it.
- Redesign update localization/accessibility, global task concurrency, cancellation implementation, or SW transport.
- Treat a successful origin hash comparison as proof that all browser/client cache state has converged.
- Store update readiness in durable application/task storage.

## Supersession Rule

`harden-version-upgrade-convergence` semantically supersedes `fix-version-update-notification-delivery`. The following earlier decisions remain required:

- a minimal typed page-local pending-version snapshot;
- publication before notification;
- equivalent prompt state for readiness before and after deferred mount;
- authoritative replace/clear behavior;
- revision/version fencing against stale `version.json` responses;
- waiting-worker resolution and explicit user confirmation.

The rule "active tasks keep the prompt hidden" is replaced. Persisted `processing` is evidence to investigate, not authority to make the update undiscoverable. Implementation planning MUST mark the older change as superseded through the normal approved OpenSpec workflow rather than deleting or silently editing it.

## Upgrade State Ownership

One typed page-runtime owner projects authoritative Service Worker version state into a minimal snapshot:

- committed version;
- pending version, if distinct;
- monotonic page-local revision;
- readiness/commit phase;
- per-version confirmation and commit latch;
- current blocker classification summary.

The owner publishes the snapshot before notifying deferred consumers. Mounting, unmounting, or closing the UI does not clear it. Only authoritative no-pending state, equality with the committed version, replacement by a newer pending version, or completed activation clears/replaces it. Async metadata results must match the current pending version and revision before becoming visible.

The snapshot remains page-local and contains no task payloads, provider data, changelog body, or durable schema. Service Worker runtime state remains authoritative for waiting and activation identity.

## Blocker Classification

The upgrade coordinator consumes a provider- and media-independent `TaskExecutionOwnershipSnapshot` projection and maps each relevant task to exactly one class. The projection contains only task/attempt identity, current revision, typed storage-read outcome, dispatch-consumption facts, executor/session liveness, acknowledged remote identity, query-only polling ownership, recovery eligibility, and an authoritative terminal/reconciliation decision; it contains no prompt, provider payload, or artifact.

For an image attempt, the projection distinguishes two execution forms owned by `refactor-image-task-lifecycle`:

1. `local-dispatch`: the durable row proves a one-shot `dispatchToken` was consumed, and a local executor/session heartbeat keyed by the same task, attempt, token, and session reports whether the synchronous submit is presently live. The heartbeat is classification evidence only. Its expiry never restores or transfers provider-submit authority.
2. `remote-query`: the durable row contains committed `remoteId` and route, and a renewable query-only polling lease identifies the current remote-query owner. Lease expiry permits query takeover of that same remote job, never submit.

Video, audio, chat, workflow, plugin, and other task owners MUST expose equivalent read-only facts from their authoritative executor boundary. Until a task type can provide trustworthy ownership facts, it is `unknown-authority` with reason `projection-unavailable`, never guessed `live`, stale, or a storage fault from its status alone.

- `live`: either a current consumed dispatch token has a matching fresh local executor/session heartbeat, or a committed remote job has a current query-only polling lease;
- `recovering`: authoritative facts show an unresolved consumed dispatch without a currently verifiable heartbeat, or a committed remote job is within query-owner takeover/recovery;
- `stale-orphan`: the lifecycle authority proves no provider dispatch was consumed, or has already committed a safe interrupted/terminal reconciliation; heartbeat or polling-lease expiry alone is insufficient;
- `unknown-authority`: upgrade safety cannot be proven and carries exactly one reason: `storage-error` when the authoritative read failed, `projection-unavailable` when that task executor has not implemented the projection, or `inconsistent-state` when available lifecycle/owner facts contradict or cannot be correlated.

A persisted `queued` or `processing` label alone MUST NOT produce `live`. A consumed dispatch token with missing/expired heartbeat MUST produce `recovering` when its attempt/provider deadline is known, or `unknown-authority(reason='inconsistent-state')` when safety cannot be bounded; it MUST NOT become `stale-orphan` merely because the browser throttled the heartbeat. Classification reads are revision-fenced. Transport/heartbeat events may trigger reclassification, but every signal is correlated to current task, attempt, dispatch token or remote identity, and owner session before it proves liveness.

### Visible prompt modes

When a distinct pending version is ready, the update notice remains mounted/available in all blocker classes:

- With no blocker, the existing explicit update action is enabled.
- With `live`, the notice explains that work is running and defaults to waiting; it does not auto-commit or auto-cancel.
- With `recovering`, the notice shows recovery progress and waits for the task lifecycle's provider/attempt deadline or owner-takeover decision. The upgrade UI does not invent a shorter deadline that could interrupt a background-throttled synchronous request.
- With `stale-orphan`, the authoritative lifecycle reconciliation has proved no consumed dispatch remains unresolved or has already converged the task to a truthful interrupted/terminal state; the stale row then does not block upgrade.
- With `unknown-authority`, the notice names the non-sensitive reason and exposes the matching path: bounded storage retry for `storage-error`, capability/support guidance for `projection-unavailable`, or lifecycle re-read/reconciliation for `inconsistent-state`. It does not silently disappear or spin forever.

Accessibility, localization, focus, and motion details remain owned by `improve-version-update-interface-accessibility`, but that change MUST render these states without restoring invisibility.

Normal update confirmation is eligible only after no task remains `live`, `recovering`, or `unknown-authority`. `stale-orphan` becomes non-blocking only after the authoritative lifecycle safe-reconciliation fact is visible at the same or newer revision. The version updater never writes task terminal state merely to make itself eligible.

## Unresolved-Task User Semantics

The default action while `live`, `recovering`, or `unknown-authority` work exists is to wait or use the reason-specific recovery path. The system may notify the user when authoritative task state resolves and then enable normal update confirmation. Heartbeat freshness and query-lease expiry are classification inputs, not permission to interrupt or submit.

A "terminate tasks and upgrade" action is destructive and is not authorized by this proposal alone. If separately approved, it must:

- enumerate only affected attempts whose authority and cancellation target are verified;
- obtain explicit confirmation at the moment of action;
- invoke the authoritative external-cancellation contract;
- wait for a bounded, revision-fenced cancellation acknowledgement or show a clear partial-failure state;
- never offer destructive completion for `unknown-authority` or convert it into assumed cancellation;
- record no provider credentials or payloads.

Without that additional approval, no terminate action is shipped.

## Commit and Reload State Machine

For each pending version, the page-runtime owner moves through `ready`, `blocked/recovering` as applicable, `confirmed`, `commit-sent`, `activating`, and `converged` phases. Replacement by a newer pending version creates a new version identity and resets only that version's latch.

One user confirmation for the current eligible pending version atomically closes its page-local confirmation latch, resolves a live non-controller waiting worker, and posts exactly one `COMMIT_UPGRADE`. Duplicate clicks, duplicated DOM/duplex events, rerenders, remounts, and stale async work cannot post a second commit for that version. The Service Worker treats duplicate cross-client intents idempotently by pending-version identity.

Accepting the commit moves that release from `ready` to `committing` but keeps the prior `committedReleaseId` authoritative until the new Worker actually activates. This prevents the still-active old Worker from opening or validating the new release cache with old embedded code during the handover window. The activate transaction is the only point that promotes the pending release to `committedReleaseId`.

If no matching waiting worker can be resolved, the system does not mark commit success. It keeps the update visible and performs bounded authoritative state/update checks.

After the matching worker activates or `controllerchange` proves takeover, the flow is already approved. Reload uses a dedicated upgrade-convergence path and MUST NOT call the old generic `safeReload()` active-status decision again. Rechecking persisted `processing` at this stage can only deadlock an already committed update. This bypass applies only to the confirmed version-transition reload and does not weaken unrelated reload guards.

## Release Identity Contract

`version` and `releaseId` have deliberately different jobs:

- `version` is the human-facing version and the npm/CDN semver coordinate. It remains suitable for URLs such as `aitu-app@1.0.3` and is never replaced with a build identifier.
- `releaseId` is the immutable identity of one built release. Production supplies it explicitly from the release commit/build identity. An uncached local/self-hosted build without an explicit value derives a non-reserved identity from commit and build-time evidence; exact Docker layer-cache reuse is reuse of the same candidate bytes, not a new release.

The same `releaseId` is embedded in `index.html`, `version.json`, `sw.js`, `precache-manifest.json`, and `idle-prefetch-manifest.json`. It names the Service Worker static/app cache namespaces, is stored as `committedReleaseId`/`pendingReleaseId`, fences `version.json` metadata, and addresses `COMMIT_UPGRADE`. A manifest is usable only when both its display `version` and `releaseId` match the worker.

Official image metadata mirrors, but does not replace, that runtime authority: OCI `version` contains display semver, OCI `revision` contains the source revision, and `io.opentu.release-id` contains the immutable runtime release identity. Pre-promotion and post-deploy gates verify these labels before comparing served bytes and headers. A raw self-hosted Docker build remains executable without release build arguments because the runtime artifacts generate their own identity; only an official promoted candidate is required to carry the verified label contract.

Legacy Service Worker state used `committedVersion`/`pendingVersion`. A single IndexedDB read boundary converts those fields to the release-state schema; new writes contain only release identity fields. The page message protocol exposes release identity and display version as separate fields. This avoids a permanent dual-write path.

The release gate rejects a candidate when any release-control artifact has a different identity or bytes. Publishing different bytes under an already-published npm/display version is rejected because immutable CDN coordinates cannot safely be mutated.

## Static Cache Policy

The production container SHALL own and test these response policies:

- `/`, `index.html`, and all SPA navigation HTML: `Cache-Control: no-cache, max-age=0, must-revalidate`
- `sw.js`, `version.json`, `precache-manifest.json`, `idle-prefetch-manifest.json`, and `changelog.json`: `Cache-Control: no-store`
- `manifest.json`: `Cache-Control: no-cache` unless a separately approved short-cache policy and test replace it
- content-hashed `/assets/*` only: `Cache-Control: public, max-age=31536000, immutable`
- any non-content-hashed asset: an explicit revalidation policy, never `immutable`

The final image uses a pinned Nginx/OpenResty-compatible server with repository-owned configuration, correct SPA fallback, MIME types, and header rules. Files such as `_headers` may remain useful for other hosting targets but cannot be the only source of the container contract.

The Service Worker registration uses `updateViaCache: 'none'`. Requests for version metadata use `cache: 'no-store'` and validate same-origin structured data before changing readiness. These browser controls complement rather than replace server headers.

Each worker prewarms its own `releaseId`-scoped static cache while the old worker and cache continue serving current pages. Activation does not delete earlier release caches on a timeout: another tab can still execute the older shell and request its old hashed chunks after the new worker claims clients. Until the runtime has positive per-client release ownership evidence, prior static caches are retained. Browser quota eviction remains recoverable through origin/CDN fetches. Explicit dynamic-import recovery deletes only the currently committed static cache and never `drawnix-images` or user IndexedDB data.

## Image-Routing Evidence Convergence

Application release identity is not used as an image protocol cache version. Model discovery and pricing endpoint metadata instead carry a dedicated `routingEvidenceVersion` plus their existing normalized source identity and freshness contract. The independent version changes only when the evidence parser/binding contract changes.

On reading legacy or stale evidence for an `auto` Profile:

- stale discovered image evidence and stale endpoint evidence cannot participate in `InvocationPlan` construction;
- the runtime schedules normal model discovery against the same Profile and current credentials;
- selected model IDs, Profile fields, authentication, extra headers, prices/groups, tasks, images, and artifacts remain intact;
- a failed refresh leaves the old evidence non-authoritative and produces no provider generation request;
- manual provider modes retain their existing routing semantics.

After successful discovery, the new evidence schema is persisted and subsequent invocations can plan normally. The planner remains the only protocol authority; this mechanism neither stores an `effectiveProtocol` nor creates a fallback executor.

The implemented evidence boundary is deliberately image- and auto-mode-specific. Legacy catalog image models are hidden from planning while their selected IDs remain persisted; non-image catalog entries remain available. Pricing groups and prices remain readable, but endpoint metadata influences an automatic image binding only when its evidence version, normalized source identity, credential identity, credential presence, and freshness all match. Manual provider modes continue using their existing endpoint inference. Startup and runtime Profile changes schedule normal discovery refresh for each affected enabled Profile using that Profile's current Base URL and credential; success atomically persists the current evidence version, while failure keeps the legacy catalog and user selection stored but non-authoritative for image planning.

Model discovery has one in-flight owner per Profile and source identity. Concurrent callers for the same identity share that request. Starting a different identity, clearing the catalog, or removing/changing the Profile advances a monotonic request sequence and aborts the previous request when possible. Completion checks the sequence before any state or persistence write, so a superseded success or failure cannot overwrite newer evidence. Unrelated Profile changes still emit UI revisions but do not issue another `/models` request.

Catalog and pricing signatures use a stable opaque 128-bit credential fingerprint and never persist the source API key. The routing-evidence version advances when this identity contract changes, making legacy 32-bit signatures non-authoritative and refreshable through the same centralized boundary. The fingerprint is a cache identity, not an authentication primitive. Pricing endpoint caches include it in their source signature, while legacy prices/groups remain readable; settings-backed pricing cache updates replace the singleton's in-memory map so backup, restore, and synchronization cannot leave a second stale cache authority.

## Release Gate

The release pipeline verifies, before promotion and after public rollout:

1. the container-direct origin;
2. `https://image.forcodeai.xyz`;
3. `https://image.foropencode.com`.

For `/`, `index.html`, `sw.js`, `version.json`, manifests, changelog metadata, every same-origin hashed JavaScript/CSS entry referenced directly by `index.html`, representative additional chunks, and a reserved missing-hashed-asset probe, the gate records status, final URL, release version, byte hash, `Cache-Control`, content type, and relevant validators. It fails when release identities or required bytes differ, an HTML entry is absent, a required header is absent/incorrect, a supposedly immutable asset is not content-hashed, a version-sensitive file is served as immutable, or a missing hashed resource returns an immutable error response. Sampling can broaden coverage but cannot replace direct verification of the release shell's actual entry dependencies.

The public check cannot be replaced by registry/image inspection because CDN or reverse-proxy behavior is part of the deployed contract. The container-direct check cannot be replaced by public success because the deployable artifact itself must remain correct.

## Legacy Client Convergence

Future bundles cannot alter a page that is already executing old JavaScript and suppressed its own prompt. For currently trapped clients, the supported operational recovery is an explicit hard refresh and, if required, browser-site Service Worker unregister/reload guidance. Support documentation must explain impact before asking users to unregister because offline caches and open work may be affected.

The default implementation does not send an unconditional forced bridge from a new worker or navigate all clients. A centralized compatibility branch may accept an old page's user-confirmed `COMMIT_UPGRADE` without a `releaseId` only while this exact worker is the current ready pending release; it is idempotent and cannot select another release. This preserves an explicit user action and is not automatic activation. Any automatic `skipWaiting`/navigation bridge still requires separate approval, compatibility tests, and a rollback plan.

## Migration and Rollout

1. Add red tests for the reproduced ready-plus-processing timeline and exact cache headers.
2. Ship the container header policy and release gate in a staging/canary environment.
3. Ship readers/classifiers compatible with legacy task status plus new consumed-dispatch/session-heartbeat and acknowledged-remote/query-lease facts.
4. Enable visible blocker modes and convergence state machine for a canary cohort.
5. Verify one confirmation/one commit, activation reload, multi-tab idempotence, and legacy-client support instructions.
6. Promote only after container-direct and both public-domain gates agree.

Rollback retains the previous serving image and disables the new UI state machine without deleting task or cache data. If a release was committed, rollback is a new forward version; it does not attempt to make a browser downgrade to an older cache namespace.

## Risks and Mitigations

- Misclassifying a long synchronous request as stale after browser timer throttling: correlate the consumed dispatch token with executor/session heartbeat, degrade heartbeat uncertainty to `recovering` or reasoned `unknown-authority`, and require authoritative terminal reconciliation before stale.
- Treating polling-lease expiry as submit permission: make the snapshot distinguish query-only lease from one-shot dispatch facts and test that upgrade classification never changes dispatch authority.
- Missing authority removes safety information: show `unknown-authority` with the accurate reason, use bounded storage retries only for `storage-error`, and never assume tasks are safe to terminate.
- Duplicate commits across signals/tabs: page-local atomic latch plus Service Worker idempotence keyed by pending version.
- Reload occurs before activation: wait for matching activation/controller takeover before the dedicated convergence reload.
- Cache header regex marks unhashed assets immutable: test filenames and negative cases in the built container.
- CDN/proxy rewrites headers: fail public post-deploy verification independently for each domain.
- Existing old pages remain stuck: provide honest manual recovery; do not claim retroactive repair.

## Recommended Approval Defaults

- Local dispatch liveness: consume the image lifecycle's heartbeat keyed by task, current attempt, consumed dispatch token, and executor session, using its recommended 15-second emission target and 90-second freshness window plus immediate start/progress/visibility-resume signals. The updater does not create a second heartbeat clock. Expiry changes `live` to `recovering`, never to stale and never to renewed submit authority; the provider/attempt timeout and lifecycle terminal CAS remain authoritative.
- Remote query liveness: consume the image lifecycle's centralized 120-second query-only polling-lease TTL and 30-second renewal target. Lease expiry may enter `recovering` and transfer query ownership for the same committed `remoteId`; it cannot authorize submit.
- Missing authority: an unresolved consumed dispatch without verifiable heartbeat is `recovering` when its current attempt/provider deadline is trustworthy, otherwise `unknown-authority(reason='inconsistent-state')`. A task type without an authoritative ownership projection is `unknown-authority(reason='projection-unavailable')`, not stale or a storage error.
- Visible states: always show the pending version; show wait-only status for `live`, lifecycle-bounded progress for `recovering`, authoritative reconciliation for `stale-orphan`, and reason-specific retry/support guidance for `unknown-authority`. Exact localized copy and focus behavior remain with the accessibility change.
- Destructive behavior: do not ship terminate-and-upgrade in the default implementation. A later explicit approval may add it through the authoritative cancellation contract.
- Manifest caching: use `Cache-Control: no-cache` now; consider a short cache only through a measured follow-up change.
- Legacy bridge: do not ship forced `skipWaiting`/navigation. Use documented hard refresh and conditional unregister/reload for already-running old clients.
- Unknown storage retries: perform four total classification reads within 15 seconds with bounded jittered backoff, keep the notice visible throughout, and then require explicit user retry/support action.
