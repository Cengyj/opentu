## 1. Evidence And Approval

- [x] 1.1 Trace the reachable Chat and WorkZone render, persistence, provider-root, and action callback chains in both directions.
- [x] 1.2 Render the real Chat and WorkZone components with synthetic workflow data under Chinese/English providers and record roles, names, focusability, progress, and live-region counts.
- [x] 1.3 Measure 390×844 and 320×568 geometry, compact action targets, long-title status layout, forced-light contrast, and capture before screenshots without reading user storage.
- [x] 1.4 Separate recovery/task-projection ownership from status-interface semantics and classify forced-light/reduced-motion behavior.
- [x] 1.5 Prove and remove the unreachable alternate `WorkZoneElement` implementation without changing the registered `WorkZoneComponent` path.
- [x] 1.6 Record OpenSpec CLI unavailability and use repository files for conflict/format validation.
- [x] 1.7 Complete manual requirement-name, heading, scenario, and active-owner validation for this change.
- [ ] 1.8 Obtain user approval for keyboard disclosures, progress/live semantics, localization bridging, compact layout/touch targets, and contrast changes.

## 2. Reproduction Tests (Approval Required)

- [ ] 2.1 Add failing Chat tests for step and Agent tool-call/result disclosure roles, names, expanded state, Enter/Space, pointer parity, focus visibility, and exactly-one activation.
- [ ] 2.2 Add failing Chat/WorkZone tests for determinate 0/partial/100 progress values and bounded pending/running/completed/failed announcements.
- [ ] 2.3 Add unchanged-rerender and privacy-sentinel tests that reject duplicate announcements and user/provider content in names/live regions.
- [ ] 2.4 Add Chinese/English tests for all application-owned workflow labels and runtime language switching in the independent WorkZone root.
- [ ] 2.5 Add 320/390 long-title, no-overflow, one-line-status, fixed-card, failure/retry, and 44×44 compact hit-box tests.
- [ ] 2.6 Add forced-light computed-color tests for at least 4.5:1 small workflow status/error text contrast.

## 3. Implementation (Approval Required)

- [ ] 3.1 Convert only detailed Chat step/Agent headers into semantic disclosures backed by the existing `expanded` state.
- [ ] 3.2 Add determinate progressbar values and bounded generic polite lifecycle status to Chat and WorkZone.
- [ ] 3.3 Add focused Chinese/English workflow application labels without translating stored/user/provider content.
- [ ] 3.4 Mirror the existing application language into independent WorkZone roots with cleanup-safe subscription and no new persistence owner.
- [ ] 3.5 Constrain compact workflow title/status/count layout without changing desktop geometry or introducing horizontal overflow.
- [ ] 3.6 Provide compact/pointer-coarse WorkZone hit boxes of at least 44×44 CSS px while preserving glyphs, action order, and fixed-card fit.
- [ ] 3.7 Replace only the measured low-contrast small-text values with current-token or scoped forced-light values meeting 4.5:1.

## 4. Verification

- [ ] 4.1 Run focused WorkflowMessageBubble, ChatMessagesArea, WorkZoneContent, i18n, and provider-wrapper tests with exact file/test counts and exit codes.
- [ ] 4.2 Verify pointer, Enter, Space, Tab/focus, disclosure state, retry/delete/hide callback counts, repeated state events, and independent-root teardown.
- [ ] 4.3 Verify Chinese/English, short/long/user-authored text, pending/running/completed/failed/retrying, empty/single/many steps, and privacy sentinels.
- [ ] 4.4 Capture same-state forced-light before/after screenshots at desktop, 390×844, and 320×568; record geometry, overflow, target sizes, and contrast.
- [ ] 4.5 Run Drawnix typecheck and focused lint, then full typecheck/test/cycles/build/size/startup against the baseline.
- [ ] 4.6 Run available smoke/feature/visual/responsive Playwright flows and classify browser/configuration blockers separately.
- [ ] 4.7 Run OpenSpec strict validation; while the CLI remains unavailable, record exit 127 and repeat the manual structure/name/conflict audit.
