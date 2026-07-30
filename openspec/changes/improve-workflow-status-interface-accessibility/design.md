## Context

Chat workflow messages are rendered inside the main `I18nProvider` through `ChatDrawerProvider` and `ChatMessagesArea`. WorkZone content is rendered by `withWorkZone` in a separate `createRoot`, wrapped by `ToolProviderWrapper`; React context cannot cross that root boundary. Both surfaces receive the same `WorkflowMessageData` shape and derive visible status/counts locally.

The pending `fix-main-thread-workflow-recovery-sync` change may alter how persisted tasks project into that data, but it does not need to own the markup that communicates an already-derived state. This change consumes the existing workflow data and callbacks only. It must remain valid before or after the recovery change and must not introduce a third status owner.

## Goals / Non-Goals

### Goals

- Keyboard and assistive-technology parity for existing detail disclosures.
- Determinate, non-noisy progress/lifecycle semantics on Chat and WorkZone.
- Chinese/English application-copy parity across the main and independent React roots.
- Readable compact workflow headers, compact touch targets, and contrast-safe small status text.
- Focused component and browser evidence without provider calls or user-storage inspection.

### Non-Goals

- Change workflow/task status derivation, execution, cancellation, retry semantics, refresh recovery, persistence, or canvas insertion.
- Add workflow management/history, new actions, a new status, or a new product feature.
- Add dark mode, replace the global palette, redesign Chat/WorkZone, or change the fixed WorkZone data geometry.
- Replace global reduced-motion handling; current source already bounds the component animations.

## Decisions

### 1. Use the existing disclosure state as the only expanded-state owner

Chat step rows and Agent tool-call/result headers will become native buttons where valid, or equivalent named controls when the current structure requires it. `expanded` remains the only state owner. Enter/Space, pointer activation, `aria-expanded`, and any controlled region ID all drive the same callback once. Non-detailed rows remain non-interactive.

Alternative: add document-level keyboard listeners. Rejected because it would create a second activation path and could collide with nested links, media viewers, code blocks, or Chat input shortcuts.

### 2. Expose determinate progress and bounded status announcements

The existing normalized completed/total values remain authoritative. Each visual bar exposes `role="progressbar"`, localized name, minimum 0, maximum 100, and the same clamped current value used for width. A nearby concise polite status announces meaningful lifecycle/step-count transitions, while failure summaries retain their existing visible content.

Announcements use generic localized state and numeric counts only. They do not repeat per animation frame and do not include workflow names, prompts, step descriptions, tool names/arguments, raw results, errors, URLs, task IDs, or credentials.

Alternative: apply `aria-live` to the entire bubble/card. Rejected because step output, logs, errors, and generated content can be large, sensitive, and noisy.

### 3. Mirror the existing language into the independent WorkZone root

`WorkflowMessageBubble` and `WorkZoneContent` consume the existing i18n language and a focused workflow-label map. The separate WorkZone root receives the current language through a minimal read/subscription bridge owned by the existing i18n module; no second persisted language key or board field is introduced. A language switch rerenders both roots from the same application language.

Only application-owned labels are translated. Workflow/user names, prompts, step descriptions, tool names, Agent content, results, errors, URLs, IDs, and persisted records remain byte-for-byte unchanged.

Alternative: leave a nested default-Chinese provider and translate only Chat. Rejected because the two projections would still disagree. Persisting a WorkZone-specific language is also rejected because it creates a conflicting state owner.

### 4. Preserve compact information hierarchy and enlarge only hit boxes

At 320 CSS px, the header reserves a non-shrinking one-line area for status/count while constraining the workflow title to the available width and at most two visible lines with the full value still available to assistive technology. It must not create horizontal overflow.

At the current compact/pointer-coarse boundary, WorkZone hide/delete/retry controls receive at least 44×44 CSS-pixel interactive boxes. Icons and action order remain unchanged, and controls stay inside the existing card. Desktop density is preserved unless the same viewport also matches the compact/touch condition.

Alternative: hide status, actions, or truncate the status label. Rejected because it removes existing lifecycle/action information. Shrinking below current sizes is rejected because it worsens the measured touch issue.

### 5. Meet small-text contrast without expanding the palette scope

Small normal status/error text uses current theme variables where they meet 4.5:1, or a scoped contrast-safe value derived from the current forced-light palette. State remains conveyed by text/icon in addition to color. This change does not claim dark-theme support because the application explicitly forces `color-scheme: light`.

## Invariants

- `WorkflowMessageData`, task events, Chat messages, WorkZone board elements, storage keys/schemas, and retry callback signatures do not change.
- A keyboard activation invokes the same existing handler exactly once; no retry, delete, hide, preview, or reply action is added or automatically invoked.
- Progress semantics expose the same normalized values shown visually and never infer state from color or animation.
- Localized UI text never alters stored or generated user/provider content.
- No new network request, provider call, cache read/write, analytics event, or storage mutation is introduced.

## Risks / Trade-offs

- Button conversion may inherit default browser styles or create nested-interactive markup. Mitigation: use reset/scoped token styles and keep controls outside nested interactive descendants; test DOM validity and one callback per activation.
- Live regions can duplicate announcements when Chat and WorkZone are both present. Mitigation: each surface announces only its own bounded lifecycle state, does not assertively interrupt, and tests repeated identical renders for zero new message.
- A module-level language subscription can leak listeners across independent roots. Mitigation: provide an unsubscribe function, use React subscription lifecycle, and test create/destroy plus repeated language switches.
- Enlarged WorkZone hit boxes can crowd a fixed card. Mitigation: measure 360×280 plus 320/390 viewport samples, long Chinese/English labels, failed/retrying states, and ensure no card overflow or hidden action.
- Title clamping can hide visible text. Mitigation: two-line compact clamp only, preserved full accessible text/title, and no change at desktop sizes.

## Verification

- Component tests: step/Agent disclosures expose localized names and expanded state; Enter, Space, pointer, and non-detailed rows each behave once; visible focus is present.
- Progress tests: Chat and WorkZone expose 0/partial/100 determinate values; pending/running/completed/failed transitions produce bounded generic announcements; unchanged rerenders and animation updates produce no duplicate announcement.
- Localization tests: Chinese/English main root and independent WorkZone root switch together; stored/user/provider strings remain unchanged and privacy sentinels do not enter names/live regions.
- Geometry tests/browser measurements: 320×568 and 390×844, long zh/en titles, 360×280 WorkZone, failure/retrying/confirmation states, no horizontal overflow, one-line status, and compact targets at least 44×44 CSS px.
- Visual checks: same data, viewport, forced-light theme, DPR, and zoom before/after; small text contrast at least 4.5:1. No unsupported dark-mode or performance claim.
- Run focused Chat/WorkZone tests, Drawnix typecheck/lint, full typecheck/test/cycles/build/size/startup, and available smoke/feature/visual/responsive Playwright flows against the recorded baseline.

## Rollback Plan

Revert the disclosure semantics, progress/live attributes, workflow label map/language bridge, compact/contrast styles, and focused tests together. Existing workflow/task/chat/board records require no migration or cleanup, and the prior pointer callbacks remain available.
