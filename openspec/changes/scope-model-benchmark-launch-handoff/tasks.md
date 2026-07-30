## 1. Evidence And Approval

- [x] 1.1 Trace settings shortcut, launcher atom, tool-window instance creation, every workbench subscriber, discovery wait, prefill, and auto-run guard.
- [x] 1.2 Confirm with an isolated launcher test that the request remains non-null and is returned on repeated reads.
- [x] 1.3 Record real settings click verification as blocked by zero configured model entries without modifying settings or credentials.
- [ ] 1.4 Obtain user approval for identity-checked one-shot handoff semantics.

## 2. Failing Tests And Implementation (Approval Required)

- [ ] 2.1 Add stale replay, sequential-shortcut, remount, delayed/failed discovery, generic open, and launch-failure red tests.
- [ ] 2.2 Add a typed request identity and identity-checked acknowledgement action.
- [ ] 2.3 Clear only the request actually applied or terminally resolved by the workbench.
- [ ] 2.4 Acknowledge only after applied prefill or terminal unavailable feedback; preserve no-auto-run and compare fallback.
- [ ] 2.5 Keep analytics privacy and all unrelated internal tools/window behavior unchanged.

## 3. Verification

- [ ] 3.1 Run focused launcher/tool-window/workbench/settings tests with exact counts and exit codes.
- [ ] 3.2 Browser-check sequential shortcuts and repeated close/reopen using synthetic model metadata only.
- [ ] 3.3 Run Drawnix/full typecheck and lint, full tests/cycles/build/size/startup, and available E2E against baseline.
- [x] 3.4 Run OpenSpec strict validation; while the CLI is unavailable, record exit 127 and complete manual format/name/conflict validation.
