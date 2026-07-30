# Change: Improve shared settings surface accessibility

## Why

The existing Settings surface is reachable from the application menu, command palette, model selectors, Chat, toolbox gates, video analysis, and API-authentication failures. Its four content views are rendered inside one non-modal WinBox, but the shared outer surface does not expose the relationships that its visual presentation already communicates.

In a controlled production Chromium run at 1280×720, the Settings WinBox root had no dialog role, accessible name, modal state, or programmatic focus target. Its visible split, maximize, and close controls were `SPAN` elements with no control role, accessible name, or tab stop. Opening Settings from the application menu left focus on `BODY`; Escape from a focused Settings navigation button left the window open; pointer close removed the window and again left focus on `BODY`.

The four existing navigation buttons expose the visible active view only through a CSS class. None reports current state or controls the shared content panel, while the navigation container and content panel have no programmatic names or relationship. The outer title and navigation labels are also fixed Chinese strings even though Drawnix is already mounted under a Chinese/English provider. Correcting these user-observable focus, keyboard, semantic, and language contracts requires approval.

## What Changes

- Expose only the existing Settings WinBox as a localized named non-modal dialog, without changing global WinBox defaults or trapping focus.
- Give its visible split, maximize/restore, and close title-bar controls localized button semantics, tab stops, current state where applicable, and Enter/Space behavior equivalent to their existing pointer callbacks.
- Establish guarded focus entry, unhandled-Escape close, and safe focus restoration while preserving the existing discovery/persistence close guards and pending-draft save-before-close behavior.
- Give the shared four-view navigation a localized programmatic name, expose exactly one current view, and relate every navigation button to the existing active-content panel.
- Render only shared Settings title, navigation, and title-bar action copy through the existing Chinese/English provider while preserving mounted view, drafts, focus, callbacks, and all user/provider/model data.
- Preserve visible actions, window geometry rules, navigation order, pointer behavior, settings values, persistence, discovery, routing, analytics, and data formats.

## Impact

- Affected specs: `settings-surface-accessibility` (new delta capability)
- Affected code: opt-in Settings props/decoration in `WinBoxWindow.tsx`, the shared shell/navigation in `settings-dialog.tsx`, F-26-scoped i18n keys, and focused component/browser tests
- Entry boundary: all current writers of `appState.openSettings` continue using the same state and intent handoffs; this change adds no Settings entry or provider request
- Adjacent owners:
  - `improve-provider-model-settings-accessibility` retains provider/model content controls and F-09 copy.
  - `improve-settings-toolbar-accessibility` retains application-menu submenus, toolbar More, and the canvas task-card switch.
  - `improve-tool-window-accessibility` retains toolbox tool windows and explicitly excludes global/non-tool WinBox consumers; any shared primitive must remain independently opt-in.
  - `ensure-settings-write-consistency` retains settings commit, rollback, failure, and retry behavior.
  - `fix-winbox-minimum-size-consistency` retains the independently confirmed shared normal-size/minimum/restore geometry boundary.
  - Settings discovery, routing, benchmark, credential, compact geometry, theme, and responsive changes retain their existing boundaries.
- Data/network impact: none; no settings, provider, preset, board, cache, localStorage, IndexedDB, API, analytics, or migration schema changes
- Rollback: remove the Settings-only opt-in semantics/focus handlers, shared navigation relationships, scoped translations, and focused tests; no data or cache recovery is required

## Evidence

- `packages/drawnix/src/components/toolbar/app-toolbar/app-menu-items.tsx:225-244`, `components/command-palette/command-registry.ts:375-382`, `components/ai-input-bar/ModelDropdown.tsx:542-557`, Chat/toolbox/video-analyzer callers, and `drawnix.tsx:715-741,1667-1670` set the same `openSettings` state from explicit and gated/programmatic paths.
- `packages/drawnix/src/components/settings-dialog/settings-dialog.tsx:766-787,3097-3216` owns the four-view transition and renders the shared navigation, content panel, and non-modal Settings `WinBoxWindow`.
- `packages/drawnix/src/components/settings-dialog/settings-dialog.tsx:1605-1607,1732-1859` owns close/save behavior. `handleWindowClose` refuses to close during discovery or persistence and otherwise delegates to `handleCancel`, which preserves the current save-before-close path for pending drafts.
- `packages/drawnix/src/components/winbox/WinBoxWindow.tsx:537-541,607-624,823-835,873-905,1127-1208` creates the third-party window/control DOM, forwards close, and tracks pointer/focus activation, but supplies no Settings-specific dialog, title-control keyboard, focus-entry/restoration, or Escape contract.
- Production DOM: `.winbox-settings-window` had `role=null`, `aria-label=null`, `aria-labelledby=null`, `aria-modal=null`, and `tabindex=null`; its visible `.wb-split`, `.wb-max`, and `.wb-close` spans all had no role, accessible name, or tab stop. The visible `.wb-title` had text `设置` but no `id` relationship.
- Production focus result: opening Settings from the application menu left `document.activeElement` on `BODY`; Escape from the focused provider navigation button left `windowCount=1`; pointer close changed `windowCount` to 0 and left focus on `BODY`.
- Production navigation result: after pointer selection moved the active CSS class between existing views, all four buttons still had `aria-current=null`, `aria-pressed=null`, `aria-selected=null`, and `aria-controls=null`; `.settings-dialog__main` had no role, name, or ID.
- `packages/drawnix/src/i18n.tsx:124-130,316-323,505-512,599-638` already owns `settings.title` in Chinese/English and live language state, but `settings-dialog.tsx:112-117,3179` hard-codes the shared title/navigation strings and does not consume `useI18n`.
- Before screenshot: `docs/evidence/f26-settings-toolbar/settings-shell-desktop-1280x720-before.jpg`. No after screenshot or visual-improvement claim exists.

## Approval

Implementation is blocked until the user approves the Settings-only dialog/title-control/focus/Escape contract, the four-view current/panel relationship, and the scoped Chinese/English shell copy.
