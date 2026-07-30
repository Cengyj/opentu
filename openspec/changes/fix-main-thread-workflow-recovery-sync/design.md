## Context

### Current new-submission path

`AIInputBar` creates one `WorkflowDefinition`, hands it to WorkflowContext/ChatDrawer through `useWorkflowSubmission`, receives `usedSW: false`, and then executes initial and dynamically added steps through `mcpRegistry.executeTool()`. Queue-mode MCP tools persist `workflowId`, `batchId`, and `batchIndex` on task records.

### Current recovery mismatch

- Only `MainThreadWorkflowEngine` writes the `workflows` store.
- New AIInputBar submissions do not call `workflowSubmissionService.submit()`.
- WorkZone recovery calls `(swChannelClient as any).claimWorkflow()`, while the current client exposes cache/version/debug RPC but no workflow claim method.
- The fallback engine cannot resume a new AIInputBar workflow that has no workflow-store record, even when task-store records are present and resumable.
- Four consumers overlap on task/workflow updates, and one fallback restores a historical WorkZone into the single current WorkflowContext.

## Goals / Non-Goals

### Goals

- Refreshing a task-backed workflow SHALL reconcile from persisted task snapshots after task storage is ready.
- An event for workflow A SHALL update A's WorkZone/Chat record without replacing active workflow B in WorkflowContext.
- Each task event SHALL have one authoritative workflow synchronization route per target.
- Step-derived workflow status, Chat message status, and WorkZone status SHALL converge before persistence.
- Persisted legacy engine workflows SHALL retain their existing fallback resume path.

### Non-Goals

- Moving new workflow execution into `MainThreadWorkflowEngine`.
- Reintroducing task or workflow execution in Service Worker.
- Changing task concurrency, task schema, storage keys, provider routing, or automatic insertion.
- Defining task cancellation semantics; that remains in `fix-task-queue-external-cancellation`.
- Adding new workflow history or management UI.

## Decisions

### 1. Classify workflow owner before recovery

A workflow with task-linked steps is reconciled from `TaskQueueService` only after task storage initialization. A workflow found in the workflow store may be resumed by `MainThreadWorkflowEngine`. SW availability is not evidence that either workflow exists, so WorkZone does not call an untyped SW workflow RPC.

Alternative: add `claimWorkflow()` to the SW channel. Rejected because current workflow and task execution is main-thread-owned, and adding an RPC would revive an obsolete architectural boundary.

### 2. Use one coordinator for task-to-workflow projection

The coordinator resolves targets by taskId first and by persisted `workflowId` plus batch slot second. It updates the active WorkflowContext only when IDs match; otherwise it updates the matching WorkZone and Chat record directly. Existing task linking helpers remain the matching contract.

Alternative: restore every matched WorkZone into WorkflowContext. Rejected because WorkflowContext is a single active slot and historical events must not replace an unrelated in-flight workflow.

### 3. Derive terminal status from steps at the persistence boundary

WorkflowMessageData status is derived with the same rule used by the visible bubble. ChatMessage status is updated in the same storage write as workflow data. Task-backed running steps remain running/pending until the corresponding task snapshot is reconciled.

Alternative: trust the optional `workflow.status` supplied by converter objects. Rejected because direct converter output does not currently maintain that field as steps advance.

## Invariants

- Task, Chat, WorkZone, and WorkflowContext retain existing public/storage shapes.
- A task must never update a workflow with a different workflow ID unless it has an exact taskId match.
- Refresh does not submit a new provider request for a task already represented by a persisted task record.
- A completed task cannot be downgraded by an older pending/processing event.
- Legacy engine recovery never runs for a task-backed direct workflow without a workflow-store record.
- Automatic canvas insertion remains owned by existing task completion/post-processing services.

## Risks / Trade-offs

- Deduplicating subscribers can expose hidden ordering dependencies; focused event-order tests are required before removal.
- Task records created before workflow metadata was added may only be matchable by exact taskId; unmatched records stay unknown instead of being assigned heuristically.
- Chat and board writes are separate storage transactions, so crash-atomicity across both stores is not promised; reconciliation must be idempotent.

## Acceptance Thresholds

- In 5 controlled refresh runs with a persisted pending/processing task, the WorkZone is never marked lost before task reconciliation and converges to the task snapshot in 5/5 runs.
- In a controlled two-workflow event-order test, 10/10 events for workflow A leave active workflow B unchanged while A's Chat/WorkZone record converges.
- One synthetic TaskEvent causes exactly one logical update per matching WorkflowContext, Chat record, and WorkZone target; duplicate persisted Chat writes for the same projection are 0.
- Completed, failed, cancelled/skipped, retry, and resumed task snapshots each produce the specified step and message terminal state in focused tests.
- Related tests, typecheck, cycles, build, size, startup verification, and available E2E do not add failures relative to baseline.

## Rollback

Revert the coordinator, recovery owner classification, status derivation, and focused tests together. No data migration or deletion is involved; existing task, Chat, workflow, and board records retain their schemas and can still be read by the prior implementation.

