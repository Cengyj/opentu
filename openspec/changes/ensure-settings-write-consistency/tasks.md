## 1. Evidence And Approval

- [x] 1.1 Trace TTS UI state through the shared settings wrapper, manager mutation, primary localStorage record, listener notification, and refresh behavior.
- [x] 1.2 Confirm the primary save catches and fulfills after `localStorage.setItem` failure; separate the best-effort IndexedDB mirror boundary.
- [x] 1.3 Identify provider/settings-manager adjacency and exclude language persistence, mirror redesign, schema migration, and unmeasured concurrent-write ordering.
- [ ] 1.4 Obtain user approval for primary commit-before-notify and safe rejected outcomes across shared callers.

## 2. Failing Tests And Implementation (Approval Required)

- [ ] 2.1 Add failing manager tests for serialization and primary `localStorage.setItem` rejection, committed-state preservation, listener behavior, safe error content, and retry.
- [ ] 2.2 Prepare normalized candidates separately and publish/notify only after primary commit succeeds.
- [ ] 2.3 Adapt TTS and each audited interactive caller to handle pending, failure, retry, and committed-value restoration without unhandled rejections.
- [ ] 2.4 Preserve the existing settings key/schema, normalization, encryption policy, backup compatibility, provider routes, and best-effort IndexedDB mirror boundary.

## 3. Verification

- [ ] 3.1 Run settings-manager, TTS, settings-dialog/provider, backup/restore, routing, and SW-configuration focused tests with exact counts and exit codes.
- [ ] 3.2 In a controlled browser, inject primary write failure without real credentials and verify feedback, retry, refresh, and unchanged committed values.
- [ ] 3.3 Verify Chinese/English, keyboard, desktop/tablet/mobile, offline/storage-denied, and no sensitive data in UI/log/analytics.
- [ ] 3.4 Run targeted lint, Drawnix/full typecheck, full tests, cycles, build, size, startup, and available E2E against baseline.
- [x] 3.5 Attempt strict OpenSpec validation; CLI is unavailable (exit 127), so complete manual structure, scenario, and requirement-name conflict checks without claiming strict validation.
