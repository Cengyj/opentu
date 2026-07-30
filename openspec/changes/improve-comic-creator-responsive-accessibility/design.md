## Context

`ComicCreator` is mounted in a WinBox whose width can change independently of the browser viewport. Its current responsive SCSS assumes those widths change together. Form labels mix native wrapping labels, visual sibling text, and composite dropdowns, while shared navigation uses internal English tokens for localized icon actions.

## Goals / Non-Goals

- Goals:
  - Keep every primary comic control inside the resizable content container at audited compact widths.
  - Preserve readable model identity and normal keyboard reachability.
  - Give each visible comic form/history control one localized accessible name.
  - Preserve visual and pointer behavior at the existing 720 px default width.
- Non-Goals:
  - Do not change outer WinBox geometry, focus entry, Escape behavior, title-bar controls, or viewport-transition recovery.
  - Do not redesign the workflow, add mobile navigation, change generation/export behavior, or alter stored preferences.
  - Do not include dark-theme color changes until a controlled dark-theme runtime sample closes that evidence gap.

## Decisions

- Decision: use a comic-owned inline-size container boundary and reuse the existing compact rule set.
  - Alternative: add more browser viewport breakpoints.
  - Rejected because desktop users can resize the WinBox without changing the viewport.
- Decision: keep the existing 640 px compact threshold as the initial acceptance boundary.
  - It already represents project intent; no new breakpoint is invented.
- Decision: use native `label`/stable ID associations for native fields and an optional localized accessible-name prop for composite model controls.
- Decision: make `WorkflowNavBar` accept localized action names with safe defaults, then update audited call sites without changing icons/counts/callbacks.
  - Coordinate the optional model naming API with `improve-video-workflow-form-accessibility`.

## Invariants

- The selected scenario, page count, prompt mode, model ID/ref, and history filter values do not change during adaptation.
- Container adaptation is CSS-only and is not persisted as a user preference.
- Every visible control has exactly one useful accessible name; names contain no prompt bodies, credentials, task IDs, or stored record content.
- Default 720 px layout, generation requests, exports, storage, analytics, and outer window behavior remain unchanged.

## Risks / Trade-offs

- Container-query support may differ in older browsers.
  - Mitigation: retain the existing viewport media query as fallback and validate the supported browser matrix before implementation.
- Composite dropdown styles may impose their own minimum width.
  - Mitigation: assert the actual input/trigger bounds rather than only parent CSS.
- Shared navigation naming could affect other workflows' snapshots.
  - Mitigation: optional localized props, focused consumer tests, and no visual text changes.

## Verification And Visual Thresholds

- Component tests for story/model/history labels and localized workflow navigation names.
- Same light-theme data at 400, 640, and 720 px comic container widths inside a `1280×844` viewport.
- Every primary control rectangle stays within the comic content rectangle; document and comic horizontal overflow are zero.
- Selected model text remains visible at 400 px; no prompt-mode or primary action overlap.
- Keyboard-only checks for Tab order, Enter/Space activation, and native select operation.
- Same-viewport before/after screenshots; no layout shift at the 720 px default width.
- Dark theme remains an explicit unknown until a controlled theme switch is available; do not claim dark-theme verification from source inspection.

## Rollback

Remove the comic container boundary/rules, localized naming props/call sites, and focused tests. No data, cache, task, or preference migration is required.

