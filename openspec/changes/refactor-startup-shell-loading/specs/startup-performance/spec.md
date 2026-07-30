## ADDED Requirements

### Requirement: 首屏只加载可进入画布所需资源

系统 SHALL 将首次进入画布所需的资源限制为 HTML、启动脚本、最小样式、白板核心渲染与当前工作区恢复。

#### Scenario: 首次打开页面进入画布

- **WHEN** 用户清空缓存后首次访问应用
- **THEN** 页面先进入可操作画布
- **AND** 聊天、AI 输入、工具窗、同步与性能面板不阻塞进入画布
- **AND** 入口静态依赖图不包含 `ai-chat`、`tool-windows` 或 `external-skills` JavaScript 分组

#### Scenario: 首屏保留 AI 输入布局

- **WHEN** 用户进入可操作画布但尚未聚焦、输入或通过快捷键激活 AI 输入
- **THEN** 页面可以显示与完整输入栏等尺寸的轻量输入壳
- **AND** 轻壳不初始化模型健康、工作流提交或生成任务副作用
- **AND** 从轻壳切换到完整输入栏时不产生可见布局跳动或丢失焦点/草稿

### Requirement: 非核心能力必须延后挂载

系统 SHALL 将聊天、AI、工具窗、命令面板、画布搜索、同步、性能面板与相关后台副作用改为未触发不挂载，或在浏览器空闲时延后启动。

#### Scenario: 首次点击非核心能力

- **WHEN** 用户首次打开聊天抽屉、项目抽屉、工具箱、同步设置、命令面板或画布搜索
- **THEN** 系统按需加载对应模块
- **AND** 加载完成后功能可正常使用

#### Scenario: 未挂载 Chat 时收到打开或消息命令

- **WHEN** toolbar、快捷键、工作流或其他现有入口在完整 ChatDrawer 尚未挂载时请求打开或投递消息
- **THEN** 轻量 controller 记录打开意图并加载 ChatDrawer
- **AND** 加载完成后继续原命令而不是静默丢弃
- **AND** 加载失败时显示可重试错误状态

### Requirement: Service Worker 支持空闲预取高频懒加载资源

系统 SHALL 在不影响当前会话的前提下，为高频懒加载模块提供空闲预取与缓存机制。

#### Scenario: 允许空闲预取

- **WHEN** 页面已经可操作，浏览器空闲，且网络不是省流量或慢网
- **THEN** 页面可通知 Service Worker 预取高频懒加载 chunk
- **AND** Service Worker 仅缓存版本化静态资源，不缓存用户媒体或任务结果

### Requirement: 构建结果必须可校验首屏边界

系统 SHALL 产出可校验的首屏资源边界，并提供自动检查脚本防止重模块回流到首包。

#### Scenario: 构建后校验入口资源

- **WHEN** 运行构建后首屏校验脚本
- **THEN** 脚本会检查入口 HTML 直接引用的 JS/CSS 与入口脚本首屏动态导入的静态依赖链
- **AND** 每个首屏 JS/CSS 资源的未压缩体积 SHALL 不超过 500KB
- **AND** 当前 change 的入口静态依赖图未压缩总量 SHALL 不超过 2,000,000B
- **AND** `ai-chat`、`tool-windows`、`external-skills` JavaScript 分组 SHALL 不在入口静态依赖图中
- **AND** 若发现重模块 chunk 重新进入入口链路或首屏资源超出预算则返回失败

### Requirement: 延后加载不得破坏恢复与离线不变量

系统 SHALL 在改变 Chat、AI 与工具模块挂载时机后保持现有初始化错误、任务恢复和 warm offline 行为。

#### Scenario: 工作区初始化失败

- **WHEN** 工作区初始化抛出错误
- **THEN** 页面显示初始化失败信息
- **AND** 用户可以导出日志、进入安全模式或打开调试页面

#### Scenario: 已预热应用离线刷新

- **WHEN** Service Worker 已安装且应用静态缓存已预热，随后源站不可用
- **THEN** 用户仍可刷新并进入可操作画布
- **AND** 离线恢复不依赖用户媒体或任务结果进入静态预取缓存
