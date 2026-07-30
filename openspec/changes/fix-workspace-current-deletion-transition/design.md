## Context

- 生产构建、1280×720、隔离 origin、SW 关闭的复现中，删除最后当前画板后，抽屉显示“暂无画板”，但原 100×100 矩形仍保留在可编辑画布。
- 同一环境中，删除包含当前画板的目录及内容得到相同行为。
- `WorkspaceService.deleteBoard` 只把 service 的 `currentBoardId` 置空；`ProjectDrawer` 仅在树中还能找到画板时调用 `onBoardSwitch`。
- `deleteFolderWithContents` 删除当前画板记录时没有清理 `currentBoardId`，ProjectDrawer 也没有目录级联后的切换逻辑。
- App 画布数据由 `onBoardSwitch` 更新；没有“当前画板已删除”的反向通知。刷新启动在无画板时又会创建默认画板，说明运行时存在“可编辑画布需要持久化目标”的不变量。

## Goals / Non-Goals

- Goals:
  - 所有删除入口结束后，service、App、URL、sessionStorage 与画布指向同一个存在的画板。
  - 删除当前画板且没有剩余画板时，创建并激活默认空画板。
  - 目录级联和批量删除遵循与单画板删除相同的转场。
  - 删除失败不切换、不清空、不创建替代画板。
- Non-Goals:
  - 不新增回收站、撤销删除或删除历史。
  - 不改变远程 GitHub 删除协议。
  - 不修改工作区存储 schema、迁移版本或跨标签页同步协议。
  - 不重做项目抽屉树或画布编辑器。

## Decisions

- Decision: 删除操作先确定是否覆盖当前画板，并在本地删除成功后执行一个共享的 post-delete transition。
  - Alternatives considered: 每个按钮继续维护独立分支。
  - Why not chosen: 单画板、批量与目录级联已经发生语义漂移，独立分支容易再次遗漏。
- Decision: 无剩余画板时创建并激活默认空画板。
  - Alternatives considered: 保持 `currentBoardId = null`，清空画布并禁用所有编辑入口。
  - Why not chosen: 当前 Drawnix 没有完整的“无持久化目标但编辑器挂载”状态机；禁用画布会扩大修改面。启动流程已经在无画板时创建默认画板，该方案保持同一不变量。
- Decision: 替代画板创建或切换失败时显示错误并停止转场，不把已删除内容继续当成可编辑成功状态。
  - Alternatives considered: 静默保留旧画布。
  - Why not chosen: 旧画布已无存储目标，继续编辑会制造不可恢复的数据错觉。

## Invariants

- 成功删除的记录不会被重新写回 IndexedDB。
- 非当前画板删除不改变当前画布、URL 或 sessionStorage。
- 删除当前画板后，App 的 `currentBoardId` 和 WorkspaceService 指向同一个仍存在的画板。
- 替代画板为空，不复制被删除画板的元素、viewport 或 theme。
- 删除确认文案、Board/Folder 数据结构和 GitHub 同步 payload 保持不变。

## Risks / Trade-offs

- 删除最后画板后创建默认画板会新增一次 IndexedDB 写入。
  - Mitigation: 只在确认没有任何剩余画板时执行，并沿用现有 `createBoard`。
- 目录递归删除与 post-delete transition 并发可能选到即将删除的画板。
  - Mitigation: 在提交删除前计算完整删除 ID 集，候选画板必须排除整棵子树；删除完成后再二次验证候选存在。
- 替代画板创建失败时可能暂时没有活动画板。
  - Mitigation: 显示可重试错误，清除已删除画布的编辑状态；不得静默宣告完整成功。

## Migration Plan

1. 先增加单画板、批量和目录级联删除的组件/服务回归测试，使当前实现失败。
2. 提取删除 ID 集与剩余首画板选择逻辑。
3. 让本地删除成功后统一执行切换或默认画板创建，并通知 App。
4. 同步清理或重写 URL/sessionStorage 的旧 ID。
5. 复验成功、取消、失败、最后画板、目录级联、刷新恢复和多标签页相邻路径。

## Acceptance Thresholds

- 同一生产构建浏览器路径重复 5 次：删除当前画板后 5/5 不再显示已删除元素，且活动 ID 指向仍存在的画板。
- 删除最后画板后 5/5 创建并激活一个空画板；新画板元素数为 0，刷新后仍为同一画板且不恢复已删除元素。
- 删除非当前画板、取消删除和存储删除失败均不改变当前画布。
- 定向单测、相关组件测试、typecheck、cycles 与 production build 不新增失败。

## Rollback

- 独立回退共享 post-delete transition、URL/sessionStorage 同步与对应测试。
- 不清理或迁移 IndexedDB；回滚不会尝试恢复已经由用户确认删除的数据。
- 若替代画板创建、当前画板切换或刷新恢复任一不变量失败，整体回滚该 change。
