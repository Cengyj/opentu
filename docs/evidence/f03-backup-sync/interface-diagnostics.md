# F-03 Backup / Restore And GitHub Sync Interface Diagnostics

Date: 2026-07-30 (Asia/Shanghai)

## Scope And Safety Boundary

**User scenario**: a user opens the existing application menu to export or restore a ZIP backup, or to connect and operate the existing GitHub Gist synchronization surface, and can understand/control normal, loading, partial, failure, confirmation, cancel, close, and recovery states.

**In scope**: the reachable F-03 dialog shells, focus lifecycle, backup/restore tabs and file selector, progress/results, GitHub Token/custom-password presentation, Gist/recycle disclosures, existing control names/state, and Chinese/English application copy.

**Out of scope**: backup domains/formats; merge/replace ordering; non-empty current-board transition; GitHub pull/push/conflict/record correctness; destructive remote execution; Token values; real credentials; browser storage inspection; custom-password storage redesign; shared menu/More behavior; shared TDesign/ConfirmDialog defaults; dark-mode introduction; and unmeasured compact geometry.

No real export, import, Token validation, pull, push, Gist list/delete, recycle restore/delete, password read/write, IndexedDB read/write, localStorage read, or remote request was invoked. Connected states used in-memory fixtures. The production browser run used the disconnected surface only and did not inspect browser storage.

## Sources And Existing Owners

- Formal specification: `openspec/specs/backup-restore/spec.md`.
- Data-transition owner: `fix-backup-restore-current-board-transition` (2/11 before this sub-loop), awaiting approval.
- Settings/menu owner: `improve-settings-toolbar-accessibility` owns only the application-menu language/export submenus, toolbar More, and canvas settings switch; it does not own F-03 dialogs.
- Task/GitHub data owner: `persist-github-synced-task-history` and other domain consistency changes; none owns these F-03 interface contracts.
- New interface owner: `improve-backup-sync-interface-accessibility`.
- New Token security owner: `enforce-github-token-encryption`.

OpenSpec CLI is unavailable. `openspec validate <change> --strict` exits 127; no CLI validation is claimed. Manual structure, scenario, requirement-name, and ownership checks are recorded in the ledger.

## Reachability And Complete UI Call Chains

### ZIP backup and restore

Forward: application-menu `MenuItem` (`app-menu-items.tsx:170-187`) → `AppToolbar` closes the menu and invokes the callback (`app-toolbar.tsx:95-104`) → `Drawnix.handleOpenBackupRestore` enables deferred features and sets open state (`drawnix.tsx:553-561`) → `DrawnixDeferredFeatures` lazy-loads and mounts the dialog (`DrawnixDeferredFeatures.tsx:24-27,135-157`) → `BackupRestoreDialog` owns tab/options/mode/password/file/progress/result UI (`backup-restore-dialog.tsx:40-84,333-754`) → existing export/import services and progress callbacks → toast/result → close → pending workspace restore or safe reload (`:91-173`).

Reverse: the final dialog UI is written only by local `activeTab`, backup/import options, `isProcessing`, progress/message, import result, and pending workspace state. Export/import service callbacks are the progress writers (`:217-223,276-283`); `ImportResult` is the terminal result writer (`:285-296`). Close/cancel/overlay/Escape enter `handleClose`, which suppresses close while processing, optionally handles workspace state, optionally reloads, then resets UI state (`:142-173`). The lazy wrapper is the only current production mount. Current-board transition remains exclusively owned by the separate change.

### GitHub sync settings

Forward: application-menu `CloudSync` (`app-menu-items.tsx:189-206`) → `AppToolbar` dismisses and invokes (`app-toolbar.tsx:101-104`) → `Drawnix.handleOpenCloudSync` sets deferred/open state (`drawnix.tsx:558-561`) → lazy `DeferredSyncSettings` mounts `GitHubSyncProvider` (`DrawnixDeferredFeatures.tsx:39-43,159-166`; `DeferredSyncSettings.tsx:7-12`) → `SyncSettings` consumes connection/status/error/config/actions (`SyncSettings.tsx:85-124`) → Token form/setToken, pull/push, config/password/Gist/recycle actions → context/services/network/storage → context status/error/config → dialog state, MessagePlugin, inline status/error/list UI.

Reverse: the disconnected Token field invokes `handleSaveToken` and `GitHubSyncContext.setToken` (`SyncSettings.tsx:210-227`; `GitHubSyncContext.tsx:421-489`), which validates GitHub identity/scope, persists via `tokenService`, and may sync. Connected pull/push buttons call their exact context methods after confirmation (`SyncSettings.tsx:290-405`). Final status/error UI reads context (`:85-102,453-605`); Gist manager reads `listGists` (`:142-163,608-701`); recycle bin directly reads/mutates `syncEngine` (`RecycleBin.tsx:67-157,170-390`); custom password reads/writes `syncPasswordService` (`SyncSettings.tsx:165-208,731-793`). No alternative reachable sync-status component remains.

### Token encryption boundary

Forward: Token input → `GitHubSyncContext.setToken` validates remote identity/scope → `tokenService.saveToken` → `CryptoUtils.encrypt` → `@aitu/utils.encrypt` → either PBKDF2/AES-256-GCM JSON or `OPENTU_FB:` Base64 fallback → `github_sync_token` localStorage. API requests later call `tokenService.getToken` → `CryptoUtils.decrypt` → Authorization header.

Reverse: the only `github_sync_token` writer/remover is `TokenService` (`token-service.ts:28-47,80-92`). Its current encryption result comes from `CryptoUtils` (`crypto-utils.ts:53-68`). The normal shared path derives AES length 256 and stores ciphertext/IV/salt (`packages/utils/src/crypto/aes-gcm.ts:65-95,161-192`); the explicit fallback returns Base64 on missing Web Crypto or encryption error (`:166-169,193-197`) and decrypts it without password verification (`:214-220`). The Token guide is the visible security-claim writer (`TokenGuide.tsx:95-99`).

## Controlled Environments

### Component diagnostics

- Node: `/Users/macos/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node` (workspace runtime; prior environment record identifies Node v24.14.0).
- Vitest: 3.2.4; jsdom; no viewport geometry claim.
- Sample count: one deterministic fixture execution per state.
- First exploratory run: exit 1; 1/4 tests passed, 3 failed; duration 14.10s. Failures were diagnostic assumptions: pointer activation invoked the input click spy twice rather than once, and the TDesign cloud surface had no dialog role. A shared `../shared` barrel also initialized an unrelated config writer and produced `indexedDB is not defined`; this is test-isolation noise, not a product request or F-03 storage failure.
- Corrected isolated run: exit 0; 1/1 file, 4/4 tests; duration 9.43s, test time 480ms. The shared barrel was mocked to `HoverTip` only; no IndexedDB/config-writer output remained.
- Temporary component diagnostic was deleted after recording.

### Token fallback diagnostic

- Node/Vitest 3.2.4; Node environment; fixed non-secret 35-character sentinel; `globalThis.crypto` stubbed unavailable; one sample.
- Exit 0; 1/1 file, 1/1 test; duration 685ms, test time 5ms.
- Output: prefix `OPENTU_FB:`, `isReportedEncrypted=true`, `differentPasswordRecoversPlaintext=true`. No fixture plaintext was printed.
- Temporary crypto diagnostic was deleted after recording.

### Production browser

- Existing production `dist/apps/web` served only on `127.0.0.1:7393/?sw=0`; relation to source is the previously recorded successful F-03 build, and no runtime code changed in the intervening F-01/F-02 approval-only work. With no Git metadata, no commit hash or clean-tree claim exists.
- In-app Chromium binding; 1280×720 CSS px; DPR 1; no configured network/CPU throttle; one sample; disconnected GitHub state; no browser storage inspection.
- Backup screenshot: `backup-restore-desktop-before.jpg`, 55,413 bytes.
- Cloud screenshot: `cloud-sync-disconnected-desktop-before.jpg`, 36,544 bytes.
- Browser tab was closed and the local server stopped normally. Only local static assets were requested.

## [BACKUP-UI-A11Y-002]

Status: confirmed.

User impact: keyboard and screen-reader users cannot identify the backup/restore dialog by name or discover the visual tab/file-selection contracts; closing loses their prior navigation position.

Reproduction/current/expected: open application menu → Backup / Restore. Production root was `role=dialog` but `aria-label=null`, `aria-labelledby=null`; focus moved to “备份”; tablist/tab counts were 0. Switch to Restore: dropzone was `DIV`, role null, `tabIndex=-1`, no name. Controlled Enter invoked file input 0 times; pointer invoked it twice because the programmatic input click bubbled through the click container. Close with Cancel: active element became `body`. Expected: localized named modal; equivalent tab/file input behavior; one chooser request per activation; safe focus return.

Evidence: `backup-restore-dialog.tsx:334-364` uses plain `h2` and ordinary buttons rather than its existing `DialogHeading` relationship/tab contract. `:629-644` uses a click-only div and hidden input. `drawnix.tsx:553-561` records no invoker. Evidence strength is high: source + isolated component pointer/keyboard control + production Chromium semantic/focus result.

Call chain: app menu → Drawnix open state → deferred dialog → visual tab/dropzone → hidden input/service → result/close → `body`. Reverse writers and service boundaries are listed above.

Root cause: visible structure and open-state ownership were not connected to programmatic dialog/tab/file/focus contracts; the actual menuitem disappears before the modal can return focus to it.

Candidate/alternative: approved change uses existing dialog heading, labelled tabs, one native file activation owner, captured invoker with app-menu launcher fallback. Merely adding `tabIndex`/key handlers to the div is an alternative but retains two activation owners and weaker native semantics.

Risk: double file chooser, changing tab state while processing, nested confirm Escape leakage, or returning focus to a disconnected node.

Validation: exact activation counts; roles/relationships; initial and close focus; nested confirm precedence; pointer/Enter/Space; no service call before file selection; `.zip` and replace rules unchanged. Rollback removes UI/focus wiring only; no data migration.

## [BACKUP-STATUS-A11Y-003]

Status: confirmed.

User impact: a screen-reader user starting a potentially long export/import receives no programmatic percentage/message and cannot distinguish full success, partial success, warnings, and errors from generic content.

Reproduction/current/expected: the in-memory export callback emitted 37 and `fixture progress`. Result: progress container role null/live null, progressbar absent, message role/live null. Source renders import result/warnings/errors as plain divs. Expected: determinate value plus concise live message; terminal result/warning/error state exposed without focus churn or changed service semantics.

Evidence: `backup-restore-dialog.tsx:534-540,646-652,655-731`; component diagnostic exit 0. Evidence strength high for programmatic semantics; no duration/performance conclusion.

Call chain: export/import callback → React progress/message/result state → TDesign `Progress`/plain text → accessibility tree. Reverse writers are the two service callbacks and `setImportResult` only.

Root cause: the current TDesign Progress output and surrounding text are styled visually but no F-03 programmatic status contract is supplied.

Candidate/alternative: approved component-scoped progressbar/status/alert wiring with polite message throttling. Moving focus on every update was rejected because it would interrupt input and multiply announcements.

Risk: announcement noise or stale percentage/message mismatch.

Validation: 0/37/100, message updates, success/partial/error, warnings, busy/disabled, one operation, no focus move. Rollback removes ARIA/live wiring; data and callbacks remain.

## [SYNC-UI-A11Y-004]

Status: confirmed.

User impact: cloud-sync users cannot identify the surface as a modal dialog; the visible X is not keyboard-focusable/named; Token, auto-sync, password, Gist/recycle, and icon-only actions are unnamed or pointer-only; close loses focus.

Reproduction/current/expected:

- Production disconnected surface root: `DIV tabindex=0`, role/modal/name all null; default close `SPAN tabindex=-1`, role/name null. Escape closes, then focus is `body`.
- Token field: type password, zero labels, no aria label/relationship; accessibility snapshot used placeholder `ghp_xxxxxxxxxxxx` rather than visible “GitHub Token”.
- Controlled connected surface: Gist and recycle headers were DIV/role null/tabIndex -1/expanded null. Enter load calls 0/0; pointer 1/1. Auto-sync switch name/relationship null. Icon-only Gist delete text empty/name null.
- Expected: F-03-scoped named modal and native named controls/disclosures, pointer/keyboard parity, correct state, one callback, safe focus return.

Evidence: `SyncSettings.tsx:442-530,565-605,608-793`; `RecycleBin.tsx:170-390`; production Chromium + controlled fixture. Evidence strength high. TDesign's shared default is not declared defective for every caller; this finding is limited to the reachable F-03 surface.

Call chain: menu → deferred provider/dialog → context/service state → TDesign/HTML controls → confirm/service callbacks → inline state/toasts/close. Reverse writers are documented above.

Root cause: the F-03 owner relies on TDesign visual shell/default close and styled div disclosures without adding its own semantic/focus/label contracts.

Candidate/alternative: approved component-scoped semantic shell/custom close/native disclosure/labels. Changing TDesign globally was rejected because it affects unrelated callers without per-caller evidence.

Risk: nested modal focus, duplicate disclosure loads, delete target drift, or changing switch/password values.

Validation: disconnected/connected, loading/empty/error/current lists, close/Escape/confirm, all control names/state, exact service calls/arguments, no real remote mutation. Rollback UI-only; no storage cleanup.

## [SYNC-CREDENTIAL-PRESENTATION-005]

Status: confirmed.

User impact: a newly entered custom synchronization password is visibly exposed while typing, increasing shoulder-surfing/screen-capture risk; the stored-password show/hide control does not govern new input masking.

Reproduction/current/expected: controlled connected fixture exposed `.sync-settings__password-input` as `type=text` and zero labels. Source keeps a full stored password in component state, computes masked/unmasked display, then interpolates it into a text input placeholder while new input remains plain. Expected: new and stored password presentation masked by default, explicit reveal state, no plaintext in placeholder/access name/status/log, identical bytes sent to existing save/clear service.

Evidence: `SyncSettings.tsx:119-140,165-208,731-793`; controlled fixture. Evidence strength high for presentation; no real password was read.

Call chain: `syncPasswordService.getPassword` → component stored-password state → mask/show → placeholder; new input → `customPassword` → `savePassword`. Reverse service consumers also include GitHub payload crypto; this change does not alter them.

Root cause: the display/replacement field conflates explanatory placeholder, stored-secret reveal, and new-secret entry while fixed to text type.

Candidate/alternative: approved password input masked by default plus explicit stateful reveal, without plaintext placeholder. Removing reveal entirely was rejected because it removes an existing control; changing storage was rejected as a separate security-policy question.

Risk: users cannot verify replacement text or accessible reveal leaks the secret.

Validation: masked typing, explicit reveal/hide, names/state, byte-identical save, clear, reopen, no secret in outputs. Rollback presentation only; stored record unchanged.

## [BACKUP-SYNC-I18N-006]

Status: confirmed.

User impact: users who select the existing English language still encounter Chinese-only backup, restore, sync, Token-guide, recycle, progress, result, validation, and confirmation copy.

Reproduction/current/expected: render each owner under `I18nProvider defaultLanguage="en"`; “备份 / 恢复” and “云端同步” each remained present. Source components do not consume `useI18n`, while their application-menu entries already do. Expected: application-authored literals follow zh/en initially and on live switch; board/file/user/Gist/provider/imported values and credentials remain unchanged.

Evidence: `i18n.tsx:589-631`; `backup-restore-dialog.tsx:91-754`; `SyncSettings.tsx:45-860`; `RecycleBin.tsx:27-390`; `TokenGuide.tsx:18-127`; controlled provider diagnostic. Production English switch was not repeated because the current language submenu is independently keyboard-blocked and owned by `improve-settings-toolbar-accessibility`.

Call chain: I18nProvider → menu entry translation → dialog owner (currently bypasses context) → literals/messages. Reverse output writers include local state and provider/user/import data; only literals are candidates.

Root cause: localization stops at the application-menu entry and does not enter the lazily mounted F-03 components.

Candidate/alternative: typed F-03 keys and sentinel data-preservation tests. Browser-locale inference and translation of raw errors/data were rejected because they bypass current language ownership or mutate data.

Risk: partial translation, unstable accessible names, or translating identifiers/user/provider content.

Validation: zh/en initial/live; all states; byte-preserved sentinels; callback/storage arguments unchanged. Rollback keys/consumers/tests; no migration.

## [SYNC-TOKEN-ENCRYPTION-007]

Status: confirmed security-contract defect; implementation blocked pending independent approval.

User impact: in a browser without Web Crypto, or when AES encryption throws, a validated GitHub Token can be persisted as reversible Base64 while the reachable guide unconditionally states AES-256 local encryption. Anyone who obtains that localStorage value does not need the device-derived password to decode the fallback.

Reproduction/current/expected: stub only `globalThis.crypto=undefined`, encrypt a non-secret sentinel with password A, decrypt with password B. Output was `OPENTU_FB:`, `isReportedEncrypted=true`, and different-password plaintext recovery true. Expected from the existing guide: Token persistence/use only after verified AES, or truthful blocking/recovery feedback; no fallback use as if encrypted.

Evidence: `token-service.ts:28-47`; `crypto-utils.ts:53-68`; `packages/utils/src/crypto/aes-gcm.ts:161-220,257-260`; `TokenGuide.tsx:95-99`; deterministic 1/1 diagnostic. Evidence strength high. The normal path's PBKDF2/AES-256-GCM implementation is a verified non-problem.

Call chain: Token input → remote validation/scope → TokenService → CryptoUtils → shared AES/fallback → localStorage → later decrypt → GitHub Authorization. Reverse writer is TokenService only.

Root cause: a generic development/compatibility fallback is indistinguishable from secure ciphertext at the Token-specific boundary, while UI copy is unconditional.

Candidate/alternative: `enforce-github-token-encryption` fails closed for new persistence/use and securely rewrites recoverable fallback records at the same key before use. Copy-only correction was rejected because it would leave a bearer credential reversibly stored/used. Globally removing fallback was rejected because unrelated consumers lack evidence.

Risk: unsupported environments lose persistent sync until secure recovery; fallback migration can overwrite a recoverable value. Design therefore verifies ciphertext and commit before cache/use and leaves the old record untouched on failure.

Validation: secure save/read, unsupported/error, prior secure preservation, both fallback prefixes, atomic migration success/failure, malformed record, redaction, existing GitHub flows, no real credentials. Rollback retains migrated AES values but cannot recreate insecure fallback representation.

## Hypotheses, Unknowns, And Non-Problems

- **Unknown / blocked — compact geometry**: backup has an explicit `max-width:560px` rule; sync has no component media query, but TDesign may constrain width globally. The current Browser binding cannot resize, and no fresh 320/390 geometry was produced. No mobile overflow defect or responsive fix is claimed.
- **Hypothesis — custom synchronization-password storage policy**: `sync-password-service.ts:24-49,72-117` stores XOR+Base64 using browser characteristics. This is a confirmed implementation fact, but no formal threat model states whether this credential must be fail-closed AES, session-only, or user-entered per sync. Changing it would alter credential/storage/recovery semantics; no code or proposal was mixed into this interface loop.
- **Non-problem — normal GitHub Token crypto**: when Web Crypto succeeds, the current shared implementation uses PBKDF2/SHA-256 and AES-GCM length 256 with random salt/IV. The defect is the accepted indistinguishable fallback, not the normal algorithm.
- **Non-problem — sync payload crypto**: `github-sync/crypto-service.ts:65-152` uses PBKDF2 and AES-256-GCM for Gist payloads. This investigation did not find a Base64 fallback in that service.
- **Non-problem — confirmations**: shared `ConfirmDialog` already exposes a named role-bearing dialog and native actions in prior F-02 evidence; F-03 must only preserve nested focus precedence.
- **Tool/environment limitation**: formal Playwright suites remain blocked by the previously recorded missing `chromium_headless_shell-1200`. The in-app production run is browser evidence, not a substitute claim that Playwright passed.

## Result And Gate

No product component, style, i18n behavior, credential service, storage, network, backup, or synchronization code changed. Two approval-only changes now own the confirmed interface and Token-security behaviors. Two before screenshots and documentation/ledger records are the only material artifacts. There is no after screenshot, five-sample performance data, or visual/performance improvement claim.

F-03 remains investigation-complete for this added interface/security boundary but fails the full function exit standard until its data-transition, interface, and Token-security changes are approved/implemented/verified or explicitly declined, and until TAB-SYNC conflict ownership and compact/Playwright evidence are resolved.
