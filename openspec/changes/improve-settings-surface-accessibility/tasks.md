## 1. Evidence And Approval

- [x] 1.1 Trace all current Settings open writers through `appState.openSettings`, Drawnix lazy mount, `SettingsDialog`, and the WinBox DOM boundary.
- [x] 1.2 Trace close, pending-draft persistence, discovery/persisting guards, final unmount, and downstream pending Chat/toolbox continuation paths.
- [x] 1.3 Inspect the production Settings root, visible title controls, initial/close focus, and Escape behavior at 1280×720 without reading credentials or invoking a provider.
- [x] 1.4 Inspect pointer current-view transitions, all four navigation states, the shared content panel relationship, and native-button positive controls.
- [x] 1.5 Capture and verify the matched Settings-shell before screenshot and record the environment, hash, and cleanup boundary.
- [x] 1.6 Separate F-26 shared shell/navigation ownership from F-09 content, F-15 tool windows, settings durability, canvas switch/menu, compact/theme/geometry, and provider behavior.
- [ ] 1.7 Obtain user approval for the dialog/title-control/focus/Escape contract, current-view/panel relationship, and scoped Chinese/English copy.

## 2. Failing Tests And Settings Window (Approval Required)

- [ ] 2.1 Add failing tests for a localized named non-modal Settings root and visible/hidden title-control semantics.
- [ ] 2.2 Add failing tests for split, maximize/restore, and close Enter/Space parity, current state, and exactly-once callbacks.
- [ ] 2.3 Add failing tests for explicit/gated open focus, intentional child focus preservation, connected/disconnected invokers, and actual-close restoration.
- [ ] 2.4 Add failing tests for unhandled Escape, nested-surface precedence, discovery/persisting guards, and pending-save success/failure.
- [ ] 2.5 Implement the minimum Settings-only WinBox opt-in and focus handoff without changing global WinBox defaults or third-party source.
- [ ] 2.6 Preserve pointer actions, geometry logic, activation ordering, close guards, pending continuations, and all settings/data behavior.

## 3. Failing Tests And Shared Navigation (Approval Required)

- [ ] 3.1 Add failing tests for the localized navigation name, exactly one current button, stable control relationship, and named active-content region.
- [ ] 3.2 Add pointer, Enter, and Space tests for all four existing views with exactly one transition/analytics event per activation.
- [ ] 3.3 Prove no new arrow-key/tablist behavior, no focus reset, and no provider/discovery/storage/network side effect from semantic navigation.
- [ ] 3.4 Implement the minimum navigation/panel relationships while retaining native buttons, values, order, layout, and `handleViewChange`.
- [ ] 3.5 Cover normal, empty, loading, failure, discovery-open, compact catalog/detail, and long-label render states where fixtures exist.

## 4. Scoped Localization (Approval Required)

- [ ] 4.1 Add typed Chinese/English keys for only the shared title, navigation group/views/panel, and visible Settings title-bar actions.
- [ ] 4.2 Add initial and live language-change tests for WinBox title/root name, controls, navigation, and active panel.
- [ ] 4.3 Preserve active view, drafts, discovery, scroll, focus, private/user data, callbacks, and analytics across language changes.
- [ ] 4.4 Keep provider/model content with F-09 and TTS/preset/canvas content with their current owners; do not translate or mutate data values.

## 5. Verification

- [ ] 5.1 Run focused WinBox/Settings/i18n/navigation tests with exact file/test counts, exit codes, and zero external provider requests.
- [ ] 5.2 Run focused lint and Drawnix typecheck, then full typecheck/tests/cycles/build/size/startup against the recorded baseline.
- [ ] 5.3 Verify all current entry classes, focus entry/return, nested Escape, blocked/failed close, and title actions with keyboard and pointer.
- [ ] 5.4 Verify Chinese/English and desktop/tablet/mobile, light/dark, 100%/200%, high-DPI, touch, and reduced-motion states where the environment supports them.
- [ ] 5.5 Capture same-state before/after screenshots and exact control/window/panel geometry; make no visual or performance claim without measured evidence.
- [x] 5.6 Attempt strict OpenSpec validation; the CLI is unavailable (exit 127), so complete manual file, scenario, unique-requirement, and active-owner checks without claiming strict validation.
