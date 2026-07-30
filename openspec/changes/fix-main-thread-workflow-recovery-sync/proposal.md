# Change: Fix Main-Thread Workflow Recovery And UI Synchronization

## Why

AIInputBar 新工作流当前在页面主线程直接调用 MCP，并把队列任务写入 `aitu-app/tasks`；它们不调用 `workflowSubmissionService.submit()`，也不写入 `aitu-app/workflows`。但刷新后的 WorkZone 仍尝试调用当前 `SWChannelClient` 不存在的 `claimWorkflow()`，随后又用只覆盖旧主线程引擎记录的 workflow store 做 fallback。结果是仍有可恢复任务快照的 WorkZone 可以先被标记为“工作流已丢失”或“恢复工作流失败”。

同一 TaskEvent 目前还会被 AIInputBar、`useTaskWorkflowSync`、ChatDrawer fallback 和 `DrawnixDeferredRuntime` 的重叠订阅消费。旧工作流事件通过 WorkZone fallback 时会把全局单槽 WorkflowContext 替换为旧工作流，能够干扰正在执行的新工作流；Chat 工作流记录的整体状态和消息终态也不总是与步骤终态同步。

这些都是刷新恢复、并发工作流和持久化语义的用户可观察变化，审批前不得实施。

## What Changes

- 以主线程 `tasks` 快照和任务事件作为新 AIInputBar 工作流恢复的事实来源，不再对该路径调用不存在的 SW workflow claim RPC。
- 保留 `workflows` store 仅用于确实由 `MainThreadWorkflowEngine` 持久化的旧/恢复工作流，并明确区分两种 owner。
- 建立单一的任务到 workflow UI 同步协调路径，确保一个任务更新对每个目标 workflow 只提交一次，并且不会用旧 workflow 覆盖无关的当前 WorkflowContext。
- 让 WorkflowMessageData、ChatMessage 状态、WorkZone 步骤和任务终态使用同一派生规则；刷新后从持久化数据得到同一结果。
- 保持任务 schema、Chat 消息 schema、board 序列化、模型路由、并发上限、自动插入和供应商恢复机制不变。

## Impact

- Affected specs: `workflow-runtime-recovery`
- Affected code:
  - `packages/drawnix/src/components/workzone-element/WorkZoneContent.tsx`
  - `packages/drawnix/src/components/startup/DrawnixDeferredRuntime.tsx`
  - `packages/drawnix/src/components/ai-input-bar/AIInputBar.tsx`
  - `packages/drawnix/src/hooks/useTaskWorkflowSync.ts`
  - `packages/drawnix/src/hooks/workflow-message-data.ts`
  - `packages/drawnix/src/components/chat-drawer/ChatDrawer.tsx`
  - workflow/task linking utilities and focused tests
- Related but separate changes:
  - `fix-task-queue-external-cancellation` owns cancellation propagation and late-success rejection.
  - `refactor-sw-duplex-comm` must not reintroduce SW task/workflow execution assumptions into this change.

