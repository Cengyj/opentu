# Change: Improve backup and cloud-sync interface accessibility

## Why

The two reachable data-preservation dialogs do not expose equivalent behavior to pointer, keyboard, and assistive-technology users. Controlled component diagnostics and a production Chromium run confirmed an unnamed backup/restore dialog, visual-only tabs, a pointer-only ZIP selector, non-programmatic progress/result states, a cloud-sync shell with no dialog semantics, non-focusable close/disclosure controls, unnamed form/switch/icon controls, lost focus after close, and Chinese-only dialog copy under the existing English provider. The custom sync-password field also renders newly entered password text unmasked even though the same section exposes show/hide language.

Correcting these existing interfaces changes keyboard-, focus-, assistive-technology-, localization-, and credential-presentation-observable behavior, so implementation requires approval.

## What Changes

- Give the existing backup/restore and cloud-sync modals localized names, modal semantics, deterministic initial focus, Escape behavior, and safe focus return to the connected invoker or stable application-menu launcher.
- Expose the existing backup/restore tabs, merge/replace choice, ZIP selector, progress, result, warning, and error states through native or equivalent programmatic contracts without changing import/export behavior.
- Make the existing Gist manager and recycle-bin disclosures operable with Enter/Space and expose expanded/loading/empty/current state.
- Give existing Token, custom-password, auto-sync, close, show/hide, and icon-only actions localized programmatic names.
- Mask newly entered and stored custom synchronization passwords by default; reveal them only through the existing explicit show action, without placing secret values in labels, placeholders, status messages, or logs.
- Localize application-owned backup, restore, synchronization, Token-guide, recycle-bin, progress, result, validation, and confirmation copy for the existing Chinese/English provider while preserving user data and provider-returned values byte-for-byte.
- Preserve all backup/GitHub storage, network, encryption, merge/replace, conflict, current-board, refresh, retry, and deletion semantics.

## Impact

- Affected specs: `backup-sync-interface-accessibility` (new delta capability)
- Affected code: `backup-restore-dialog.tsx/.scss`, `SyncSettings.tsx`, `RecycleBin.tsx`, `TokenGuide.tsx`, F-03-scoped i18n keys, deferred open/focus plumbing, and focused tests
- Adjacent changes:
  - `fix-backup-restore-current-board-transition` exclusively owns non-empty-current-board restore confirmation and switch timing.
  - `improve-settings-toolbar-accessibility` exclusively owns application-menu submenu/More behavior and the canvas settings switch.
  - `persist-github-synced-task-history` and GitHub data consistency changes own remote/local record semantics.
  - `enforce-github-token-encryption` exclusively owns fail-closed Token persistence and fallback migration.
- Data impact: none; no Board/Folder, backup, task, prompt, knowledge-base, GitHub config, credential, cache, localStorage, IndexedDB, or migration format changes
- Rollback: remove F-03-scoped semantics, focus plumbing, localization keys, password presentation changes, and focused tests; persisted data remains unchanged

## Evidence

- `backup-restore-dialog.tsx:334-364` renders a role-bearing floating dialog with a plain `h2` instead of `DialogHeading` and ordinary buttons instead of tabs. Production Chromium exposed `role=dialog` with no `aria-label`/`aria-labelledby`, initial focus on “备份”, and zero tablist/tab roles.
- `backup-restore-dialog.tsx:629-644` renders the ZIP selector as a click-only `div`. Controlled diagnostics produced `tag=DIV`, `tabIndex=-1`, Enter file clicks `0`, and pointer file clicks `2` (the programmatic input click bubbles back through the container).
- `backup-restore-dialog.tsx:534-540,646-652,655-731` renders progress and terminal results without programmatic progress/live/status contracts. A deferred in-memory export at 37% produced no progressbar and no live region.
- Closing the production backup dialog returned focus to `body`, not the application-menu launcher.
- `SyncSettings.tsx:442-530` uses the TDesign dialog. Production Chromium exposed its root as `DIV tabindex=0` with no role/modal/name; the default close control was `SPAN tabindex=-1` with no name. Escape closed it, then focus returned to `body`.
- `SyncSettings.tsx:507-514,724-727,746-787` leaves Token, auto-sync, and custom-password controls without explicit label relationships. Controlled diagnostics exposed no label/name relationship and `customPasswordType=text`.
- `SyncSettings.tsx:610-621` and `RecycleBin.tsx:172-184` use click-only `div` disclosure headers. Controlled Enter produced zero loads; pointer click produced one load for each.
- `SyncSettings.tsx:674-683` renders an icon-only delete button with no text or `aria-label`.
- `BackupRestoreDialog`, `SyncSettings`, `RecycleBin`, and `TokenGuide` do not consume `useI18n`; under `I18nProvider defaultLanguage="en"`, their Chinese titles remained present.
- Evidence bundle: `docs/evidence/f03-backup-sync/interface-diagnostics.md`, `metrics.json`, and two 1280×720 before screenshots.

## Approval

Implementation is blocked until the user approves the modal/focus contracts, keyboard activation, live-state semantics, default password masking, and scoped Chinese/English copy.
