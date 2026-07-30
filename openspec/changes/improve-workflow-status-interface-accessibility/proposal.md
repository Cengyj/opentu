# Change: Improve Workflow Status Interface Accessibility

## Why

The existing Chat workflow bubble and canvas WorkZone expose the same workflow lifecycle visually, but controlled real-component rendering found no progressbar or bounded live status semantics on either surface. Chat step details and Agent tool-call/result details are pointer-only `div` disclosures: pointer activation expands them, while they have no role, tab stop, or Enter/Space behavior. Under an English `I18nProvider`, both surfaces still render Chinese application labels; the independent WorkZone React root creates a new default-Chinese provider rather than following the current application language.

Measured compact evidence also found 24×24, 24×24, and 115×26.5 CSS-pixel WorkZone actions at 390×844. At 320×568, a long workflow title forces the three-character running status into a 28×58 vertical stack. Forced-light contrast samples measured 1.90:1 for Chat step status text and 4.41:1 for the 11 px WorkZone failed-step text. Correcting these keyboard, assistive-technology, localization, compact-layout, touch-target, and contrast behaviors is user-observable and requires approval.

## What Changes

- Make existing Chat step-detail and Agent tool-call/result disclosures native or equivalent keyboard-operable controls with localized names, expanded state, visible focus, and pointer parity.
- Expose each existing Chat/WorkZone visual progress bar as a determinate progressbar and announce only bounded lifecycle transitions; do not announce every animation frame, raw prompt, tool arguments, result, URL, task ID, or provider error.
- Localize application-owned workflow labels in Chinese and English and make the independent WorkZone root follow the current application language without changing user-authored/generated content.
- Keep long workflow titles and status/count information readable at 320 CSS px and wider; keep existing WorkZone actions within the fixed card while providing the project's 44×44 CSS-pixel compact touch targets without enlarging glyphs.
- Raise small workflow status/error text to at least 4.5:1 against its actual background by reusing the current forced-light theme variables or scoped equivalent tokens.
- Keep workflow status derivation, task projection, recovery, persistence, cancellation, retry ownership, provider routing, board schema, and application-wide theme support unchanged.

## Impact

- Affected specs: `workflow-status-interface-accessibility`
- Affected code:
  - `packages/drawnix/src/components/chat-drawer/WorkflowMessageBubble.tsx`
  - `packages/drawnix/src/components/chat-drawer/workflow-message-bubble.scss`
  - `packages/drawnix/src/components/workzone-element/WorkZoneContent.tsx`
  - `packages/drawnix/src/components/workzone-element/workzone-content.scss`
  - `packages/drawnix/src/components/startup/ToolProviderWrapper.tsx`
  - `packages/drawnix/src/i18n.tsx` and focused tests only as required to mirror the existing language into an independent React root
- Related changes:
  - `fix-main-thread-workflow-recovery-sync` owns task-backed recovery, task-event projection, cross-workflow isolation, and persisted terminal-state convergence.
  - `improve-task-queue-responsive-accessibility` owns task-drawer semantics, layout, localization, and announcements; this change owns only Chat workflow bubbles and WorkZone cards.
  - `update-ui-color-system` owns the broader palette. This change may select existing tokens or scoped contrast-safe equivalents but SHALL NOT add dark mode or redesign the global color system.
- Preserved data/API semantics: no workflow/task/chat/board storage shape, cache key, migration, model/provider request, analytics payload, cancellation, retry callback result, media insertion, or recovery-owner change
- Privacy: accessible names and live announcements SHALL contain localized application labels and bounded counts/status only; user prompt/title/result/error/tool payload/URL/task identifiers/credentials SHALL NOT be copied into new announcement strings
- Rollback: revert the semantic attributes/control wrappers, localized workflow strings/language bridge, compact/contrast styles, and focused tests together; no user-data cleanup or migration is required

## Evidence

- `WorkflowMessageBubble.tsx:129-163,255-329` attaches click handlers to generic disclosure `div` elements. Controlled rendering found zero focusable disclosure entries; pointer click expanded them and Enter did not.
- `WorkflowMessageBubble.tsx:592-610` and `WorkZoneContent.tsx:384-401` render visual progress/counts with no progressbar role or value attributes. The controlled render found zero progressbars and zero live regions on both surfaces.
- `WorkflowMessageBubble.tsx:47-60,169-205,232-341,406-501,615-646,683-799` and `WorkZoneContent.tsx:257-263,327-468` contain application-owned Chinese literals. `ToolProviderWrapper.tsx:38-51` creates a default-language provider for the independent WorkZone root. English-provider rendering still contained `执行中`, `待执行`, failure, and retry copy.
- `workzone-content.scss:91-148,288-318` fixes the current action geometry; browser measurements at 390×844 were 24×24, 24×24, and 115×26.5 CSS px.
- `workflow-message-bubble.scss:37-89,401-412` has no compact title/status shrink contract. At 320×568 the long title measured 130×84 and the three-character running status measured 28×58.
- Forced-light contrast samples were 1.90:1 for Chat step status text and 4.41:1 for WorkZone failed-step text. `apps/web/src/styles.scss:100-109` explicitly forces light mode, so lack of dark mode is not classified as an existing-feature defect.
- `apps/web/src/styles.scss:267-272` already suppresses repeating animation under reduced-motion. Component-level reduced-motion absence is therefore a non-finding for this change.
- Runtime measurements, hashes, screenshots, and diagnostic command output are recorded in `docs/evidence/f11-workflow-ui-accessibility/`.
