# Change: Fix Workspace Current Deletion Transition

## Why

2026-07-29 对当前生产构建的隔离浏览器复验确认：删除唯一且当前的画板，或选择“删除目录及文件”并删除包含当前画板的目录后，项目抽屉已经显示“暂无画板”，但 App 仍渲染并允许编辑已删除画板的内容。`WorkspaceService`、App 的 `currentBoardId/value`、URL 与 sessionStorage 因而进入不同状态；刷新前的后续编辑没有可持久化目标。

删除当前画板且仍有其他画板时，ProjectDrawer 已尝试切换到第一项；但最后画板和目录级联删除没有定义完整转场。该修复会改变用户可观察的删除后行为，因此必须先审批。

## What Changes

- 为所有可达删除入口统一定义“删除当前画板后的活动画板”转场。
- 删除完成后若仍有画板，切换到确定的第一项并同步画布、URL 与 sessionStorage。
- 删除完成后若没有画板，创建并激活一个默认空画板，避免用户继续编辑无持久化目标。
- 目录级联删除必须识别当前画板是否位于被删除子树中，并执行相同转场。
- 删除失败时不得执行活动画板转场。

## Impact

- Affected specs: `workspace-deletion-consistency`
- Affected code: `packages/drawnix/src/components/project-drawer`, `packages/drawnix/src/services/workspace-service.ts`, `packages/drawnix/src/hooks/useWorkspace.ts`, `apps/web/src/app/app.tsx`
- Preserved data/API semantics: 不修改 IndexedDB store、key、Board/Folder 序列化格式、GitHub 同步协议或公开导入路径
- User-visible trade-off: 删除最后画板后会立即进入新的默认空画板，而不是短暂显示可继续编辑的已删除画布
