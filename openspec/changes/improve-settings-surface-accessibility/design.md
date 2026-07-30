## Context

`appState.openSettings` is the single visibility owner for the shared Settings surface. Explicit launchers and API/tool/model gates set that state; Drawnix conditionally mounts `SettingsDialog`; `SettingsDialog` retains all view/draft/discovery/persistence state and renders a non-modal `WinBoxWindow`; WinBox creates the actual root, title, and control spans outside the React return tree; React portals the Settings content into `.wb-body`.

The confirmed gap is the shared surface contract, not provider/model content or persistence. The current window can only close through WinBox's pointer control and `onClose`; `SettingsDialog.handleWindowClose` is the necessary guard because it blocks close while discovery/persistence is active and sends pending drafts through the existing save path. Any keyboard close must enter that same function exactly once.

Two active changes may touch the same source files but own different opt-ins. F-15 tool-window accessibility must not turn on Settings behavior, and F-09 provider/model accessibility must not own the outer shell. The implementation may reuse a small WinBox decorator primitive after rebasing, but caller enablement, copy, tests, and approval remain independent.

## Goals / Non-Goals

- Goals:
  - Make the existing Settings window discoverable as a localized non-modal dialog.
  - Provide keyboard parity and names for the visible Settings title-bar actions.
  - Make focus entry, guarded Escape, and close focus return deterministic without a modal focus trap.
  - Expose the current one of four Settings views and its relationship to the existing content panel.
  - Localize only shared shell/navigation/action copy and preserve mounted state during live language changes.
- Non-Goals:
  - Change provider/model/preset/canvas/TTS content behavior or translate content owned by F-09 or another feature.
  - Change settings save, failure, retry, discovery, route, credential, benchmark, or pending-action semantics.
  - Add arrow-key tab behavior, a new shortcut, a modal focus trap, a new Settings entry, or a new view.
  - Change global WinBox defaults, toolbox windows, generation windows, media windows, geometry, z-index, target sizes, theme, compact layout, or responsive breakpoints.
  - Claim visual or performance improvement without matched evidence.

## Decisions

- Decision: add or reuse an opt-in accessibility contract on `WinBoxWindow`; `SettingsDialog` supplies its localized title and visible action names. Unrelated WinBox callers receive no new semantics until their own approved change opts in.
- Decision: the Settings root uses `role="dialog"`, a relationship to the visible title, and non-modal semantics. It receives a programmatic focus target but does not trap Tab, inert the canvas, or claim `aria-modal="true"`.
- Decision: on open, defer fallback focus until portaled content exists. Preserve intentional focus already placed inside the new surface; otherwise focus a stable Settings target. Explicit invoker identity is captured before focus moves. On actual close, return focus only to a still-connected invoker or an explicitly related persistent launcher; never force focus to an unrelated control.
- Decision: decorate only visible Settings title-bar controls. Split, maximize/restore, and close expose button semantics, localized names, and normal tab stops. Enter/Space invoke the same existing callback once. The maximize control exposes the current maximize/restore meaning without changing geometry logic; hidden minimize/full controls remain absent from the tab order and accessibility tree.
- Decision: an unhandled Escape from within the active Settings surface calls the existing `handleWindowClose` path once. Nested discovery dialogs, popovers, comboboxes, viewers, or editors receive the event first. A prevented/stopped nested Escape, an open discovery dialog, active persistence, or a failed pending-draft save must not bypass existing guards or restore focus as though the outer window closed.
- Decision: keep the four native buttons as ordinary in-surface navigation rather than introducing a tablist. The navigation container gets a localized name, exactly one button exposes `aria-current`, every button controls one stable active-panel ID, and the panel is a localized region labelled by the current button. Enter/Space and pointer activation continue to call `handleViewChange` once; no new arrow-key behavior is introduced.
- Decision: consume the existing `useI18n` context in the shared shell. Reuse `settings.title`; add typed F-26 keys for the navigation group, four view labels, active panel where needed, and visible title-bar actions. A live language change updates these strings through `WinBoxWindow.setTitle`/DOM decoration without resetting the active view, drafts, discovery, scroll, or focus.
- Decision: accessible names contain only application-authored action/view copy. They never include API keys, URLs, provider/model/user values, prompts, raw errors, persisted payloads, or analytics data.

## Invariants

- `openSettings`, provider-navigation intents, active view values, view order, and all existing entry routes remain unchanged.
- Split/maximize/restore/close pointer callbacks, close guards, pending-draft save-before-close behavior, and callback count remain unchanged.
- Provider/profile/model/preset/TTS/canvas values, drafts, storage keys, schemas, migrations, request routing, discovery, benchmark, analytics payloads, and error text remain unchanged.
- One navigation activation produces one existing `handleViewChange` transition and analytics event; language changes do not emit a view-change event.
- The non-modal window does not trap focus or make the rest of the application inert.
- A blocked or failed close leaves Settings open and does not perform close-focus restoration.

## Alternatives Considered

- Globally decorate every WinBox consumer.
  - Rejected because callers have different modal, focus, close, and title-action semantics and active changes explicitly separate their owners.
- Put a second React dialog wrapper inside `.wb-body`.
  - Rejected because assistive technology would still encounter unnamed outer controls and two competing dialog surfaces.
- Use hover tips, CSS generated content, or `title` attributes for title-bar names.
  - Rejected because the existing spans would remain unfocusable and would not receive button keyboard behavior.
- Convert the four views to a tablist with arrow navigation.
  - Rejected because this would add a new keyboard contract and roving-tab behavior without evidence that the current navigation is intended as document tabs.
- Restore focus to one global Settings launcher after every close.
  - Rejected because Settings opens from multiple distinct user and programmatic routes; an unrelated fallback would create a new focus jump.
- Synthesize a close-button click for Escape.
  - Rejected because it can duplicate third-party behavior and can bypass or race the React close guard. Escape must call the same guarded owner once.

## Risks / Trade-offs

- WinBox recreates and mutates title/control DOM outside React.
  - Mitigation: decorate after creation and after title/maximize-state changes, remove listeners/attributes on cleanup, and test reopen cycles.
- F-15 and F-26 may both add an opt-in WinBox primitive.
  - Mitigation: rebase onto one narrow primitive if one lands first; keep caller-specific props, labels, handlers, and tests separate.
- Focus entry can override content autofocus or a later gated workflow.
  - Mitigation: defer only the fallback, respect focus already inside, inventory every current `openSettings` writer, and test explicit, gated, programmatic, and disconnected-invoker paths.
- Escape can close the outer surface while a child surface is active.
  - Mitigation: listen only within the active Settings window, honor prevented/handled events, then call `handleWindowClose`, whose discovery/persistence guards remain authoritative.
- Language changes can rebuild view metadata and reset mounted state.
  - Mitigation: keep stable view values/IDs and derive labels only; test draft, active view, focus, scroll, and callback counts across live language changes.
- Added landmarks can become noisy.
  - Mitigation: use one named navigation and one current content region inside the one named non-modal dialog; do not add nested main/dialog roles to every content view.

## Verification And Rollback

- Component tests mock WinBox DOM creation and cover Settings-only root/title/control decoration, hidden controls, maximize/restore state, Enter/Space parity, callback counts, reopen cleanup, and no effect on an unopted caller.
- Settings tests cover explicit and gated/programmatic opens, focus preservation/fallback, nested Escape precedence, discovery/persistence guards, pending-save success/failure, actual-close focus return, disconnected invokers, and no focus trap.
- Navigation tests cover exactly one current button, stable `aria-controls`/panel relationship, pointer/Enter/Space transitions, unchanged analytics count, no arrow contract, and live zh/en changes without view/draft/focus reset.
- Browser checks cover Chinese/English, app menu/command palette/model/chat/toolbox/API-gate entry classes without real provider calls, split/maximize/restore/close, nested surfaces, desktop/tablet/mobile, pointer/keyboard/touch, light/dark, zoom/high-DPI, and reduced motion where supported.
- Capture matched before/after screenshots only after approval and implementation. Record exact commands, exits, counts, geometry, and baseline failures without claiming visual/performance improvement from semantics alone.
- Rollback removes the Settings opt-in props/decorator/listeners, focus handoff, nav relationships, F-26 translations, and tests. No data migration, cache invalidation, credential rewrite, or recovery is required.
