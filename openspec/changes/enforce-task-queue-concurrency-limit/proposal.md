# Change: Enforce Task Queue Concurrency Limit

## Why

当前普通任务由 `TaskQueueService.createTask()` 立即标记为 `processing` 并直接调用私有 `executeTask()`。仓库声明的 `AI_GENERATION_CONCURRENCY_LIMIT = 20` 只被 `useTaskExecutor` 的 `pending`/恢复队列使用，因而不约束正常图片、视频、音频和 Chat 任务。

2026-07-29 的受控 Vitest 诊断同时创建 21 个普通图片任务，并用未完成 Promise 固定执行窗口；21 个 `executor.generateImage()` 全部同时进入，峰值为 21，超过声明上限 20。诊断测试退出 0（1/1），随后已移除。修复会改变任务排队与首个进度时机，必须先审批。

## What Changes

- 让所有由任务队列创建的 AI/模型执行共享同一个并发许可边界，而不是只限制恢复任务。
- 超出上限的任务保持可观察的排队状态，释放许可后按确定顺序开始。
- 取消或删除排队任务时不再启动供应商请求。
- 不改变单任务参数、供应商路由、任务结果、IndexedDB schema 或保留上限。

## Impact

- Affected specs: `task-execution-concurrency`
- Affected code: `packages/drawnix/src/services/task-queue-service.ts`, `packages/drawnix/src/hooks/useTaskExecutor.ts`, task queue lifecycle tests
- User-visible trade-off: 第 21 个及之后的并发任务会等待许可，不再立即发起模型请求

