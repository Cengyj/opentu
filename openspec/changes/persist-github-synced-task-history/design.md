## Context

- `sync-engine.ts` 的创建、拉取、推送和手动同步路径多次调用 `taskSyncService.syncTasks()`。
- `task-sync-service.ts:451-489` 下载远端任务页，`:486-490` 只调用 `taskQueueService.restoreTasks()`。
- `task-queue-service.ts:2349-2423` 的 restore 只修改内存 Map；其单个代表事件不足以表达一页多任务。
- 启动恢复 `useTaskStorage.ts:71-78` 只从 IndexedDB 读取，因此未持久化任务在刷新后消失。
- 备份导入不受该根因影响：它在 restoreTasks 前已经调用 `taskStorageWriter.importTasks()`，关闭结果时还会刷新页面。

## Goals / Non-Goals

- Goals:
  - GitHub 报告成功下载的任务记录落入 IndexedDB，并在刷新后可读取。
  - 本地较新记录不被远端页中较旧副本覆盖。
  - 内存和任务 UI 在同步完成后反映全部实际合并记录。
- Non-Goals:
  - 不下载或缓存远端媒体二进制。
  - 不改变 Gist task index/page schema、加密或分页大小。
  - 不让 processing 任务跨设备恢复执行；当前同步集合仍为终态图片/视频任务。

## Decisions

- Decision: 在任务存储层提供按 `id + updatedAt` 的批量原子合并，再把成功合并集合交给内存。
  - Alternative: 对远端页直接 `importTasks(..., {replaceExisting:true})`。
  - Rejected because: 一个下载页可包含本地更新的同 ID 记录，盲目覆盖会回退本地状态。
- Decision: 为批量恢复提供完整状态刷新协议。
  - Alternative: 对每个任务发送一个 `taskCreated`。
  - Rejected because: 大页会产生不必要的逐项 React 更新；现有 UI 可在一次批量信号后从服务读取快照。

## Invariants

- 同 ID 比较中 `updatedAt` 较大的记录获胜；相等时保留本地。
- 只有 IndexedDB 合并成功的记录进入内存并计入 `downloaded`。
- 远端同步任务保持终态，不被启动恢复当作待执行任务。
- Gist 数据格式、密码和媒体 URL 保持不变。

## Risks / Trade-offs

- 每个下载页新增一个本地 readwrite transaction。
- IndexedDB 配额失败时同步结果必须报告部分失败，不能宣告全部下载成功。
- 全量 UI 快照需要保持当前按创建时间排序和 100 条活跃保留策略。

## Migration Plan

1. 补远端新增、本地更新、远端更新、相等时间、写入失败和刷新读取红测试。
2. 实现存储层 merge-if-newer 批量写并返回实际合并 ID。
3. 只恢复成功写入的任务并发出一次完整批量刷新。

## Acceptance Thresholds

- 远端新增和远端较新样本同步后，关闭/重新打开 reader 仍 2/2 可读且字段相同。
- 本地较新和相等样本 2/2 不被覆盖。
- 50 条一页恢复只触发一次批量 UI 刷新，最终 UI 快照包含全部实际合并任务。
- 注入单条/transaction 失败时不计入成功下载，内存与 IndexedDB 不分叉。
- GitHub sync 窄测、typecheck、cycles、build 和全仓基线无新增失败。

## Rollback

- 独立回退 merge-if-newer 写入、批量刷新协议和测试。
- 不清理已经成功同步的终态任务；它们仍是兼容的现有 Task 记录。

