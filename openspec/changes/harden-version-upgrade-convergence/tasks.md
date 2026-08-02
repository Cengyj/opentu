## 1. Evidence and Approval

- [x] 1.1 Reproduce the Chromium v1.0.0 to v1.0.1 staged timeline with activated controller/active worker, installed waiting worker, and exact runtime version state
- [x] 1.2 Prove a persisted `processing` task fixture yields zero prompts, zero update buttons, and zero `COMMIT_UPGRADE` despite listener execution and a `version.json` fetch
- [x] 1.3 Prove controlled explicit confirmation emits exactly one `COMMIT_UPGRADE`
- [x] 1.4 Verify `/`, `index.html`, `sw.js`, `version.json`, and core hashed chunks are byte-identical version 1.0.1 on both public image domains
- [x] 1.5 Verify those public responses lack `Cache-Control` and the BusyBox final image does not apply `apps/web/public/_headers`
- [x] 1.6 Trace page-local readiness, deferred UI, task guard, waiting-worker resolution, commit, activation, controller-change, and safe reload paths
- [x] 1.7 Record semantic supersession of `fix-version-update-notification-delivery` while preserving its valid snapshot and race guarantees
- [x] 1.8 Reconcile upgrade classification with one-shot consumed dispatch plus executor/session heartbeat and separate query-only polling ownership
- [x] 1.9 Define `unknown-authority` reasons `storage-error`, `projection-unavailable`, and `inconsistent-state` without conflating missing capability with storage failure
- [x] 1.10 Obtain user approval for the non-destructive blocker semantics, visible safe state, commit/reload convergence, server replacement, cache policy, release-gate rollout, retained static caches, routing-evidence refresh, and legacy-client guidance
- [ ] 1.11 Obtain separate explicit approval before implementing any terminate-and-upgrade action or one-time forced legacy bridge

## 2. Tests First

- [x] 2.1 Add failing early/late mount parity, snapshot replace/clear, unmount/remount, same-version dedupe, and stale `version.json` response tests
- [ ] 2.2 Add failing classification tests for fresh consumed-dispatch heartbeats, missing/throttled heartbeats, current/expired query-only leases, safe stale reconciliation, legacy `processing`, and all `unknown-authority` reasons
- [ ] 2.3 Add failing UI tests proving a ready update remains visible in every blocker class and `unknown-authority` exposes reason-specific storage retry, projection guidance, or inconsistent-state recovery
- [ ] 2.4 Add failing tests proving `live`, `recovering`, and `unknown-authority` tasks default to wait, including a long synchronous request whose heartbeat is background-throttled, with zero implicit cancellation/commit/resubmission
- [ ] 2.5 Add failing exact-once commit tests for double click, duplicate events, remount, pending A to B replacement, missing waiting worker, multiple tabs, and SW idempotence
- [x] 2.6 Add failing activation/controllerchange tests proving confirmed reload bypasses the obsolete active-status recheck while unrelated reload guards remain intact
- [x] 2.7 Add container tests for SPA fallback, MIME types, every exact cache rule, unhashed-asset negative cases, and Service Worker/version fetch cache settings
- [ ] 2.8 Add release-gate fixtures covering container direct, both public domains, version mismatch, byte mismatch, missing/incorrect headers, redirects, and CDN rewrites
- [ ] 2.9 Add a legacy-page operational rehearsal proving the hard-refresh/unregister instructions and documenting user-data/open-work cautions
- [x] 2.10 Complete and run the final routing-evidence matrix for stale/current catalogs, stale/fresh pricing endpoints, source and credential mismatch, automatic refresh success/failure, selected-model preservation, manual modes, and non-image routing
- [x] 2.11 Add deterministic discovery tests for runtime credential changes, same-identity single-flight, superseded success/failure, request abort, explicit clear, credential-identity collision, and external pricing-cache replacement/removal
- [x] 2.12 Add release-gate red tests proving all `index.html` hashed JavaScript/CSS entries are mandatory and missing hashed-asset errors cannot be cached immutable

## 3. Implementation (Approval Required)

- [x] 3.1 After explicit approval, implement the typed page-local version snapshot while preserving publish-before-notify, mount-order parity, authoritative clear/replace, and stale-fetch fencing
- [ ] 3.2 After explicit approval, implement dispatch-heartbeat/query-lease-based `live`, `recovering`, `stale-orphan`, and reasoned `unknown-authority` classification with bounded reconciliation
- [ ] 3.3 After explicit approval, keep the update notice available in every class and render reason-specific `unknown-authority` recovery through the separately owned accessibility/interface contract
- [x] 3.4 After explicit approval, implement per-version confirmation/commit latching and SW-side idempotence
- [x] 3.5 After explicit approval, implement matching activation/controllerchange convergence and the dedicated approved-upgrade reload path
- [x] 3.6 After explicit approval, set Service Worker registration `updateViaCache: 'none'` and version metadata fetches to `cache: 'no-store'`
- [x] 3.7 After explicit approval, replace the BusyBox final layer with pinned Nginx/OpenResty-compatible serving and repository-owned header configuration
- [x] 3.8 After explicit approval, implement pre-promotion and post-deploy release gates for container direct and both exact production image domains
- [ ] 3.9 After explicit approval, update architecture, release, incident-recovery, and feature-flow documentation
- [ ] 3.10 Only after separate destructive-action approval, implement and test terminate-and-upgrade or a one-time forced legacy bridge; otherwise omit both
- [x] 3.11 Implement immutable `releaseId` generation and propagation through HTML, version metadata, Service Worker state, release manifests, cache namespaces, commit identity, verified image labels, and the single legacy state-read boundary
- [x] 3.12 Retain prior release-scoped static caches and constrain explicit lazy-import recovery to the currently committed static cache without deleting media or user data
- [x] 3.13 Implement independently versioned automatic image-routing evidence, fail-closed planner gating, same-Profile refresh, selected-model preservation, and unchanged manual-provider behavior
- [x] 3.14 Keep a ready update visible and block normal confirmation conservatively as `unknown-authority:projection-unavailable` while the complete task-ownership projection remains unavailable
- [x] 3.15 Fence model discovery with a per-Profile monotonic request identity, scope pricing endpoint evidence to the current opaque credential identity, and converge settings-backed pricing cache changes into the singleton authority
- [x] 3.16 Verify every release-shell entry asset and remove immutable caching from hashed-asset error responses at the Nginx boundary

## 4. Migration

- [ ] 4.1 Coordinate `fix-version-update-notification-delivery` as semantically superseded through the approved OpenSpec workflow without deleting its evidence
- [ ] 4.2 Deploy task-classification compatibility before relying on consumed-dispatch/session-heartbeat and acknowledged-remote/query-lease ownership projections as upgrade blockers
- [ ] 4.3 Canary dispatch-heartbeat/query-lease classification, reasoned `unknown-authority` modes, container headers, public release gate, commit latch, and reload convergence in separable stages
- [ ] 4.4 Publish manual hard-refresh and conditional Service Worker unregister guidance for clients already executing old bundles
- [ ] 4.5 Prove rollback uses a forward release, preserves task history, and never attempts an unsafe cache-version downgrade

## 5. Verification

- [ ] 5.1 Repeat the exact Chromium v1.0.0 to v1.0.1 fixture with `live`, `recovering`, `stale-orphan`, all three `unknown-authority` reasons, and no-task states and retain raw timelines
- [ ] 5.2 Prove every ready state renders one discoverable prompt/status path and stale `processing` converges without blocking upgrade
- [x] 5.3 Prove each confirmed pending version emits exactly one `COMMIT_UPGRADE`, missing-worker state remains retryable, and activation/controllerchange reload completes
- [ ] 5.4 Verify no `live`, `recovering`, or `unknown-authority` task is interrupted by default and any separately approved termination path uses authoritative cancellation acknowledgements
- [ ] 5.5 Build and inspect the final container, then verify exact status, version, byte hash, headers, MIME types, and validators directly and on both public domains
- [ ] 5.6 Run focused component/bootstrap/SW/task tests, typecheck, lint, cycles, full test suite, production build, size, and startup-boundary checks (focused suites, typechecks, cycles, startup boundary, and production builds passed; full suite, repository lint debt, and size budget remain outstanding as recorded below)
- [ ] 5.7 Run multi-tab, long synchronous background-throttling, heartbeat expiry, query-lease takeover, offline-to-online, stale cache, proxy header rewrite, and rollback rehearsals; prove expiry never grants submit or prematurely enables upgrade
- [x] 5.8 Record that the `openspec` CLI is currently unavailable (`command not found`) and complete strict manual structure/format review
- [ ] 5.9 When the CLI environment is restored, run `openspec validate harden-version-upgrade-convergence --strict` and resolve every finding before approval

### Recorded partial verification evidence

- Release identity, static, Service Worker release/app-shell, and page runtime: 5 files / 56 tests passed; deferred VersionUpdatePrompt: 5/5 passed.
- Release identity/static and image-label contract after final Docker changes: 2 files / 30 tests passed.
- Final routing/settings/task evidence matrix: 12 files / 132 tests passed; the final focused rerun after the image-only legacy refresh fix passed 6 files / 100 tests.
- Real Chromium 147 A-to-B rehearsal passed with the same display version and distinct release IDs: old chunk served from the retained A cache, one `COMMIT_UPGRADE`, one controller change, one confirmed reload, both A/B static caches retained, `drawnix-images` and IndexedDB sentinels preserved, and zero image-generation requests.
- Final Docker candidate `sha256:564bce702735c134f3c445f8bd18fb0a8eb06fb63807b978943ab6b3299b55ae` built successfully. Image metadata, five release-control identities, Nginx configuration, 154 hashed assets, and 16/16 live container HTTP targets passed. A no-argument builder produced a non-reserved generated release identity.
- `nx build web` and the final full Docker production build passed. `web:typecheck`, `drawnix:typecheck`, `check:cycles`, `verify:startup`, and `git diff --check` passed.
- Targeted lint for new files passed. The repository-wide baseline remains 363 errors, 1691 warnings, and 4 hover findings; `sw/index.ts` retains existing findings. The unrelated size baseline still exceeds the existing AI Chat budget.
- The existing unrelated Sora web-mode fixture still expects `['10', '15']` while current HEAD exposes `['10']`; no video production code was changed for this release work.
- Public-domain post-deploy verification remains pending until the exact candidate is deployed, so task 5.5 stays unchecked.
- OpenSpec strict validation remains unavailable: direct invocation exits 127 and `pnpm exec` exits 254. Manual validation found 3 delta files, 15 requirements, 54 scenarios, and no requirement without a scenario.
