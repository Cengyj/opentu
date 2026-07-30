## Context

- `backup-restore-dialog.tsx:270-283` 在导入前保存当前画板，再调用导入服务。
- `backup-import-service.ts:163-202` 写入项目并调用 `workspaceService.reload()`。
- `workspace-service.ts:1291-1315` reload 清空 `loadedBoards`，并把元数据组装成 `elements: []` 的兼容 Board。
- `workspace-service.ts:1010-1022` 因完整缓存已清空，`getCurrentBoard()` 返回该元数据投影。
- `backup-restore-dialog.tsx:91-137` 随后只检查投影的 `elements`，误走“空白画布自动切换”分支；原有非空确认分支不可达。
- `WorkspaceService.isBoardEmptyAsync()` 已能在画板未加载时从 IndexedDB 读取完整 Board，可作为最小修复边界。

## Goals / Non-Goals

- Goals:
  - merge/replace 导入后的空画板判断基于完整持久化内容。
  - 当前画板为空时继续自动切换；非空时继续使用现有确认框。
  - 用户取消确认、目标画板缺失或完整内容读取失败时不静默切换。
- Non-Goals:
  - 不新增备份域、导入预览、撤销恢复或冲突解决产品能力。
  - 不改变项目 merge/replace、任务恢复、环境恢复或 secrets 解密顺序。
  - 不重构 WorkspaceService 的三份内存索引。

## Decisions

- Decision: 在恢复转场时通过现有异步空画板检查读取完整内容。
  - Alternatives considered: 在导入前把 `elements.length` 缓存在对话框 state。
  - Why not chosen: 导入前快照会与 `onBeforeImport` 的最终保存结果形成第二份状态；持久化读取直接验证当前成功保存的数据。
- Decision: 完整内容读取失败时停止自动切换并显示可重试错误。
  - Alternatives considered: 读取失败时继续把画板视为空。
  - Why not chosen: 这会保留当前误切换路径，并把存储故障当成用户空画板。

## Invariants

- 导入前保存仍在导入读取之前完成。
- 备份记录的目标画板必须存在，才允许切换。
- 用户取消确认后，App 当前画板、URL 和 sessionStorage 保持不变。
- 自动切换只适用于经完整内容检查确认为空的当前画板。
- 不改写备份文件、存储版本或用户画板元素。

## Risks / Trade-offs

- 关闭导入结果时增加一次当前画板 IndexedDB 读取。
  - Mitigation: 只在存在待恢复 workspace state 且目标画板存在时读取；复用按 ID 读取，不扫描所有画板。
- 读取失败会让用户暂时留在当前画板。
  - Mitigation: 显示错误并允许用户再次关闭/重试，不宣告已完成切换。

## Migration Plan

1. 先补组件测试，构造 reload 后 `getCurrentBoard()` 为元数据投影但 IndexedDB 完整画板非空。
2. 将空画板判断改为完整内容检查，并覆盖空、非空、取消、缺失目标和读取失败分支。
3. 复验 merge/replace 导入、关闭后刷新和 backed current board 恢复。

## Acceptance Thresholds

- 组件测试中，元数据投影为 `elements: []`、完整画板非空时，确认框 1/1 出现且取消后切换调用为 0。
- 完整画板为空时保持自动切换，确认框调用为 0。
- 目标缺失或读取失败时切换调用为 0，并提供错误反馈。
- 定向测试、drawnix/typecheck、全仓 typecheck、cycles 与 production build 不新增失败。
- 同一生产构建中的 merge 与 replace 路径各复验 5 次；当前画板非空时 5/5 不在未确认的情况下切换。

## Rollback

- 独立回退恢复转场的完整内容检查和对应测试。
- 不清理或迁移 IndexedDB，不回退备份版本，不删除已经导入的数据。
- 若空画板自动切换、取消保持或导入完成刷新任一不变量失败，整体回滚该 change。
