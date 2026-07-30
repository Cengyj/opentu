# Change: Improve Workspace Manager Interface Accessibility

## Why

2026-07-30 的当前组件诊断和本地生产构建 Chromium 证明确认：项目抽屉没有命名的非模态区域或确定焦点入口；画板/文件夹行是不可聚焦、无状态、仅 pointer 激活的 `div`；树行“更多”按钮可进入 Tab 序列但没有名称且容器 opacity 为 0；右键菜单不接管或箭头管理焦点；English provider 下工作区管理文案仍为中文。

同一生产构建还确认：已有画板时搜索无匹配项，界面显示“暂无画板 / 创建第一个画板”，把过滤结果误表达为真实空工作区。修正这些行为会改变用户可观察的键盘、焦点、状态与语言契约，因此需要审批后实施。

## What Changes

- 给 ProjectDrawer 及其工具栏触发器建立命名的非模态区域、展开关系、确定焦点入口、Escape/关闭后的焦点返回；共享 SideDrawer 只增加 ProjectDrawer 显式启用的兼容 props。
- 把当前画板/文件夹树暴露为有 expanded/current/selected 状态的层级结构，并提供与现有 pointer 行为等价的 roving keyboard 操作。
- 给每个已有 item action 添加本地化名称和 focus-visible 呈现；让 ProjectDrawer 的上下文菜单可由键盘打开、管理菜单/子菜单焦点并在关闭后返回调用项；共享 ContextMenu 的默认调用者行为保持不变。
- 区分 workspace loading、真实空工作区和搜索无匹配状态；无匹配时不再展示“创建第一个画板”。
- 让 ProjectDrawer shell 与 F-02 画板/文件夹管理系统文案消费已有 zh/en provider；用户名称、文件名、错误 payload、持久化数据和分析字段不翻译。
- 为 ProjectDrawer 的现有 resize handle 提供可命名、有界且与当前宽度回调一致的键盘等价路径；pointer/touch 路径保持不变。

## Impact

- Affected specs: `workspace-manager-interface-accessibility`
- Affected code: project toolbar trigger, `ProjectDrawer.tsx`, project-drawer styles, task-specific `BaseDrawer`/`SideDrawer` accessibility props, opt-in `ContextMenu` focus props, existing i18n catalog, focused tests
- Adjacent but preserved: `fix-workspace-current-deletion-transition` keeps post-delete active-board semantics; `improve-workspace-operation-failure-consistency` keeps storage commit/error semantics; F-03 keeps import/export/backup; F-04 keeps LayerPanel; F-25 keeps FramePanel/PPT; other SideDrawer/ContextMenu callers keep existing defaults
- Data/API compatibility: no Board/Folder/schema/store/key/URL/sessionStorage/GitHub sync/analytics payload change
- Visual boundary: only focus visibility and state presentation required by the confirmed interface contract; compact/touch geometry remains evidence-gated because no fresh 320/390 browser sample exists
