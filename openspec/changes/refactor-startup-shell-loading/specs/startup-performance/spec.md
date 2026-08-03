## ADDED Requirements

### Requirement: 首屏只加载可进入画布所需资源

系统 SHALL 将首次进入可操作画布和可输入 Composer 所需的资源限制为 HTML、启动脚本、最小样式、白板核心渲染、当前工作区恢复与无业务副作用的 `ComposerCore`。

#### Scenario: 首次打开页面进入画布

- **WHEN** 用户清空缓存后首次访问应用
- **THEN** 页面先进入可操作画布
- **AND** 聊天、AI 扩展运行时、工具窗、同步与性能面板不阻塞进入画布
- **AND** 入口静态依赖图不包含 `ai-chat`、`diagram-engines`、`tool-windows` 或 `external-skills` JavaScript 分组

#### Scenario: 首屏直接提供真实可输入的 ComposerCore

- **WHEN** 首屏 Composer 容器完成提交
- **THEN** `ComposerCore` 已经是可聚焦、可编辑并支持 IME 与草稿保留的真实输入组件，而不是等待完整组件替换的占位壳
- **AND** Prompt 输入、焦点和草稿读写不等待模型参数、附件、历史、Agent、Workflow、MCP、external skills 或生成提交运行时
- **AND** 首屏不得因浏览器 idle 自动求值或挂载完整 `AIInputBar` 业务闭包
- **AND** 只有用户动作或安全任务恢复真实需要时才加载对应动作级运行时
- **AND** 动作级运行时加载不得改变 Composer 容器几何、丢失焦点/草稿、自动提交请求或初始化无关业务副作用

### Requirement: 启动阶段必须使用独立单调里程碑

系统 SHALL 分别记录 `shellCommitted`、`boardInteractive`、`workspaceRestored`、`composerInteractive`、`assetIndexReady`、`taskRecoveryReady` 与 `generationRuntimeReady`，不得用单一全局可操作布尔值串行化没有真实依赖关系的前台交互和后台恢复。

#### Scenario: 各启动能力按真实前置条件推进

- **WHEN** shell、画布、工作区、Composer、素材索引、任务恢复或生成运行时中的任一能力达到其可用合同
- **THEN** 系统只推进该能力对应的里程碑并记录单调时间戳
- **AND** 已推进的里程碑不得退回未就绪，也不得因其他无关能力失败而被撤销
- **AND** `boardInteractive` 不等待 `composerInteractive`，`composerInteractive` 不等待素材索引或任务恢复，素材对账与安全任务恢复也不等待可见 AI 或工具 UI
- **AND** 里程碑只用于依赖调度和观测，不成为工作区、任务、素材或生成状态的第二权威

#### Scenario: 隐藏页面继续推进非视觉安全恢复

- **WHEN** 页面在启动期间处于 hidden 且浏览器节流 `requestAnimationFrame`
- **THEN** 系统不得伪报 shell、画布或 Composer 已完成首次可见绘制
- **AND** 任务存储就绪后的安全恢复与其他非视觉关键工作通过 visibility-aware deadline 继续推进
- **AND** 隐藏页面恢复不得等待 Composer、素材库或工具窗口挂载

### Requirement: 非核心能力必须延后挂载

系统 SHALL 将聊天、AI 动作级扩展、工具窗、命令面板、画布搜索、同步、性能面板与相关后台副作用改为未触发不挂载；只有已声明为无副作用且满足资源预算的 core 才能在合格的空闲阶段预热。

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

#### Scenario: Asset、缓存和 Minimap 按各自里程碑延后

- **WHEN** Asset、缓存或 Minimap 的真实前置里程碑尚未成立，或后台预算尚不可用且用户也未提前触发显式素材、存储或展开操作
- **THEN** AssetContext 保留唯一同步 context/API 外壳，但 IndexedDB、同步和缓存重运行时不阻塞首屏
- **AND** 素材后台对账不得等待 Composer 就绪，并且只在 `boardInteractive` 后的后台预算或更早的显式素材动作中开始
- **AND** CacheQuota 与 Minimap 分别消费其真实前置里程碑，不得重新读取一个全局 `isStartupOperable` 门槛
- **AND** 后台初始化和更早的显式存储操作共享同一个初始化 Promise，不得重复初始化服务
- **AND** RetryImage、统一缓存与画布音频缓存不得各自复制初始化或重复存储
- **AND** Minimap 加载失败可重试，卸载后的迟到加载不得挂载组件或遗留监听器

#### Scenario: 精细擦除按完成手势加载

- **WHEN** 用户尚未完成至少包含两个路径点的擦除手势
- **THEN** `precise-erase` 布尔运算运行时不进入首屏静态依赖图且不被请求
- **AND** Freehand 整体删除保持同步，精细擦除只消费本笔完成时的路径、设置和支持元素快照
- **AND** 并发手势共享模块加载但各自执行一次，加载失败允许下一笔重试，精细执行失败仍继续既有 unsupported 元素清理

### Requirement: 高频交互功能必须拆分为 shell、core 和 extended runtime

系统 SHALL 为素材库、图片生成及其他已确认的高频重功能建立立即可见的 feature shell、受预算约束且无提交副作用的 feature core，以及只由具体动作加载的 extended runtime。

#### Scenario: 首次打开素材库

- **WHEN** 用户首次请求打开素材库
- **THEN** 系统先提交带可访问名称和 `aria-busy` 或等价 status 的素材库 shell
- **AND** shell 在接受用户意图后 100ms 内可见，不得以 `fallback={null}` 表现为点击无响应
- **AND** `media-library-core` 只加载素材网格与轻量索引读取，preview、editor、upload、archive 和后台全量对账按真实动作或后台预算加载
- **AND** 素材 core 就绪后先显示版本化轻量索引，再分批对账权威素材、任务和缓存数据，窗口壳不得等待全量扫描

#### Scenario: 首次打开图片生成

- **WHEN** 用户首次请求打开图片生成
- **THEN** 系统先提交保留 Prompt 状态的图片生成 shell，并在 100ms 内显示可访问 loading 状态
- **AND** `image-generation-core` 只加载图片表单、当前模型摘要和参数加载状态
- **AND** 图片 core 不因共享 TTD 根静态加载视频生成，batch、reference editor 和 generation executor 只在对应 tab、动作或提交意图发生时加载
- **AND** core 加载完成后继续同一次打开意图，不得要求用户再次点击或重复创建窗口

#### Scenario: 用户触发的 lazy 边界失败

- **WHEN** 任一用户触发的 feature core 或 extended runtime 加载失败
- **THEN** 对应 shell 显示可理解的失败阶段和显式重试动作
- **AND** 失败清除 in-flight 状态以允许同一动作重试
- **AND** 组件卸载或意图取消后的迟到模块不得挂载 UI、执行业务副作用或提交请求

### Requirement: 前台交互资源必须优先于预热与后台工作

系统 SHALL 通过单一启动资源调度边界协调动态 import、意图预热和 Service Worker 预取，并按 `critical`、`interaction`、`likely-next`、`background` 优先级执行；该调度边界不得复制 feature loader 或业务实现。

#### Scenario: 意图预热与点击复用同一加载

- **WHEN** 用户对素材库、图片生成或其他支持意图预热的入口触发 `pointerenter`、`focusin` 或 `touchstart`
- **THEN** 系统最多启动对应无副作用 feature core 的单飞加载
- **AND** 预热不得挂载组件、初始化 MCP/TaskQueue、写入设置或发送供应商请求
- **AND** 后续 click 先提交可见 shell，再复用同一个 loader Promise，不得重复请求或求值同一 feature core

#### Scenario: 前台交互抢占后台预算

- **WHEN** interaction 工作到达且 likely-next、background 或 Service Worker full-prewarm 尚在排队或执行
- **THEN** 尚未启动的低优先级工作暂停或取消，让出网络和调度预算
- **AND** 已开始且无法取消的原生 dynamic import 只能缓存结果，不得在用户意图已失效后提交 UI 或业务副作用
- **AND** `saveData`、慢网、hidden 页面和前台资源压力会禁止或收紧 likely-next/background 并发，不得降低 interaction 优先级
- **AND** loader、timer、listener 和 subscription 在成功、失败、取消或卸载后释放，失败的单飞状态允许显式重试

### Requirement: Service Worker 支持空闲预取高频懒加载资源

系统 SHALL 在不影响当前会话的前提下，为高频懒加载模块提供空闲预取与缓存机制。

#### Scenario: 允许受调度的空闲预取

- **WHEN** 所请求 feature 的真实前置里程碑已经成立、浏览器空闲，且网络不是省流量或慢网
- **THEN** 页面可通知 Service Worker 预取高频懒加载 chunk
- **AND** Service Worker 仅缓存版本化静态资源，不缓存用户媒体或任务结果
- **AND** 预取不得成为 shell、画布、Composer、素材索引、任务恢复或用户交互的前置条件

#### Scenario: 明确分组不得扩张为全量预取

- **WHEN** 页面明确请求一个或多个 idle prefetch 分组
- **THEN** Service Worker 只预取这些非空分组
- **AND** 不自动追加 defaults、离线素材或其他未请求分组
- **AND** 没有明确请求的自动启动 run 只消费 manifest defaults
- **AND** 当前 defaults 为空时自动启动 run 不产生延后分组请求
- **AND** 只有发布升级的显式 full-prewarm 可以遍历所有非空分组

### Requirement: 启动与首次功能性能必须覆盖 cold、warm 和 upgrade

系统 SHALL 基于同一生产构建产物和明确网络/CPU fixture 测量 cold、warm、upgrade 及首次/重复功能打开，并以阶段里程碑、压缩传输字节、资源数量和初始化调用次数作为验收证据；浏览器缓存命中或外部供应商耗时不得替代这些用户路径。

#### Scenario: 受限网络下冷启动 Composer

- **WHEN** 使用空 HTTP 缓存、空 Service Worker 缓存、400kbps 下行、300ms RTT 与 4× CPU 限速访问生产产物
- **THEN** 从 navigation 到 `composerInteractive` 的 P95 SHALL 不超过 20 秒
- **AND** 首屏期间不得自动下载、求值或挂载完整 `AIInputBar`、Agent/Workflow/MCP、素材库或生成执行闭包
- **AND** 验收报告记录各独立里程碑、实际压缩字节、JS/CSS 请求数和失败请求，不得只记录单一 load event

#### Scenario: Slow 4G 下首次打开高频功能

- **WHEN** 在 1.6Mbps 下行、150ms RTT 与 4× CPU 限速下首次打开素材库或图片生成
- **THEN** 可访问 shell 在接受意图后 100ms 内出现
- **AND** 对应 feature core 从 intent 到 interactive 的 P95 SHALL 不超过 2.5 秒
- **AND** 同一 feature 的实际加载 attempt、core 模块请求和索引初始化计数分别为一，不得用重复预取或重复初始化换取该指标

#### Scenario: 同版本 warm 启动与重复打开

- **WHEN** 同一 release 已受 Service Worker 控制且版本化静态资源已经缓存，用户刷新页面并重复打开已加载功能
- **THEN** 系统仍重新建立正确的 shell、画布、Composer 和必要内存投影状态
- **AND** warm 启动与重复打开不得发起同一 feature core 的重复网络请求、创建第二个 loader、重复扫描同一素材源或重建并行 poll/subscription
- **AND** 在源站不可用但静态缓存完整时仍满足可操作画布与真实 Composer 输入合同

#### Scenario: release upgrade 不与前台路径竞争

- **WHEN** 已安装旧 release 的客户端发现并准备已验证的新 release
- **THEN** 新 release 的 shell、画布和 `ComposerCore` 使用各自里程碑推进，不等待 full-prewarm 完成
- **AND** upgrade full-prewarm 保持最低优先级，并在前台 navigation、feature intent 或 fetch 到达时暂停
- **AND** 升级后的首次功能打开使用新 release 的唯一 feature entry，不得混用旧 hash、重复加载新旧 core 或扩大为全分组下载
- **AND** upgrade 性能验收同时记录旧 SW 控制、新资源激活与新里程碑时间，不得用普通 warm 样本冒充升级路径

#### Scenario: 性能验收样本可复现

- **WHEN** 对 cold、warm、upgrade 或首次功能打开报告 P95
- **THEN** 每个矩阵单元至少记录 20 次独立样本的原始值、release identity、浏览器版本、viewport、网络、CPU、Service Worker 和缓存状态
- **AND** HTTP 错误、request failure、页面异常和资源来源必须与耗时一起报告
- **AND** 不得删除慢样本、提高预算或只报告缓存后的最好一次来通过验收

### Requirement: 可选 CDN 不得成为启动门槛

系统 SHALL 直接从当前同源启动导航、HTML、主入口与控制文件，不得等待可选 CDN 配置、健康探测或超时。只有发布流程已授权当前 `releaseId` 的 CDN 时，该候选才能参与后续版本化静态资源 fallback。

#### Scenario: 当前容器发行直接同源启动

- **GIVEN** 当前 release 只发布容器且远程 CDN 候选为空
- **WHEN** 用户在冷缓存或升级后打开应用
- **THEN** HTML 与主入口直接从同源加载
- **AND** 不请求 jsDelivr `aitu-app` 的 `cdn-config.js`、`version.json` 或 chunk
- **AND** main 只启动一次，不存在 CDN 超时后的第二条启动路径

#### Scenario: 已授权 CDN 不改变主入口优先级

- **GIVEN** 发布流程已为当前 `releaseId` 授权 CDN
- **WHEN** 页面启动且后续版本化静态资源缓存未命中
- **THEN** 导航、主入口和控制文件仍同源优先且不等待 CDN
- **AND** 后续候选选择只允许一个 in-flight 状态，失效立即回源，迟到结果不得重启 main

### Requirement: 构建结果必须可校验首屏边界

系统 SHALL 产出可校验的首屏资源边界，并提供自动检查脚本防止重模块回流到首包。

#### Scenario: 构建后校验入口资源

- **WHEN** 运行构建后首屏校验脚本
- **THEN** 脚本会检查入口 HTML 直接引用的 JS/CSS 与入口脚本首屏动态导入的静态依赖链
- **AND** 每个首屏 JS/CSS 资源的未压缩体积 SHALL 不超过 512,000B
- **AND** 当前 change 的入口静态依赖图未压缩总量 SHALL 不超过 2,000,000B
- **AND** `ai-chat`、`diagram-engines`、`tool-windows`、`external-skills` JavaScript 分组 SHALL 不在入口静态依赖图中
- **AND** 若发现重模块 chunk 重新进入入口链路或首屏资源超出预算则返回失败

### Requirement: CI 必须独立报告生产构建与质量结果

系统 SHALL 让生产构建、质量门禁和生产产物浏览器验证拥有可区分的执行结论，不得因前置历史债务或浏览器安装失败把未执行的编译呈现为编译失败。

#### Scenario: 质量门禁失败时仍执行生产构建

- **WHEN** unit、declaration 或 lint 质量门禁失败
- **THEN** production build/release identity/startup 静态合同仍在无依赖的 build job 中真实执行
- **AND** build job 的成功或失败不包含 Playwright 安装、smoke 或 visual 结果

#### Scenario: 浏览器验证消费精确生产产物

- **WHEN** production build、release identity 和 startup 静态合同成功
- **THEN** build job 上传该提交的 `dist/apps/web` artifact
- **AND** 独立 smoke job 下载并再次校验相同 release identity
- **AND** Playwright 使用 production preview 服务该 artifact，不得重新构建或启动开发服务器冒充生产产物
- **AND** 仅重跑失败的 smoke job 时必须仍能读取同一 workflow run 的成功构建产物，完整重跑时不得因 artifact 同名冲突失败
- **AND** production artifact smoke 必须绕过 Nx result cache，确保 preview 与浏览器断言真实执行

#### Scenario: 既有 lint 债务只能单调减少

- **WHEN** CI 对六个 Nx lint 项目和 Drawnix Hover policy 执行 lint 回归门禁
- **THEN** 新 fingerprint、已有 fingerprint 次数增加、fatal parser error、scope/config/tool 漂移、既有文件退出扫描或 Hover 内部失败均阻断质量 job
- **AND** 历史诊断减少后必须显式执行只减不增的原子 ratchet 收紧 baseline 才能通过
- **AND** CI 不得自动改写 baseline、降低 severity、仅比较总数或排除已有 lint target
- **AND** Nx JSON 命令输出包含非 JSON 前缀、截断、重复文档或尾部垃圾时必须失败，构建配置加载不得污染机器可读 stdout

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

### Requirement: 工作区列表恢复不得重复反序列化完整画板

系统 SHALL 使用独立、版本化、可丢弃的 Board metadata index 恢复项目树和画板列表；完整 Board store 继续作为唯一权威，投影不得包含 elements、Base64 或媒体字节，也不得改变备份、同步或导入格式。

#### Scenario: 旧工作区首次建立可信索引

- **WHEN** 用户首次运行包含既有完整 Board、但尚无当前 schema metadata index 的版本
- **THEN** 系统从权威 Board 扫描一次并只提取 `BoardMetadata`
- **AND** 完整扫描结束前不得把部分投影报告为完整项目树
- **AND** 建立索引不得升级、删除或替换权威 workspace 数据库

#### Scenario: 后续启动读取轻量投影

- **GIVEN** metadata index 的 schema、权威记录数、索引记录数和 journal 状态全部有效
- **WHEN** 系统恢复项目树和画板列表
- **THEN** 系统只遍历 metadata index，不遍历或反序列化完整 Board records
- **AND** 返回的顺序和元数据字段与权威 Board 一致

#### Scenario: 写入中断或索引损坏

- **WHEN** pending journal 存在，或投影缺失、损坏、版本不匹配、计数冲突或被显式 invalidation
- **THEN** 系统在单一排他锁内从权威 Board 幂等重建投影
- **AND** 派生索引不可用时只降级为权威 Board 扫描
- **AND** 索引故障不得触发权威数据库删除、业务数据迁移或部分数据回写
