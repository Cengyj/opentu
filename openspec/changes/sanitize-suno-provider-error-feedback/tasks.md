## 1. Evidence And Approval

- [x] 1.1 Trace provider body through submit/fetch Error, task persistence, Music Analyzer UI, and LLM logging.
- [x] 1.2 Confirm arbitrary body propagation without asserting unobserved credential content.
- [x] 1.3 Separate pre-creation feedback, cancellation, and historical log cleanup from this scope.
- [ ] 1.4 Obtain user approval for bounded allowlist/redaction and generic fallback semantics.

## 2. Failing Tests And Implementation (Approval Required)

- [ ] 2.1 Add table-driven unsafe/safe body tests for submit, fetch, logger, task state, and UI consumers.
- [ ] 2.2 Add the non-throwing Suno error normalizer with bounded allowlist and redaction.
- [ ] 2.3 Replace raw body concatenation/`apiErrorBody` persistence with safe category/status/message.
- [ ] 2.4 Pass only a privacy-safe diagnostic summary to existing failure logging.
- [ ] 2.5 Keep request, routing, status, retry, cancellation, and successful response behavior unchanged.

## 3. Verification

- [ ] 3.1 Run focused audio API/task queue/Music Analyzer error tests with exact counts and exit codes.
- [ ] 3.2 Browser-check mocked recognized/generic errors and accessibility announcements without provider credentials or paid requests.
- [ ] 3.3 Run a source/test assertion that raw sentinel secrets, URLs, HTML, and bodies do not reach task/UI/logger sinks.
- [ ] 3.4 Run Drawnix/full typecheck and lint, full test/cycles/build/size/startup, and available E2E against baseline.
- [x] 3.5 Run OpenSpec strict validation; while unavailable, record exit 127 and complete manual format/name/conflict validation.
