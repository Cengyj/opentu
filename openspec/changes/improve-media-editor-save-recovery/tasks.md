## 1. Async save contract

- [ ] 1.1 Make editor overwrite and insert callbacks awaitable across component boundaries.
- [ ] 1.2 Propagate Drawnix persistence failures after preserving the existing user error message.
- [ ] 1.3 Track a single in-flight save and prevent duplicate persistence submissions.

## 2. Recovery behavior

- [ ] 2.1 Keep pending edited output and edit controls available after a rejected save.
- [ ] 2.2 Clear edit state and return to preview only after persistence succeeds.
- [ ] 2.3 Define and test close/cancel behavior during an in-flight save.

## 3. Verification

- [ ] 3.1 Add red/green tests for overwrite success, insert success, cache failure, board failure, and duplicate activation.
- [ ] 3.2 Verify failure, retry, cancel, and refresh behavior in the canvas media flow.
- [ ] 3.3 Run targeted lint, Drawnix typecheck, media editor tests, and related Playwright flows.
