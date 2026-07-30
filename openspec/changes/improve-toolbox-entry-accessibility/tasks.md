## 1. Evidence and Approval

- [x] 1.1 Trace toolbox card and child action callbacks through window open, canvas insert, and custom-tool delete entry points.
- [x] 1.2 Confirm current card/button semantics with source and a controlled accessibility-tree sample.
- [x] 1.3 Confirm that manifests, registry, window state, iframe permissions, storage, analytics schemas, and visual layout do not need to change.
- [x] 1.4 Audit the active toolbox runtime change for requirement/file overlap.
- [ ] 1.5 Obtain user approval for keyboard and assistive-technology observable behavior.

## 2. Implementation (approval required)

- [ ] 2.1 Add failing component tests for card role/name/tab stop, Enter/Space activation, and child action isolation.
- [ ] 2.2 Add failing tests for tool-specific accessible names on delete, insert, and open-window controls.
- [ ] 2.3 Implement the minimum semantic, keyboard, and accessible-name changes in `ToolItem`.
- [ ] 2.4 Preserve existing classes, hover tips, data-track attributes, callbacks, and visual geometry.

## 3. Verification

- [ ] 3.1 Run focused ToolItem/toolbox/window tests, ESLint, and Drawnix typecheck.
- [ ] 3.2 Verify keyboard order, focus visibility, Enter/Space, pointer parity, and accessible names at 1280×720 and 390×844.
- [ ] 3.3 Run available toolbox feature/smoke/visual/responsive Playwright tests and classify browser/tool blockers separately.
- [ ] 3.4 Compare full typecheck, unit tests, cycles, build, size, startup, and lint with the recorded baseline.
- [ ] 3.5 Run OpenSpec strict validation; while the CLI is unavailable, record the blocker and complete a manual format/conflict audit.

