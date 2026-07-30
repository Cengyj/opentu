## ADDED Requirements

### Requirement: 删除当前画板后必须建立有效活动画板

系统 SHALL 在任何成功删除当前画板的入口结束前，让 WorkspaceService、App、URL、sessionStorage 与画布指向同一个仍存在的画板。

#### Scenario: 删除当前画板且仍有其他画板

- **WHEN** 用户确认删除当前画板，且删除集合之外仍有画板
- **THEN** 系统切换到排序后的第一个剩余画板
- **AND** 画布、URL 与 sessionStorage 同步到该画板
- **AND** 已删除画板的元素不再显示或可编辑

#### Scenario: 删除最后一个画板

- **WHEN** 用户确认删除当前画板，且删除后没有剩余画板
- **THEN** 系统创建并激活一个默认空画板
- **AND** 新画板不复制被删除画板的元素、viewport 或 theme
- **AND** 刷新后仍恢复到该新画板

#### Scenario: 目录级联删除包含当前画板

- **WHEN** 用户选择“删除目录及文件”，且被删除目录子树包含当前画板
- **THEN** 系统将整棵目录子树中的画板计入删除集合
- **AND** 删除成功后执行与单画板删除相同的活动画板转场

#### Scenario: 删除非当前画板或取消删除

- **WHEN** 用户删除非当前画板或取消删除确认
- **THEN** 当前画布、URL 与 sessionStorage 保持不变

#### Scenario: 删除持久化失败

- **WHEN** 本地存储拒绝删除当前画板
- **THEN** 系统不切换或创建替代画板
- **AND** 当前画板仍可见且保持原持久化记录
- **AND** 用户收到可重试的错误反馈
