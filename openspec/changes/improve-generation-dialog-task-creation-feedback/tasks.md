## 1. Evidence and Approval

- [x] 1.1 Trace image and video task creation from dialog submission through validation and the shared hook boundary.
- [x] 1.2 Add a diagnostic hook test proving that the current boundary discards a concrete validation reason.
- [x] 1.3 Confirm that the change does not overlap provider routing, concurrency, cancellation, caching, persistence, or recovery semantics.
- [x] 1.4 Trace batch-image full-null and partial-null task creation through the same hook and confirm successful tasks remain independent.
- [x] 1.5 Trace Music Analyzer multi-submit partial creation and confirm the accepted tasks outlive the thrown iteration while their record association is skipped.
- [ ] 1.6 Obtain user approval for the user-visible task-creation feedback change.

## 2. Implementation (approval required)

- [ ] 2.1 Add a typed task-creation result or error channel that preserves the rejection reason without changing the task service contract.
- [ ] 2.2 Render safe, localized invalid-parameter feedback in the image generation dialog while preserving form state.
- [ ] 2.3 Render safe, localized invalid-parameter feedback in the video generation dialog while preserving form state.
- [ ] 2.4 Render full/partial rejection counts and safe localized feedback in batch-image submission while preserving accepted tasks and table state.
- [ ] 2.5 Persist accepted Music Analyzer AUDIO task IDs and render full/partial rejection counts without cancelling accepted tasks.
- [ ] 2.6 Retain generic feedback for unknown errors and avoid exposing stack traces, credentials, request payloads, or provider responses.

## 3. Verification

- [ ] 3.1 Replace the diagnostic expectation with hook contract tests for success and rejected creation.
- [ ] 3.2 Add dialog/tool-level tests for actionable invalid-parameter feedback, the generic fallback, batch-image full/partial rejection, and Music Analyzer partial acceptance/late completion.
- [ ] 3.3 Run the focused Drawnix generation-dialog test set and record command, exit code, and statistics.
- [ ] 3.4 Run Drawnix typecheck and focused lint, then compare full-repository checks with the recorded baseline.
- [ ] 3.5 Recheck image/video/batch success, partial acceptance, zero acceptance, correction, retry, refresh, cancellation, and recovery paths.
- [x] 3.6 Run OpenSpec strict validation; while the CLI is unavailable, record the tool blocker and complete a manual format/conflict audit.
