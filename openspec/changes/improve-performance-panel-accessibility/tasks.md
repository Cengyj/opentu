## 1. Evidence and approval

- [x] 1.1 Trace delayed mount, visibility, actions, pointer movement, persistence, and rendered semantics.
- [x] 1.2 Run a controlled component diagnostic proving unnamed icon buttons and a non-keyboard move handle.
- [x] 1.3 Confirm polling, actions, visuals, storage schema, startup timing, and generic HoverTip remain outside this change.
- [ ] 1.4 Obtain user approval for localized semantics and bounded arrow-key movement.

## 2. Failing tests and implementation (approval required)

- [ ] 2.1 Add Chinese/English accessible-name, pressed, busy, disabled, and focus tests.
- [ ] 2.2 Add localized names/states to existing action buttons without changing callbacks.
- [ ] 2.3 Make the move handle semantic and add Arrow-key movement through the shared viewport clamp.
- [ ] 2.4 Add scoped focus-visible/native-button reset styles using existing tokens.
- [ ] 2.5 Preserve pointer drag, HoverTips, confirmation, thresholds, delayed mount, layout, and storage schema.

## 3. Verification

- [ ] 3.1 Run focused component/i18n/typecheck/lint tests with exact counts and exits.
- [ ] 3.2 Browser-check keyboard/pointer parity, focus order/visibility, Chinese/English, desktop/tablet/mobile, light/dark, and no idle visual shift.
- [ ] 3.3 Run full typecheck/tests/cycles/build/size/startup and available E2E against baseline.
- [x] 3.4 Record OpenSpec CLI absence; complete manual format, requirement-name, and active-change conflict checks without claiming strict validation passed.
