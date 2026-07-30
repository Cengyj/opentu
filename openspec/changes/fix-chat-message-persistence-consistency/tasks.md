## 1. Evidence And Approval

- [x] 1.1 Trace all production Chat message/session storage callers and every `messageCount` writer
- [x] 1.2 Prove the normal two-message `N+3` and workflow two-message `N+4` outcomes from awaited call order
- [x] 1.3 Trace normal success/error ordering and reproduce Agent update-before-base loss with the current Chat storage service and controlled IndexedDB
- [ ] 1.4 Obtain user approval for count ownership, lazy correction, and durable terminal semantics

## 2. Reproduction Tests (Approval Required)

- [ ] 2.1 Add storage tests for insert, same-ID replacement, delete, and loaded-session legacy count correction
- [ ] 2.2 Add handler tests for normal success, stream error, thrown error, and injected terminal storage rejection
- [ ] 2.3 Add a delayed-write test proving the send boundary waits for terminal durability
- [ ] 2.4 Add an Agent tool-call ordering test proving the base record precedes workflow patches

## 3. Implementation (Approval Required)

- [ ] 3.1 Make Chat storage the only `messageCount` owner and remove caller arithmetic
- [ ] 3.2 Reconcile a loaded session's count without changing `updatedAt`
- [ ] 3.3 Await terminal assistant persistence and surface safe storage failures
- [ ] 3.4 Sequence Agent assistant base persistence before workflow updates
- [ ] 3.5 Synchronize in-memory session metadata from the committed storage result

## 4. Verification

- [ ] 4.1 Run Chat storage, handler, service, input, bubble, workflow-media, session-target, and backup focused tests
- [ ] 4.2 Run focused lint, Drawnix/full typecheck, full tests, cycles, build, size, and startup verification against baseline
- [ ] 4.3 Measure five immediate/delayed persistence samples and record raw values, median, range, and UI trade-off
- [ ] 4.4 Run available refresh, error, attachment, workflow, responsive, keyboard, and visual Chat checks
- [x] 4.5 Record OpenSpec CLI unavailability and complete manual file/format/conflict validation
