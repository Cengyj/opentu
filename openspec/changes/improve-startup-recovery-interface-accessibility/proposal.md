# Change: Improve startup recovery interface accessibility

## Why

The HTML boot shell has accessible loading/progress markup, but its terminal markError path leaves a 100% progressbar and polite status with no in-page action matching “refresh and retry.” The React ErrorFallbackUI is a blocking full-screen recovery card but exposes no dialog/alert region, initial focus, disclosure state/relationship or memory progress semantics.

A controlled render recorded dialog/alertdialog/alert/progressbar counts of zero, activeElement=body, and null aria-expanded/aria-controls before and after opening details. These are user-observable recovery, focus, localization and responsive changes, so implementation requires approval.

## What Changes

- Give the no-framework HTML boot failure state an assertive, named error contract and direct existing retry/safe-mode/debug routes.
- Keep normal loading progress semantics, but remove completed-progress semantics after a terminal failure.
- Give ErrorFallbackUI a named alertdialog, deterministic non-activating initial focus, explicit detail disclosure and bounded memory progress semantics.
- Make the recovery card/actions usable at compact widths, zoom, keyboard/touch and reduced-motion settings while retaining inline/no-application-CSS resilience.
- Use the selected runtime language when it is already available; keep the early pre-React shell on its document/default language and do not add language persistence.
- Preserve crash thresholds/storage, workspace initialization, lazy-chunk recovery, diagnostic content/export, safe-mode behavior and debug routes.

## Impact

- Affected specs: startup-recovery-interface-accessibility
- Affected code: apps/web/index.html, apps/web/src/app/ErrorBoundary.tsx, the smallest existing language bridge if required, focused App/recovery tests and documentation
- Preserved data/API semantics: no workspace/task/cache/SW/provider/diagnostic schema, crash threshold/history, migration, route or public package change
- User-visible result: startup failures are announced as failures and existing recovery actions become directly operable with named semantics/focus
- Performance claim: none; HTML bytes, bootstrap static graph and normal-startup timings must not regress the current budget

## Evidence

- apps/web/index.html:515-555 has status/progress but no recovery control.
- apps/web/index.html:1167-1182 marks terminal error by setting progress to 100 and changing text.
- apps/web/index.html:1427-1463 routes resource/script/rejection failures into that state.
- apps/web/src/app/ErrorBoundary.tsx:170-365 renders generic card/disclosure/memory structures.
- apps/web/src/app/app.tsx:931-958 and ErrorBoundary.tsx:56-85 are all current callers.
- Controlled component result: no dialog/alert/progress region, body focus, no disclosure attributes; exit 0, 1/1 test.
- Full evidence: docs/evidence/f01-startup-recovery-ui/diagnostics.md.

## Approval Gate

Implementation is blocked until the user approves the failure announcement, direct recovery actions, initial-focus target, compact behavior and runtime-language boundary. This change does not approve diagnostic sanitization or startup loading architecture work.
