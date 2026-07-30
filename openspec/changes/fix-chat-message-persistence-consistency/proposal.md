# Change: Fix Chat Message Persistence Consistency

## Why

普通 Agent Chat 的用户消息已经由 `chatStorageService.addMessage()` 增加一次 `messageCount`，`useChatHandler` 随后又手工增加一次；终态助手消息写入后又使用旧 session 快照写入 `+2`。从计数 `N` 开始发送一轮两条真实消息，持久化结果稳定为 `N+3`。Chat workflow 路径依次持久化两条消息后再手工 `+2`，两条真实消息稳定记为四条。

普通成功、流错误和 catch 错误路径还会以 fire-and-forget 方式写终态助手消息并在写入完成前解除发送锁。Agent 工具调用回调可以先对尚不存在的助手消息执行 `updateMessage()`，随后基础消息写入又可能覆盖 workflow 字段。刷新、备份或后续消息因此没有一个可证明的终态持久化边界。

该工具顺序已用当前 `chat-storage-service` 与真实 localForage API 在 fake-indexeddb 6.2.5 下确定性复现：先启动 `updateMessage(messageId, { workflow })`，随后对同一 ID 启动 `addMessage(base)`，两个 Promise 都 fulfilled；最终 `getMessages(sessionId)` 返回的记录逐字段等于 base message，`workflow` 为 `undefined`。Node 24.14.0、Vitest 3.2.4、jsdom 诊断退出 0，1/1 文件、1/1 用例、13 ms（1.21 s 总时长）。临时缺陷断言随后删除。结合生产 `useChatHandler.ts:248-275` 在基础 `addMessage` 前同步调用 `handleToolCalls`，以及 `ChatDrawer.tsx:358-359` 立即启动未 await 的 `updateMessage`，这不再只是允许时序假设。

修复会改变持久化计数、终态完成时机、存储失败反馈和旧错误计数的纠正语义，审批前不得实施。

## What Changes

- 由 Chat 存储服务唯一维护 `messageCount`；普通 Chat 和 workflow Chat 调用者不再手工累加。
- 将同一消息 ID 的再次写入定义为替换而不是新增，避免重复 ID 导致计数继续漂移。
- 在加载一个会话时按已加载消息数惰性纠正该会话的旧计数，并保持原 `updatedAt`；不做全库启动扫描。
- 为普通成功、流错误和异常终态建立可等待的持久化完成边界；写入失败不得被报告为已持久化成功。
- 先持久化 Agent 助手基础记录，再写 workflow 数据和终态，避免对不存在记录的更新以及后写基础记录覆盖 workflow。
- 将已提交的 session `updatedAt` 和计数同步回 ChatDrawer 会话列表，使时间与排序不必等到刷新后才更新。
- 保持 Chat session/message schema、localForage 数据库与 store 名称、消息 ID、附件、模型路由、MCP/task 执行、备份格式和分析事件 schema 不变。

## Impact

- Affected specs: `chat-message-persistence`
- Affected code:
  - `packages/drawnix/src/services/chat-storage-service.ts`
  - `packages/drawnix/src/hooks/useChatHandler.ts`
  - `packages/drawnix/src/components/chat-drawer/ChatDrawer.tsx`
  - focused Chat storage/handler/tool-call tests
- Related but separate changes:
  - `fix-chat-inflight-session-isolation` owns busy submission and session-switch ownership.
  - `fix-main-thread-workflow-recovery-sync` owns task-backed workflow recovery and task-to-Chat terminal projection.
  - `ensure-prompt-storage-write-consistency` owns prompt history writes, not Chat message stores.

## Evidence

- `chat-storage-service.ts:101-113` writes the message and increments the owning session once.
- `useChatHandler.ts:139-152` awaits the user insert and then manually adds one again.
- `useChatHandler.ts:259-284` starts the assistant insert without awaiting it and writes `messageCount` from the earlier session snapshot.
- `useChatHandler.ts:303-354` repeats the fire-and-forget terminal write for both stream and thrown errors.
- `ChatDrawer.tsx:1087-1138` awaits two workflow message inserts and then manually adds two more.
- `ChatDrawer.tsx:140-142,450-455,768-850` owns the visible session list but normal `useChatHandler` sends have no callback that updates that in-memory metadata after storage changes.
- `ChatDrawer.tsx:306-404` starts `updateMessage()` before the base assistant record is guaranteed to exist, while `useChatHandler.ts:248-275` invokes that callback before starting the base record write.
- Controlled current-service result: update-before-base fulfilled twice but persisted one base record with `workflow=undefined`; 1/1 diagnostic passed in 13 ms and the temporary file was removed. Full raw conditions are recorded in `docs/evidence/f12-chat-drawer-ui/persistence-diagnostics.md`.
- `SessionItem.tsx:72-114` displays title/time only, so the count drift is durable metadata and backup-fidelity debt rather than a currently visible badge error.
- Current focused baseline: Vitest 3.2.4, Node 24.14.0, jsdom; 7/7 Chat-adjacent files and 25/25 tests passed in 11.46 s, but no current test imports `chat-storage-service`, `useChatHandler`, or `chat-service`.
