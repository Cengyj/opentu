# Change: Persist GitHub-Synced Task History

## Why

GitHub 分页任务同步下载远端页后调用 `taskQueueService.restoreTasks(tasksToRestore)`。该方法只合并内存 Map、发出一个批量刷新触发事件并执行保留策略，不写 IndexedDB。`TaskSyncService` 也未调用 `taskStorageWriter`。

因此同步结果可以报告 `downloaded > 0`，本页内存暂时含远端终态任务，但刷新后 `useTaskStorage` 从 `aitu-app/tasks` 读取不到它们。批量 restore 只携带一个 `event.task`，已启动的 Jotai 任务列表也不能保证立即显示该页全部任务。修复改变 GitHub 同步的本地存储语义，必须先审批。

## What Changes

- GitHub 任务下载先按 ID/`updatedAt` 合并并持久化到 `aitu-app/tasks`，成功后再同步内存/UI。
- 本地较新的同 ID 任务保持不变；远端不存在或较新的终态任务可跨刷新恢复。
- 一次远端页恢复后，任务面板能收到完整批量状态，而不是只依赖一个代表任务事件。
- 不改变 Gist 文件格式、分页版本、加密、任务 ID、媒体下载或 IndexedDB schema。

## Impact

- Affected specs: `github-task-sync`
- Affected code: `github-sync/task-sync-service.ts`, task storage writer/reader, task queue batch synchronization, GitHub sync tests
- User-visible trade-off: 下载的远端任务会占用本地任务存储并在刷新后继续出现在历史/任务视图

