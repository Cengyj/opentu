## Context

- `TaskQueuePanel.tsx:401-452,1200-1240` 允许批量选择并取消活跃任务。
- `useTaskQueue.ts:99-103,319-323` 将操作转给 `taskQueueService.cancelTask()`。
- `task-queue-service.ts:609-619,2161-2177` 的 abort map 只在私有 `executeTask()` 中填充。
- `workflow-engine/engine.ts:344-415` 把工作流 controller 的 signal 传给 `media-generation`。
- `media-generation/image-generation-service.ts:113-190` 和 video 对应路径先 `trackExternalTask()`，再把工作流 signal 传给 executor/轮询；没有把取消句柄登记给任务队列。
- `useTaskExecutor.ts:353-451` 的角色专用 owner 也没有 task-service abort controller；取消后仍可先写 Character 记录，再让 blocked guard 丢弃 Task 完成事件。
- fallback executor 直接写 IndexedDB；外部任务取消后的迟到完成不受 `blockedTaskIds` 保护。
- AUDIO owner 在 `request.params` 中携带 signal，但 Suno adapter/API 不消费；音频与封面缓存又位于最后一次 cancelled guard 和 `completed` 写回之间。
- Music Analyzer 的三个专用 CHAT owner 直接调用分析/Gemini/finalize helper，不接收统一 execution signal。

## Goals / Non-Goals

- Goals:
  - 普通、角色专用、工作流外部和恢复任务的取消操作都能到达实际本地执行/轮询所有者。
  - Suno submit/fetch/backoff sleep 和 Music Analyzer 专用 CHAT owner 能及时观察取消。
  - `cancelled` 一旦由用户确认，不被迟到 progress/completed/failed 写回覆盖。
  - UI、内存、IndexedDB、工作流步骤和自动插入对同一取消结果一致。
- Non-Goals:
  - 不为不支持取消的供应商新增远端 API。
  - 不把删除历史任务等同于取消整个工作流。
  - 不改变失败重试、并发上限或任务 schema。

## Decisions

- Decision: 外部执行入口在任务创建时登记一个可释放的取消句柄，并在 `finally` 注销。
  - Alternative: 任务面板根据 `workflowId` 直接查找并取消整个工作流。
  - Rejected because: 一个工作流可并行包含多个任务，取消单个任务不应未经规格扩大到所有步骤。
- Decision: 终态写入前同时检查统一取消标记，取消记录最后持久化。
  - Alternative: 只 abort signal。
  - Rejected because: 请求可能已经返回或适配器可能不能及时响应 abort，仍存在迟到写回窗口。
- Decision: AUDIO adapter/API 明确接收 AbortSignal；transport、每次 sleep 与每次 poll 边界都检查 signal，缓存写回前后复用统一终态 guard。
  - Alternative: 只让 progress callback 在取消后 no-op。
  - Rejected because: 这仍会继续网络轮询、缓存下载和费用/资源占用，也不能关闭最后的 completed 覆写窗口。
- Decision: Music Analyzer 专用 CHAT helper 接收 execution options，并在网络返回、record/finalize 写入前检查取消。
  - Alternative: 只在页面订阅者忽略取消结果。
  - Rejected because: task service 与持久化仍可写成功，刷新后会恢复错误终态。

## Invariants

- 对同一任务多次取消是幂等的。
- 用户取消后不自动插入结果、不保存为新的成功素材、不把工作流步骤标记完成。
- 已由供应商完成但尚未写回的结果不得覆盖本地取消终态。
- 正常完成、失败和重试路径不受未取消任务的 guard 影响。

## Risks / Trade-offs

- 单任务取消与工作流整体状态之间需要明确失败/取消映射。
- 部分供应商请求不可远端撤回，仍可能消耗额度；UI 必须准确表述为本地停止跟踪。
- 取消句柄若未在所有终态清理会造成内存泄漏。

## Migration Plan

1. 补外部图片/视频任务的可控 signal 和迟到 IndexedDB 完成红测试。
2. 建立登记/注销取消句柄与统一终态写 guard。
3. 让 media-generation 和工作流步骤消费明确的取消结果。

## Acceptance Thresholds

- 普通任务、角色任务、外部图片、外部视频、恢复轮询、Suno AUDIO、Music Analyzer 分析、改写和文本歌词各 1 个受控测试中，取消后 9/9 signal 为 aborted 或执行器明确停止轮询/丢弃结果。
- 迟到完成或缓存回调后，内存与 IndexedDB 9/9 保持 `cancelled`，领域记录、自动插入和工作流完成事件调用数为 0。
- 重复取消 2 次只产生一个终态与一次分析事件；取消句柄最终数量为 0。
- 相关窄测和全仓验证不新增失败。

## Rollback

- 独立回退外部取消句柄、终态 guard 与测试。
- 不删除远端作业或本地历史，不迁移 IndexedDB。
