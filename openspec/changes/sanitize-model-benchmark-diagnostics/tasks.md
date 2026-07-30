## 1. Evidence And Approval

- [x] 1.1 Trace raw responses and provider errors through execution, sanitization, KV state, UI details, export, and analytics.
- [x] 1.2 Prove unbounded propagation with credential-shaped sentinel response/error values without reading settings or contacting a provider.
- [x] 1.3 Separate benchmark preview needs, historical cleanup, task-history policy, and unrelated provider logging.
- [ ] 1.4 Obtain user approval for bounded allowlist/redaction, generic fallback, and forward-only historical handling.

## 2. Failing Tests And Implementation (Approval Required)

- [ ] 2.1 Add table-driven safe/unsafe response and error tests for storage/UI/export/analytics.
- [ ] 2.2 Define the bounded serializable preview DTO and remove raw provider envelopes from durable state.
- [ ] 2.3 Add non-throwing safe error/diagnostic normalization with bounded allowlist and redaction.
- [ ] 2.4 Ignore historical raw fields on read and omit them on the next ordinary accepted write without background deletion.
- [ ] 2.5 Preserve provider invocation, successful preview, timings/ranking/prompt/manual feedback, and failure classification.

## 3. Verification

- [ ] 3.1 Run focused sanitizer/service/workbench/export/analytics tests with exact counts and exit codes.
- [ ] 3.2 Browser-check local synthetic safe/generic details and errors without credentials or paid requests.
- [ ] 3.3 Assert sentinel secrets, raw objects, URLs/query strings, HTML, and stacks do not reach durable/UI/export/analytics sinks.
- [ ] 3.4 Run Drawnix/full typecheck and lint, full tests/cycles/build/size/startup, and available E2E against baseline.
- [x] 3.5 Run OpenSpec strict validation; while the CLI is unavailable, record exit 127 and complete manual format/name/conflict validation.
