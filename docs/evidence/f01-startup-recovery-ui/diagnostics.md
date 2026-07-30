# F-01 startup recovery and version-update interface diagnostics

Date: 2026-07-30 (Asia/Shanghai)

## Scope and evidence rules

This investigation covers the existing HTML boot shell, React initialization/render recovery UI, deferred version-update prompt, and their current event/focus/i18n boundaries. It does not change startup chunking, Service Worker cache/upgrade state, task blocking, crash storage, diagnostic sanitization, provider routes, or user data.

The source tree has no Git metadata, so worktree cleanliness/history cannot be checked and rollback cannot be described as a Git operation. OpenSpec CLI is unavailable; strict validation exits 127. No .npmrc, browser storage, credentials, or user data were read.

## User scenarios and boundaries

1. A user opens or refreshes Opentu and receives a bounded loading status until the workbench or a recovery surface is ready.
2. A startup resource, workspace initialization, or React render fails and the user can understand the failure and invoke an existing recovery route.
3. A staged Service Worker update becomes ready before or after the non-critical update UI mounts; the user eventually sees the same update and can explicitly commit it after active tasks finish.
4. A user operating the application in English receives application-owned version-update copy and accessible status/modal semantics.

Non-scope: changing the 5-second/idle deferred mounting policy, prefetch/cache keys, COMMIT_UPGRADE protocol, active-task blocking rule, automatic reload timing, crash thresholds/history, diagnostic payloads, or language persistence.

## Forward and reverse call chains

### HTML boot and React handoff

Forward:

apps/web/index.html:515-555 loading status/progress markup
→ inline controller setProgress/markReady/markError at :1114-1188
→ apps/web/src/main.tsx status updates
→ apps/web/src/app/bootstrap.tsx:744-759 mounts ErrorBoundary and App
→ apps/web/src/app/app.tsx:271-280 calls markReady for crash/init-error/ready states
→ boot node receives is-leaving and is removed after transition or 360 ms
→ App shows recovery UI or Drawnix.

Reverse:

app-boot title/tip/progress
← only index.html renderProgress/setProgress/markReady/markError writers
← main/bootstrap/App call the window BootController
← resource error/unhandled rejection or React/application readiness.

Inputs are an optional numeric progress and bounded title/tip/note strings. The HTML controller owns bootReady, progress and timers. Effects are DOM text/attribute/class updates and removal. There is no storage write in this UI controller. The early shell remains Chinese because the Drawnix language owner has not mounted.

### Crash and initialization recovery

Forward:

bootstrap.tsx:45-52
→ crashRecoveryService.markLoadingStart/checkUrlSafeMode/initCrashLogger
→ App initialization effect app.tsx:290-549
→ repeated-load threshold or workspace exception
→ ErrorFallbackUI at app.tsx:931-958
→ continue/safe-mode handlers app.tsx:914-929 or log/debug/reload helpers ErrorBoundary.tsx:92-104
→ safeReload/reload, /sw-debug.html, or error-log download.

React render errors:

bootstrap.tsx:753-758
→ ErrorBoundary.getDerivedStateFromError/componentDidCatch
→ lazy-chunk recovery attempt or ErrorFallbackUI
→ export/safe-mode/debug actions.

Reverse:

ErrorFallbackUI
← App crash/init branches and ErrorBoundary render-error branch are its only source callers
← crash service localStorage state, workspace initialization rejection, or React render exception.

Crash state is owned by crash-recovery-service.ts and uses existing localStorage keys. ErrorFallbackUI owns only showDetail. Recovery actions can reload/navigate/download; this investigation did not invoke them. Diagnostic content/sanitization belongs to sanitize-diagnostic-capture-and-export and is excluded here.

### Version-update notification and confirmation

Forward:

SW install/prewarm/version state
→ bootstrap.tsx:525-542 requestSWVersionState
→ native SW_VERSION_STATE at :689-693 or duplex onSWNewVersionReady at :591-600
→ notifyUpdateReady at :363-373
→ one sw-update-available CustomEvent
→ VersionUpdatePrompt listener at version-update-prompt.tsx:15-73
→ version.json validation/fallback
→ local updateAvailable/showChangelog state
→ prompt/dialog
→ user-confirmed-upgrade at :75-81
→ bootstrap.tsx:703-725 resolves a waiting worker and posts COMMIT_UPGRADE
→ activate/controllerchange
→ safeReload after explicit confirmation.

Reverse:

visible version prompt
← updateAvailable local React state
← only handleUpdateAvailable
← only sw-update-available listener
← only notifyUpdateReady producer plus the development-only debug helper.

The producer deduplicates the last pending version in bootstrap.tsx:358-388. The consumer mounts only after Drawnix enables non-critical UI after 5 seconds and idle/fallback scheduling at drawnix.tsx:677-701, then DrawnixDeferredFeatures lazy-mounts it at :167-170. No page-local snapshot, replay, storage record, or ready handshake bridges these lifetimes.

Inputs are a version string and optional changelog array. updateAvailable/showChangelog are component state; pendingWorker/userConfirmedUpgrade/lastPendingVersionNotified are bootstrap state; active tasks come from useTaskQueue. Effects are one same-origin version.json fetch, CustomEvents, and eventually COMMIT_UPGRADE/reload. No version prompt state is persisted. The existing activeTasks.length > 0 guard remains an invariant.

## Confirmed findings

### [STARTUP-UPDATE-003]

Status: confirmed correctness defect.

User scenario: a staged update becomes ready during the first five seconds or before the idle callback mounts VersionUpdatePrompt.

Reproduction: in a controlled jsdom component diagnostic, dispatch sw-update-available with version 2.0.0 before rendering VersionUpdatePrompt, then render it. Result: promptVisible=false and fetchCalls=0. With the same event after render: promptVisible=true and fetchCalls=1. Diagnostic command exited 0 with 2/2 assertions.

Current vs expected: the current one-shot DOM event is lost before the sole listener exists. FEATURE_FLOWS.md:763-773 describes the existing user flow as update-ready event → prompt → explicit update, so the expected existing outcome is eventual prompt delivery independent of the deferred UI mount race.

Evidence:

- apps/web/src/app/bootstrap.tsx:358-388 records only lastPendingVersionNotified and suppresses repeated delivery for the same version.
- apps/web/src/app/bootstrap.tsx:525-542 can receive readiness before the UI mount.
- packages/drawnix/src/drawnix.tsx:677-701 defers the UI by at least five seconds plus an idle callback when available.
- packages/drawnix/src/components/startup/DrawnixDeferredFeatures.tsx:167-170 mounts the consumer.
- packages/drawnix/src/components/version-update/version-update-prompt.tsx:15-73 listens only after mount.
- Whole-source reverse search found one production producer and one consumer; there is no replay/snapshot writer.

Impact: users whose ready event wins the mount race receive no in-page update action until a later state transition can produce a different notification. Visibility/state retries do not repair the case because notifyUpdateReady deduplicates the same version.

Evidence strength: deterministic source lifetime proof plus controlled before/after event diagnostic.

Root cause: an ephemeral one-shot event crosses a deliberately deferred component boundary without a replayable page-level readiness owner.

Preferred solution: a minimal typed page-local pending-version snapshot/handshake owned at the bootstrap boundary. Publish before dispatch; let the delayed consumer read the current snapshot on mount; clear/update it only from runtime version state. Keep version.json validation, active-task hiding, explicit confirmation, COMMIT_UPGRADE, and reload semantics unchanged.

Alternative: mount VersionUpdatePrompt before notification can occur. Rejected because it weakens the approved/pending startup deferral boundary and still does not formally eliminate a producer-before-consumer race.

Risk: stale pending version, duplicate prompts, or committing the old worker if clear/replace ordering is wrong. Do not persist this snapshot across page reload.

Validation: red tests for early/late event parity, same-version dedupe, version replacement/clear, active-task delay, missing waiting worker, one confirmation/one COMMIT_UPGRADE, natural activation, refresh and multi-tab behavior; then focused App/SW tests and standard build/startup gates. No performance claim without five before/after samples.

Rollback: remove the page-local snapshot/handshake and its tests, restoring the current event-only contract. No storage/cache/data cleanup.

### [STARTUP-RECOVERY-A11Y-004]

Status: confirmed accessibility/interaction defect.

User scenario: a keyboard or screen-reader user encounters a repeated crash, workspace initialization failure, or React render error and must understand and operate the blocking recovery surface.

Reproduction: render ErrorFallbackUI with an initialization error, stack and 80/100 memory fixture. Current semantic result: dialog=0, alertdialog=0, alert=0, progressbar=0; document.activeElement is body; the detail button has neither aria-expanded nor aria-controls before or after expansion. The detail becomes visible after click, proving the visual state changes without a programmatic state relationship. Diagnostic command exited 0 with 1/1 assertion.

Current vs expected: the full-screen blocking surface is visually a modal recovery dialog but is exposed as unnamed generic divs; keyboard focus is not placed on the recovery context; disclosure and memory states are visual only. Expected behavior is one named blocking recovery region, deterministic initial focus, explicit disclosure state/relationship, and a bounded memory progress value while keeping every current action and callback.

Evidence:

- ErrorBoundary.tsx:170-315 renders the overlay/card/title/actions without region role or naming.
- ErrorBoundary.tsx:233-249 changes detail visibility without aria-expanded/aria-controls.
- ErrorBoundary.tsx:321-365 renders a width-only memory bar without progress semantics.
- App callers are at app.tsx:931-958; ErrorBoundary callers are at ErrorBoundary.tsx:56-85.

Impact: every React initialization/render/crash recovery state; pointer users retain actions, while assistive users lack the failure context/state and keyboard entry point.

Evidence strength: controlled current component render plus complete caller/sink trace.

Preferred solution: add a named alertdialog contract, focus the safest recovery/control target on entry, make the detail control an explicit disclosure, expose the bounded memory percentage, preserve native buttons/callbacks, and add compact/reduced-motion styling that still works when application CSS fails.

Alternative: add only role=alert to the error message. Rejected because it does not name the blocking surface, manage focus, or expose the interactive disclosure.

Risk: stealing focus from a browser-native recovery control, accidental activation after focus, or focus loss during transition. Tests must assert focus only, never auto-activate an action.

Validation: component tests for crash/init/render/chunk variants, role/name/description/focus, disclosure, memory values, every callback exactly once, long stack, 320/390/768/1280 layout, keyboard/zoom/reduced-motion, and inline-style-only rendering. Full diagnostics/export payloads remain outside scope.

Rollback: remove semantic/focus/disclosure/progress/compact changes and their tests; retain existing callbacks and crash storage. No data migration.

### [STARTUP-UPDATE-UI-005]

Status: confirmed localization/status/modal defect.

User scenario: a user has selected English and a staged update becomes ready; the user reads the notice or opens its changelog with keyboard/screen-reader support.

Reproduction: render VersionUpdatePrompt under I18nProvider defaultLanguage=en, dispatch an update for 2.0.0, and open the changelog. Current result: prompt is “新版本 v2.0.0 已就绪”, buttons are “查看更新内容” and “立即更新”, status=0, alert=0; the Chinese changelog title is present while dialog=0 and aria-modal=true count=0. Diagnostic command exited 0 with 1/1 assertion after recording the actual contract.

Current vs expected: application-owned update copy ignores the current i18n owner; the newly appearing notice is not a bounded status; the visually modal changelog has no dialog/modal role in the rendered tree. Expected behavior is current-language system copy, one concise status announcement, a named accessible modal contract, unchanged version/changelog data, and unchanged confirmation callback.

Evidence:

- version-update-prompt.tsx:6 imports useI18n but :13 leaves it unused.
- version-update-prompt.tsx:90-134 hard-codes every application-owned visible string.
- The notice root at :90 has no status/live semantics.
- The current TDesign dialog receives only header/visible/onClose/width/footer at :116-134; controlled render exposed no dialog/aria-modal node.
- I18nProvider supports live zh/en state at i18n.tsx:579-649 and VersionUpdatePrompt is mounted inside it via drawnix.tsx:869-938.

Impact: all English runtime sessions receiving an update, and assistive users when update/changelog state appears.

Evidence strength: current-source ownership proof plus controlled English render and semantic query.

Preferred solution: add typed zh/en update keys to the existing i18n owner; expose only the short update-ready sentence as a polite status; give the changelog a named modal/focus/close contract using a project-owned accessible wrapper/primitive; keep version/changelog values as unmodified release data.

Alternative: infer language from navigator.language or translate changelog entries. Rejected because navigator language can diverge from the selected application language, and changelog text is release data rather than application-owned UI.

Risk: duplicate announcements, focus trapping regressions in the third-party dialog, or accidentally translating release content.

Validation: zh/en component tests including live language switching, bounded status count, dialog name/modal/focus/Escape/return focus, unchanged version/changelog sentinels, exact confirmation callback count, active-task hiding, and compact/long-text checks.

Rollback: remove scoped keys/semantics/dialog adapter/styles/tests; keep update event and COMMIT_UPGRADE contract unchanged. No storage/cache/data migration.

### [STARTUP-BOOT-RECOVERY-006]

Status: confirmed UX/recovery gap.

User scenario: the main module, stylesheet/resource, or startup promise fails before React recovery UI is available.

Reproduction/static proof: index.html resource-error/unhandled-rejection handlers call markError at :1427-1463. markError at :1167-1182 sets progress to 100, changes title/tip and app-boot-error class. The boot markup at :515-555 contains one external official-site link, text and progress only; it has no reload, safe-mode, or debug action. The root remains role=status aria-live=polite and the progressbar remains exposed at 100.

Current vs expected: visible copy explicitly asks the user to refresh and retry, but the application surface provides no corresponding action and represents a terminal failure as completed loading. Expected behavior is a bounded failure announcement and direct access to existing retry/safe-mode/debug routes without inventing a new recovery capability.

Evidence strength: deterministic DOM/controller proof; no browser visual claim.

Impact: failures before App/ErrorFallbackUI can own recovery. Browser chrome reload remains available, so this is not classified as total lockout.

Preferred solution: on markError, switch the shell to an assertive error state, remove/hide progress semantics, expose direct retry plus the already-existing safe-mode/debug routes, focus the retry control without activation, and keep the no-framework/no-external-CSS boundary.

Alternative: leave only text and rely on browser chrome. Rejected because the current interface already promises recovery and gives direct actions in the React failure path.

Risk: reload loops, losing query parameters, or invoking safe mode without explicit user intent. Preserve the current URL on retry, set safe mode only after its distinct action, and never auto-retry here.

Validation: execute the inline controller in a synthetic DOM for resource error, script error and rejection; assert one alert, no completed progressbar, focus and exact URLs/actions; verify normal markReady still removes the shell. Browser screenshots are still required before any visual-improvement claim.

Rollback: restore the current text-only markError markup/controller and remove its tests. No storage cleanup except the existing safe-mode action's established key.

## Hypotheses and non-problems

- The 320/390 version notice may overflow because the 320px fallback max width is 182px while three nowrap flex children do not wrap. No post-cleanup browser geometry was taken in this turn, so this remains a hypothesis until same-state geometry/screenshot evidence exists.
- ErrorFallbackUI requests a remote QR image on the failure path with no-referrer. This proves a third-party request boundary, not a privacy defect. A product privacy/consent requirement and controlled network evidence are still missing; sanitize-diagnostic-capture-and-export owns payload sanitization, not this request.
- App's transient “加载中...” div has no status role, but the first render is covered by the already-semantic HTML boot shell and App marks that shell ready when leaving loading. It is not classified as a separate defect from current evidence.
- ErrorFallbackUI z-index 99999 is above the HTML boot shell z-index 9999, so the source does not support a claim that React recovery is hidden by the boot shell.
- activeTasks.length > 0 hiding the update prompt is current explicit semantics and is not treated as a defect.

## Test evidence and environment classification

- Existing App recovery/persistence tests: exit 0; 2/2 files, 2/2 tests; 2.58 s Vitest duration.
- Existing app-shell/CDN tests: exit 0; 2/2 files, 20/20 tests; 1.40 s Vitest duration.
- Temporary ErrorFallback diagnostic: exit 0; 1/1 file, 1/1 test; 8.22 s.
- Temporary update early/late diagnostic: exit 0; 1/1 file, 2/2 tests; 9.78 s.
- Temporary update English/status/modal diagnostic: the first assertion intentionally expected a dialog and exited 1, revealing actual dialogCount=0; the corrected evidence assertion exited 0 with 1/1 test in 8.89 s. The initial exit is diagnostic assertion correction, not a product-test regression.
- Environment/configuration stderr: IndexedDB is absent in the Web jsdom environment for ConfigWriter; Browserslist data warning; third-party sourcemap warning; package-manager credential-configuration warning. These did not fail the recorded product assertions and are not classified as product defects here.
- Temporary diagnostic files were deleted after recording results.
- No production TSX/SCSS/storage/cache/request behavior changed in this investigation.

## OpenSpec manual validation

- fix-version-update-notification-delivery: four required files, one delta spec, 2 requirements, 6 fourth-level scenarios, 6 WHEN and 6 THEN clauses, 21 tasks with 4 evidence tasks complete.
- improve-startup-recovery-interface-accessibility: four required files, one delta spec, 5 requirements, 11 fourth-level scenarios, 11 WHEN and 11 THEN clauses, 25 tasks with 5 evidence tasks complete.
- improve-version-update-interface-accessibility: four required files, one delta spec, 4 requirements, 8 fourth-level scenarios, 8 WHEN and 8 THEN clauses, 22 tasks with 4 evidence tasks complete.
- All 11 new requirement names occur exactly once across current formal/delta specs.
- Ownership is separated: replay correctness, recovery UI and update UI each have one active owner; refactor-startup-shell-loading retains mount/chunk timing; sanitize-diagnostic-capture-and-export retains diagnostic privacy; F-26 language persistence remains unapproved and outside scope.
- openspec validate NAME --strict exited 127 for all three changes because the CLI is unavailable. This is a tool blockage, not validation success.
