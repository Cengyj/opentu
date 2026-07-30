# Change: Improve version-update interface accessibility

## Why

VersionUpdatePrompt mounts inside the existing zh/en I18nProvider but leaves useI18n unused and hard-codes all application-owned notice, button and dialog strings in Chinese. A controlled English render confirmed the Chinese prompt/buttons/header. The same render found no status/alert for the newly appearing notice and no dialog or aria-modal contract for the visually modal changelog.

Localization, announcement, modal focus/Escape and motion behavior are user-observable, so implementation requires approval. Notification replay correctness is deliberately owned by fix-version-update-notification-delivery.

## What Changes

- Add typed Chinese/English strings for the existing update-ready, view-changelog, update-now and changelog-title surfaces.
- Expose one concise update-ready sentence as a bounded polite status without making release notes live.
- Give the existing changelog view a named modal, initial focus, Escape/close and focus-return contract using a project-owned accessible adapter/primitive.
- Preserve version and changelog values as release data and preserve all callbacks.
- Respect reduced-motion preference for the nonessential prompt entry animation.
- Add zh/en, live-language, status/modal/focus and regression tests.

## Impact

- Affected specs: version-update-interface-accessibility
- Affected code: packages/drawnix/src/i18n.tsx, components/version-update/version-update-prompt.tsx and SCSS, focused tests
- Preserved data/API semantics: no SW/cache/version/task/workspace/provider/storage/public API or migration change
- User-visible result: system copy follows current language and update/changelog state has bounded accessible semantics
- Performance claim: none; chunk size and mount/render timings must be compared rather than inferred

## Evidence

- version-update-prompt.tsx:6 imports useI18n; :13 leaves it unused; :90-134 hard-codes Chinese.
- The notice at :90 has no status/live contract.
- The TDesign Dialog call at :116-134 supplies no semantic naming adapter; controlled render found dialog=0 and aria-modal=0.
- I18nProvider at i18n.tsx:579-649 is the current language owner and the component is inside it.
- Controlled English raw values: Chinese prompt/header/buttons, status=0, alert=0, dialog=0, ariaModal=0; corrected evidence run exit 0, 1/1 test.
- Full evidence: docs/evidence/f01-startup-recovery-ui/diagnostics.md.

## Approval Gate

Implementation is blocked until the user approves localized copy, bounded status, modal focus/Escape/return behavior and reduced-motion handling. This proposal does not approve prompt replay, COMMIT_UPGRADE, task guards, layout/z-index changes or release-note translation.
