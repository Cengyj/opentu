## 1. Evidence And Approval

- [x] 1.1 Reconfirm the production new-submission, task persistence, WorkZone recovery, Chat persistence, and fallback-engine call chains
- [x] 1.2 Prove that new submissions do not write the workflow store and that the current SW client has no `claimWorkflow()` method
- [ ] 1.3 Obtain user approval for task-backed recovery and cross-workflow synchronization semantics

## 2. Reproduction Tests (Approval Required)

- [ ] 2.1 Add a refresh test with an old WorkZone and a persisted pending/processing task
- [ ] 2.2 Add a two-workflow event-order test that protects the active WorkflowContext
- [ ] 2.3 Add exact call-count tests for WorkflowContext, Chat storage, and WorkZone projection
- [ ] 2.4 Add terminal status and retry/resume reconciliation tests

## 3. Implementation (Approval Required)

- [ ] 3.1 Classify task-backed versus legacy-engine workflow recovery owners
- [ ] 3.2 Replace the untyped SW claim branch with task-storage-ready reconciliation
- [ ] 3.3 Consolidate overlapping task-to-workflow subscriptions behind one coordinator
- [ ] 3.4 Persist derived workflow and Chat message terminal status together

## 4. Verification

- [ ] 4.1 Run focused workflow, task linking, WorkZone, Chat bubble, and recovery tests
- [ ] 4.2 Run drawnix and full-repository typecheck/lint/test/cycle/build/size/startup checks
- [ ] 4.3 Run available browser refresh, retry, slow-task, multi-workflow, responsive, and visual checks
- [x] 4.4 Record OpenSpec CLI unavailability and complete manual file validation
