## 1. Evidence And Approval

- [x] 1.1 Trace the composer, wrapper, hook lock, provider stream, session selection, message loads, and workflow-message loads
- [x] 1.2 Prove the busy second-send loss and the absence of stop/regenerate UI callers by production call search
- [x] 1.3 Prove that ordinary and workflow session loads have no stale-completion guard
- [ ] 1.4 Obtain user approval for busy-submission and session-isolation behavior

## 2. Reproduction Tests (Approval Required)

- [ ] 2.1 Add a composer/handler test with a deferred first send and a rejected second send
- [ ] 2.2 Add out-of-order A→B ordinary-message and workflow-message load tests
- [ ] 2.3 Add switch-during-stream success, error, tool-call, deletion, and unmount tests

## 3. Implementation (Approval Required)

- [ ] 3.1 Add explicit accepted/busy send results and a submit-only busy state
- [ ] 3.2 Preserve draft text and attachments on busy rejection and emit safe feedback
- [ ] 3.3 Guard ordinary and workflow session load commits by active request identity
- [ ] 3.4 Bind stream/UI/raw-history mutations to the accepting session while retaining origin persistence
- [ ] 3.5 Keep in-memory session metadata synchronized without replacing the selected session

## 4. Verification

- [ ] 4.1 Run Chat input, handler, storage, service, session, workflow bubble, and session-target focused tests
- [ ] 4.2 Run focused lint, Drawnix/full typecheck, full tests, cycles, build, size, and startup verification against baseline
- [ ] 4.3 Run five A→B samples at 0/100/1,000 messages and record raw latency, median, range, and discarded completions
- [ ] 4.4 Run available streaming, error, attachment, keyboard, responsive, refresh, and visual Chat checks
- [x] 4.5 Record OpenSpec CLI unavailability and complete manual file/format/conflict validation

