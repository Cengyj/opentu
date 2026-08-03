## ADDED Requirements

### Requirement: 首屏只加载可进入画布所需资源

系统 SHALL 将首次进入画布所需的资源限制为 HTML、启动脚本、最小样式、白板核心渲染与当前工作区恢复。

#### Scenario: 首次打开页面进入画布

- **WHEN** 用户清空缓存后首次访问应用
- **THEN** 页面先进入可操作画布
- **AND** 聊天、AI 输入、工具窗、同步与性能面板不阻塞进入画布
- **AND** 入口静态依赖图不包含 `ai-chat`、`diagram-engines`、`tool-windows` 或 `external-skills` JavaScript 分组

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

#### Scenario: 可选画布浮层首次激活

- **WHEN** 用户尚未产生可显示 PopupToolbar/LinkPopup 的选择、尚未切换到 Pencil/Pen/Eraser，且尚未打开清空确认
- **THEN** 对应浮层和设置组件不进入首屏渲染图
- **AND** 首次真实激活时按需加载并继续当前操作
- **AND** 首次激活后组件可保留既有关闭动画、焦点恢复和组件状态

#### Scenario: 工具与 PPT 图片重链按真实操作加载

- **WHEN** 画布没有工具元素、没有工具图片生成消息，且用户没有执行 PPT 图片占位或覆盖操作
- **THEN** ToolGenerator、工具设置、TaskQueue 图片执行和 PPT 图片生成/布局/插入运行时不进入首屏静态依赖图
- **AND** 首次真实元素或操作只加载一份原有运行时并保持原有提交、状态、布局、插入和错误语义
- **AND** 组件在动态加载完成前已销毁时不得注册或绘制迟到的工具实例

#### Scenario: 刷新检查延迟读取活动任务

- **WHEN** 用户没有请求刷新页面
- **THEN** 轻量启动运行时不因刷新保护而静态加载活动任务或 TaskQueue 依赖
- **AND** 用户请求刷新时系统才加载活动任务检查，并保持原有确认、取消刷新和继续刷新行为

#### Scenario: 应用菜单和 MoreTools 按首次打开加载

- **WHEN** 用户尚未打开应用菜单或 MoreTools 面板
- **THEN** 首屏只保留可操作 trigger、Undo/Redo 和其他核心工具栏能力，完整菜单与工具面板不进入首屏静态依赖图
- **AND** 首次打开只加载一份运行时，保留既有菜单顺序、popover container/z-index、工具动作和外部回调
- **AND** 加载失败后关闭再打开可以重试，组件卸载后迟到模块不得更新已卸载组件

#### Scenario: Asset、缓存和 Minimap 运行时延后

- **WHEN** 启动阶段的统一 `isStartupOperable` 门槛尚未成立，或门槛成立后尚未到达 Asset/Minimap 的空闲回调且用户也未提前触发显式存储或展开操作
- **THEN** AssetContext 保留唯一同步 context/API 外壳，但 IndexedDB、同步和缓存重运行时不阻塞首屏
- **AND** `isStartupOperable` 成立前 CacheQuota 不得安排 idle 回调或请求 Asset/统一缓存 runtime
- **AND** 空闲初始化和更早的显式存储操作共享同一个初始化 Promise，不得重复初始化服务
- **AND** RetryImage、统一缓存与画布音频缓存不得各自复制初始化或重复存储
- **AND** Minimap 加载失败可重试，卸载后的迟到加载不得挂载组件或遗留监听器

#### Scenario: 精细擦除按完成手势加载

- **WHEN** 用户尚未完成至少包含两个路径点的擦除手势
- **THEN** `precise-erase` 布尔运算运行时不进入首屏静态依赖图且不被请求
- **AND** Freehand 整体删除保持同步，精细擦除只消费本笔完成时的路径、设置和支持元素快照
- **AND** 并发手势共享模块加载但各自执行一次，加载失败允许下一笔重试，精细执行失败仍继续既有 unsupported 元素清理

### Requirement: Service Worker 支持空闲预取高频懒加载资源

系统 SHALL 在不影响当前会话的前提下，为高频懒加载模块提供空闲预取与缓存机制。

#### Scenario: 允许空闲预取

- **WHEN** 页面已经可操作，浏览器空闲，且网络不是省流量或慢网
- **THEN** 页面可通知 Service Worker 预取高频懒加载 chunk
- **AND** Service Worker 仅缓存版本化静态资源，不缓存用户媒体或任务结果

#### Scenario: 明确分组不得扩张为全量预取

- **WHEN** 页面明确请求一个或多个 idle prefetch 分组
- **THEN** Service Worker 只预取这些非空分组
- **AND** 不自动追加 defaults、离线素材或其他未请求分组
- **AND** 没有明确请求的自动启动 run 只消费 manifest defaults
- **AND** 当前 defaults 为空时自动启动 run 不产生延后分组请求
- **AND** 只有发布升级的显式 full-prewarm 可以遍历所有非空分组

### Requirement: CDN 启动探测必须有界且单飞

系统 SHALL 保证 CDN 辅助配置不可无限阻塞主入口，并避免同一页面重复执行等价健康探测。

#### Scenario: 优先 CDN 配置响应迟缓

- **WHEN** 优先 CDN 的 `cdn-config.js` 在规定时间内未成功加载
- **THEN** 启动页切换到同源配置或直接继续本地主入口
- **AND** 迟到回调不得重复启动 main 或重复注册启动副作用

#### Scenario: 多条启动链同时选择 CDN

- **WHEN** 启动页、早期 Service Worker 同步与 bootstrap 同时调用 CDN 选择
- **THEN** 它们共享同一个 in-flight 探测
- **AND** 成功或 local fallback 结果在有效期内复用

### Requirement: 构建结果必须可校验首屏边界

系统 SHALL 产出可校验的首屏资源边界，并提供自动检查脚本防止重模块回流到首包。

#### Scenario: 构建后校验入口资源

- **WHEN** 运行构建后首屏校验脚本
- **THEN** 脚本会检查入口 HTML 直接引用的 JS/CSS 与入口脚本首屏动态导入的静态依赖链
- **AND** 每个首屏 JS/CSS 资源的未压缩体积 SHALL 不超过 512,000B
- **AND** 当前 change 的入口静态依赖图未压缩总量 SHALL 不超过 2,000,000B
- **AND** `ai-chat`、`diagram-engines`、`tool-windows`、`external-skills` JavaScript 分组 SHALL 不在入口静态依赖图中
- **AND** 若发现重模块 chunk 重新进入入口链路或首屏资源超出预算则返回失败

### Requirement: 生产与构建依赖升级必须来源明确且保持业务合同

系统 SHALL 通过唯一锁文件解析安全修复依赖，并以真实消费者合同证明升级没有改变 Excel、Mermaid 或构建工具链语义。

#### Scenario: SheetJS 官方修复版本保持 Excel 合同

- **WHEN** 安装生产依赖并执行批量生图模板或模型基准 Excel 往返
- **THEN** `xlsx` 解析到上游官方 `https://cdn.sheetjs.com/xlsx-0.20.3/xlsx-0.20.3.tgz`
- **AND** 中文列名、工作表名称与顺序、数值和结构化值保持不变
- **AND** 锁文件记录可验证的官方 tarball 完整性，不接受无完整性来源漂移
- **AND** 系统不为该升级引入另一套 Excel 解析器或数据格式迁移

#### Scenario: Mermaid 不可信内容使用已锁定安全策略

- **WHEN** 聊天渲染用户或模型提供的 Mermaid 图表
- **THEN** 直接和传递 Mermaid 均解析到 `10.9.6`
- **AND** Mermaid 的传递 uuid 解析到 `14.0.1`
- **AND** 渲染器显式使用 `securityLevel: 'strict'`，不依赖上游默认值

#### Scenario: SWC 工具链保持当前兼容边界

- **WHEN** 使用冻结锁安装、类型检查或 Nx 生产构建
- **THEN** Nx 19 经 `@swc-node/register` 使用的 `@swc-node/core` 解析到精确版本 `1.13.3`
- **AND** 本 change 不隐式进行 Nx、Vite、Vitest 或 React 大版本迁移

#### Scenario: 生产依赖审计

- **WHEN** 对冻结锁解析出的生产依赖运行项目规定的安全审计
- **THEN** 审计不得包含已知生产漏洞
- **AND** Excel 往返与 Mermaid strict 合同必须同时通过，不能只以审计结果代替业务兼容验证

#### Scenario: 构建 Node 使用受支持且可复现的版本

- **WHEN** 在 CI 或发布 Dockerfile 中安装冻结锁并构建生产产物
- **THEN** 项目 engines SHALL 限制为已验证且仍受维护的 Node 22.x
- **AND** CI 与 Docker builder SHALL 使用相同的精确 Node patch 版本
- **AND** linux/amd64 Docker builder SHALL 通过 manifest digest 固定 glibc slim 基础镜像，而不是使用浮动或已 EOL 的 major tag
- **AND** 依赖清单未改变时，源码或 release identity 变化不得使 frozen dependency install 层失效
- **AND** 精简 builder 内的冻结锁安装与根生产构建必须成功
- **AND** builder 变化不得改变最终 Nginx 运行时、浏览器目标或应用数据/网络合同

### Requirement: 用户手册必须作为独立静态文档打开

系统 SHALL 从应用菜单打开显式用户手册 HTML，并保证 Service Worker、静态发布和缓存不会用 SPA 应用壳替代该文档。

#### Scenario: 从应用菜单打开用户手册

- **WHEN** 用户在完整应用菜单中选择“用户手册”
- **THEN** 系统在新窗口打开 `./user-manual/index.html`
- **AND** 不使用已知会落入 SPA fallback 的 `/user-manual/` 目录 URL
- **AND** 菜单运行时延迟加载不得改变该动作或菜单顺序

#### Scenario: 显式手册文档响应

- **WHEN** 浏览器、Service Worker 或发布校验请求 `/user-manual/index.html` 或其他显式手册 `.html` 页面
- **THEN** 响应包含 `opentu-document=user-manual` 文档标记且不是带应用 `#root` 的 SPA shell
- **AND** 首页手册版本与发布版本一致，所有生成 HTML 页面及站内链接保持完整（当前发布合同为 21 个页面）
- **AND** HTTP 200 但正文为应用壳时必须判定为无效静态文档，不能写入手册缓存或报告成功

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
