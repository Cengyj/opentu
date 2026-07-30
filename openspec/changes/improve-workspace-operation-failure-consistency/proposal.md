# Change: Improve Workspace Operation Failure Consistency

## Why

当前 WorkspaceService 的若干创建、重命名和删除路径先修改内存 Map，再等待 IndexedDB；当存储 Promise 拒绝时，内存与持久化记录会分叉。`useWorkspace` 又把 create/delete/copy 错误转换为 `null` 或 `false`，ProjectDrawer 没有渲染 hook error，也没有在这些返回值失败时显示 toast，因此用户会看到操作没有结果但不知道能否重试，刷新后还可能看到记录“重新出现”。

该结论由当前调用顺序和错误传播路径静态证明；真实浏览器无法安全强制 IndexedDB 单次写入失败。修复会改变失败时的用户反馈与状态保持行为，需要审批后实施。

## What Changes

- 单记录创建、重命名和删除在持久化成功前不提交内存索引与成功事件，或在失败时完整回滚。
- 远程删除副作用只在本地删除成功后触发。
- create/delete/copy 的失败必须在项目抽屉显示明确、可重试的错误，不再静默关闭或无反馈返回。
- 批量/递归操作按已成功与未成功记录报告部分结果，不把部分成功宣告为完整成功。
- 保持当前成功路径、数据格式、操作入口和名称校验语义不变。

## Impact

- Affected specs: `workspace-operation-failure-consistency`
- Affected code: `packages/drawnix/src/services/workspace-service.ts`, `packages/drawnix/src/hooks/useWorkspace.ts`, `packages/drawnix/src/components/project-drawer/ProjectDrawer.tsx`
- Preserved data/API semantics: 不修改 IndexedDB schema、Board/Folder 格式、同步 payload 或成功路径 UI
- User-visible trade-off: 存储失败时对话框可保持打开并显示错误；批量操作可报告部分成功数量
