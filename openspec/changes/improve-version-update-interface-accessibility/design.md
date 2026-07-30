# Design: Version-update interface accessibility

## Context

The update notice is delayed non-critical UI inside Drawnix's I18nProvider. It owns only visible copy and local notice/dialog state. Bootstrap/SW own update readiness, waiting worker, commit and reload. useTaskQueue owns the active-task guard.

## Goals and non-goals

Goals:

- Use the selected application language for application-owned update controls.
- Announce readiness once in a concise bounded region.
- Give the changelog a reliable named modal/focus contract.
- Preserve release values, task blocking and update callbacks.
- honor reduced motion without changing state timing.

Non-goals:

- Repair pre-mount event loss; fix-version-update-notification-delivery owns it.
- change the five-second/idle mount; refactor-startup-shell-loading owns it.
- translate version numbers or changelog entries.
- change active-task, confirmation, SW commit, activation or reload semantics.
- change notice position, z-index, width or touch targets without separate geometry evidence.
- add update dismissal, snooze, settings or automatic update.

## Decisions

### Reuse the typed application i18n owner

Add narrowly scoped keys to the existing Translations interface and both zh/en maps. Version strings and changelog list entries are interpolated/rendered as data. Language switching while the notice/dialog is open rerenders labels without closing the dialog or repeating fetch/confirmation.

### Announce only the readiness summary

The notice root or a dedicated bounded child uses role=status and polite atomic announcement for “version X is ready.” Buttons, full changelog and release content are not live. Duplicate readiness for the same rendered version must not produce repeated remount announcements.

### Use a project-owned modal contract

The current third-party Dialog render did not expose dialog/aria-modal semantics. Use the existing accessible project dialog primitive or a minimal adapter around the current visual component that provides:

- one dialog/aria-modal root named by the localized visible header;
- focus on the first meaningful changelog/update control after open;
- Escape invokes the existing close callback exactly once;
- close returns focus to the “view changelog” trigger;
- no Enter shortcut that silently commits an update unless the focused native update button is activated.

Do not patch third-party source.

### Respect reduced motion

Keep the current 300 ms slide animation for normal preference and remove the transform/animation under prefers-reduced-motion. State visibility and timing remain unchanged.

## Invariants

- activeTasks.length > 0 still hides the prompt.
- updateAvailable/showChangelog remain local UI state.
- one explicit update action still dispatches one user-confirmed-upgrade event.
- version/changelog data remains unmodified and non-live.
- no new storage, cache, SW message or provider/task operation.
- language switching does not fetch version.json again.
- prompt delivery lifetime is unchanged by this change.

## Risks and mitigations

- Duplicate screen-reader announcement: one atomic summary, stable mounted node/version identity, focused tests.
- Modal focus conflict with TDesign internals: prefer the existing project-owned primitive; test actual DOM, not assumed library behavior.
- Escape bubbles to canvas/global shortcuts: stop only the handled dialog Escape and assert one close/no update.
- Accidental release-note translation: sentinel mixed-language changelog tests.
- CSS motion rule changes visibility: test same visible state with and without reduced motion.

## Verification

- zh/en initial and live-switch tests for notice/buttons/header while version/changelog sentinels remain unchanged.
- one bounded status, no live changelog/raw release content and no repeated announcement on unrelated rerender.
- dialog role/name/modal, open focus, Tab containment/delegation as supported by the project primitive, Escape close, trigger focus return and exact callback counts.
- active-task hidden/reappear, missing changelog, fetch failure fallback and explicit update regression tests.
- reduced-motion style/animation tests.
- 1280/768/390/320 visual checks remain regression-only until separate overflow evidence exists.
- Focused tests/lint/Drawnix typecheck, full tests/cycles/build/size/startup against baseline.

## Rollback

Restore Chinese literals/current TDesign call and entry animation, remove scoped i18n keys/tests, and leave all update readiness/commit/task behavior untouched. No data/cache/storage rollback. With no Git metadata, maintain an explicit file patch.
