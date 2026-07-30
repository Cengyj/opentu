# Change: Fix Backup Restore Current Board Transition

## Why

2026-07-29 的当前源码调用链证明：项目导入完成后，`backupImportService` 会调用 `workspaceService.reload()`；该 reload 会清空完整画板缓存并用 `elements: []` 的元数据投影重建兼容 `boards` Map。随后备份恢复对话框用 `workspaceService.getCurrentBoard().elements.length` 判断导入前的当前画板是否为空，因此任何仍存在的当前画板都会被误判为空。

当备份记录的当前画板与用户当前画板不同时，现实现状会绕过组件已存在的确认分支并自动切换。该修复恢复对话框注释和分支已经声明的“非空当前画板先确认”行为，但仍会改变用户可观察的恢复转场，因此必须先审批。

## What Changes

- 项目导入和 workspace reload 后，使用持久化的完整画板内容判断当前画板是否为空，不再依据元数据投影的空 `elements`。
- 当前画板确实为空时，保持现有自动切换行为。
- 当前画板非空时，保持现有确认对话框；用户取消后不切换。
- 目标画板不存在时保持当前画板，不显示虚假的切换成功提示。
- 不改变备份 v4、ZIP 结构、merge/replace 语义、项目合并规则或工作区存储 schema。

## Impact

- Affected specs: `backup-restore`
- Affected code: `packages/drawnix/src/components/backup-restore/backup-restore-dialog.tsx`, `packages/drawnix/src/services/workspace-service.ts`（仅复用现有完整内容读取能力）
- Preserved data/API semantics: 不修改 IndexedDB store/key、Board 序列化、备份 manifest、加密 secrets、GitHub 同步协议或公开 facade
- User-visible trade-off: 导入完成后，非空当前画板不再被自动切走；用户需要在现有确认框中明确同意
