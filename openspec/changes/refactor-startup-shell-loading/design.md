## Context

- 2026-07-29 当前入口链重新确认：`index.html → main.tsx → bootstrap.tsx → App → lazy Drawnix → initial mounted components`。
- `apps/web/src/app/bootstrap.tsx` 已主要使用 `@drawnix/drawnix/runtime`，但两个 analytics release API 仍来自根 barrel。当前生产 `bootstrap-B0wTCVom.js` 因而静态 import `ai-chat-KsRCwrxK.js`（2,808,742B raw / 837,626B gzip）与 `tool-windows-1WB33Kw7.js`（641,215B / 197,356B）。
- `packages/drawnix/src/drawnix.tsx` 初始无条件挂载 `DeferredAIInputBar` 与 `ChatDrawer`，进一步加载 workflow、skills 与 external-skills 依赖。
- startup validator 会遍历入口静态依赖，但禁止前缀缺少 `ai-chat-`；逐文件 500KiB 预算也不能限制多个小 chunk 的总成本。
- 同构建四组各 5 次基线：冷/SW 关可操作中位数 1174ms、39 请求、5,859,060B 正文；冷/SW 开 1496ms、51 请求、6,517,471B；热/SW 关 468ms；热/SW 开 505ms。该本机口径用于修复前后对照，不外推公网设备。
- 已安装并预热的 SW 在源站停止后 857ms 恢复到可操作画布；离线缓存与存储格式不需要为本 change 重做。
- 2026-08-03 当前依赖图的真实消费者确认：批量生图 Excel 模板和模型基准使用 `xlsx`；聊天 Markdown 使用 Mermaid；`@plait-board/mermaid-to-drawnix` 带入 Mermaid/uuid；Nx 19 通过 `@swc-node/register` 使用 `@swc-node/core`。这些依赖不能仅按 package 名称删除或猜测性升级。
- 当前锁文件已将 SheetJS 从 npm registry 的 `0.18.5` 升级为上游官方 CDN 的 `0.20.3` tarball，将直接/传递 Mermaid 收敛到 `10.9.6`、其 uuid 收敛到 `14.0.1`，并将 `@swc-node/core` 固定到 `1.13.3`。该事实以 lock importer/resolution、`pnpm why`、业务合同测试和生产审计为证据。
- 继续追踪入口图后，应用菜单、MoreTools、Minimap、Asset/统一缓存运行时和 `precise-erase` 被确认是剩余可延后边界。全部边界和 CacheQuota 启动门槛完成后，最终生产构建把 `drawnix-app` 降至 481,924B、入口静态图降至 1,941,175B；所有单文件均不超过 512,000B，入口静态图低于 2,000,000B 预算。
- 用户手册响应证据区分了两个 URL：`/user-manual/` 收到 SPA 应用壳，`/user-manual/index.html` 收到 18,467B 的真实静态手册首页，含 `opentu-document=user-manual` 和 `opentu-manual-version=1.0.2`。当前生成目录包含 21 个 HTML 页面；菜单和发布校验因此必须以显式文档 URL 为合同。
- 生产审计最终结果为 464 个 production dependencies、0 vulnerabilities，exit 0。包含开发工具链的完整审计覆盖 1,592 个 dependencies，仍因 3 个 moderate vulnerabilities 以 exit 1 结束：2 个来自 `@swc/cli → downloader → file-type`，1 个来自 Nx 19 `nx graph` CORS；没有 high 或 critical。本 change 不以缺少兼容矩阵的 Nx/SWC 大版本升级掩盖该剩余开发工具链风险。
- Node 官方发布计划确认 Node 20 已于 2026-04-30 结束维护，而 Node 22 维护至 2027-04-30；修改前 CI 与 Docker builder 仍使用 Node 20。本机 Node `22.22.2` 已完成本 change 的 2,218 个测试、类型检查与生产构建，Vite `6.4.3` 和 Vitest `3.2.7` 的 engines 明确包含 `>=22.0.0`。修改前 Node 20 完整 builder 基础镜像为 398,366,825B/413 个 Debian 包；候选 Node `22.23.2-bookworm-slim` linux/amd64 manifest 为 `sha256:0f65470961851f2354dc8e560853e2f428ea928436135fc7e35780ab100c7e00`，镜像为 79,895,607B/88 个 Debian 包并包含 Corepack `0.34.6`。

### 2026-08-03 production regression evidence

本节记录对已部署 release 的新事实，并覆盖后续实现对旧 localhost 静态预算的解释；旧证据仍保留作为历史对照，但不能再单独证明生产体验合格。

- Production identity：`https://img.foropencode.com/` 返回 `app-version=1.0.4` 与 `app-release-id=7e6617f04c83c9653a196be2bde785e551b763cd`，与当前 HEAD/tag 一致。
- Cold/SW-off：shell 约 5.48 秒、canvas 约 6.19 秒、完整 AI 输入约 6.85 秒；166 个资源，142 JS / 21 CSS，约 1.65MB encoded / 4.44MB decoded。
- Slow 4G fixture（1.6Mbps、150ms RTT、CPU×4）：完整 AI 输入约 13.11 秒。Constrained fixture（400kbps、300ms RTT、CPU×4）：shell 约 20.46 秒、完整 AI 输入约 36.76 秒。
- 首次素材库与 AI 图片生成在 SW 已控制页面时仍分别约 1.92 秒、1.86 秒才可见，并分别新增约 66、73 个页面资源。`fallback={null}` 使等待阶段没有用户反馈。
- 生产 manifest 中 `ai-chat=305`、`tool-windows=323`、`editor-engines=304`；`tool-windows + runtime-static-assets` union 为 382 项且与 `ai-chat` 重叠约 300 项。当前本地同结构 `tool-windows` 为 7,061,305B raw，三大分组并不是少量高价值资源。
- `aitu-app@1.0.4` 未发布到 jsDelivr；`cdn-config.js`、`version.json` 和抽查的启动/功能 chunk 均返回 404。入口先等待最多 1200ms，Service Worker 的 local preference 又没有移除远程候选，缓存 miss 可继续承担错误 CDN 成本。
- 容器内 Nginx 未启用 gzip/Brotli；当前约 1.94MB raw 启动图可压到约 0.57MB gzip。公网 OpenResty 已为 HTML/多数 JS 补 gzip，但 104,034B idle manifest 仍 identity/no-store；镜像在不同反向代理下表现不一致。
- `AssetContext` 的刷新首次加载顺序为本地素材 → 已完成/归档任务 → 全部统一缓存元数据 → 合并/去重/排序 → idle 补 size。8 秒 TTL 只存在于当前 JS realm；浏览器刷新必然重建内存索引。

当前实际启动和首次工具链为：

```text
index.html
  → optional CDN config (currently invalid jsDelivr candidate)
  → main → bootstrap → App → Drawnix/Board
  → DeferredAIInputBar shell
  → board && shell global gate
  → idle import AIInputBarRuntime
  → WorkflowProvider + ModelHealthProvider + 5,000+ line AIInputBar graph
  → module-top MCP/long-video/external-skill initialization

first media-library click
  → request tool-windows + runtime-static-assets
  → mount DrawnixDeferredRuntime + DrawnixDeferredFeatures
  → import MediaLibraryModal
  → initialize Asset runtime
  → scan local assets + tasks + unified cache

first image-generation click
  → request the same broad groups
  → mount shared TTDDialog
  → statically import both image and video generation roots
  → render image dialog
```

因此瓶颈不是“浏览器没有缓存”，而是冷版本仍需发现/传输过多模块、刷新仍需重新求值和重建内存索引、首次交互同时启动无关后台闭包，以及不可用 CDN 的确定性失败。后续设计必须在 cold cache 下成立，warm cache 只作为额外收益。

## Goals / Non-Goals

- Goals:
  - 让用户尽快进入可操作画布
  - 首屏直接提供真实可聚焦、可编辑、可保留草稿的轻量 Composer，而不是等待完整 AI 业务图替换占位壳
  - 非核心能力按独立 feature core/extended runtime 激活，用户交互始终高于后台预取
  - 保留当前 SW 的 precache 机制，并新增一层空闲预取
  - 让源码挂载边界、package 运行时导出、Vite feature entry、idle manifest 与产物校验使用同一组资源边界和压缩字节预算
  - 让容器直连、公网反代、cold/warm/upgrade 和首次/重复功能打开都拥有可复现的性能合同
  - 保持当前画布、任务、工作流、缓存、升级和崩溃恢复语义
  - 保证用户手册菜单和静态发布路径始终返回独立手册文档，而不是 SPA 应用壳
- Non-Goals:
  - 不重做白板核心交互
  - 不新增用户可配置的性能开关
  - 不将用户媒体或任务结果纳入 idle 预取
  - 不改变任务执行线程、模型路由、存储 schema 或迁移版本
  - 不改变 AI generation type、selector/selectionKey、模型路由、Prompt、价格、TaskQueue 或供应商请求语义；仅迁移加载边界和状态所有权
  - 不以 preload/prefetch 整个应用、合并成巨型 chunk、提高预算或依赖第二次刷新代替模块边界修复
  - 不迁移 SW task/chat data plane 到 `postmessage-duplex`，也不建立第二套 release/CDN/prefetch 控制协议；`refactor-sw-duplex-comm` 独立拥有其数据面迁移
  - 不改变全局队列/任务生命周期，不删除 IndexedDB/Cache API 数据；素材索引只是可丢弃派生投影
  - 不把外部供应商生成耗时计入或冒充本地启动优化收益
  - 不为用户手册目录 URL 引入新的路由系统，也不改变手册内容结构

## Decisions

- Decision: 维持 `Drawnix` 作为对外组件，但把非核心 UI 与启动副作用挪入独立的延后层组件。
  - Alternatives considered: 直接整体 `lazy(() => import('./drawnix'))`
  - Why not chosen: 会把“进入画布”与“加载整套 UI”继续绑死，无法精细控制首屏与延后能力边界。
- Decision: 为 `@drawnix/drawnix` 增加 `runtime` 子入口，供 `main.tsx` 与 `app.tsx` 读取启动/工作区服务。
  - Alternatives considered: 继续从根 barrel 导出运行时服务
  - Why not chosen: 难以稳定隔离启动服务与 UI 图谱。
- Decision: Web 的动态画布只从 `@drawnix/drawnix/app` 加载 `Drawnix`，根 barrel 继续作为兼容 API；首屏不可避免的 React、Plait、Slate 与 TDesign 依赖按依赖层拆成稳定 vendor chunk。
  - Alternatives considered: 继续动态导入根 barrel，或只把超大入口改名成多个无依赖边界的块。
  - Why not chosen: 根 barrel 不是精确的运行时边界；任意按体积改名既不能阻止额外导出回流，也容易形成 chunk 循环。共享的 RxJS、TSLib 等低层依赖必须独立于 Plait 层，避免 bootstrap 通过共享依赖反向加载画布引擎。
- Decision: 以明确的 feature entry 管理 `manualChunks + idle-prefetch-manifest`，manifest 记录每个 `*-core`/`*-extended` entry 的真实传递闭包、唯一资源和压缩字节；不再把任何命中 `tool-windows`/`ai-chat` 文件名的完整动态闭包视为一个可交互分组。
  - Alternatives considered: 继续按源码目录命名 chunk 并遍历其全部 imports/dynamicImports，或只依赖 Rollup 默认拆包。
  - Why not chosen: 当前产物已经证明目录命名组会扩张到 300+ 资源且跨组高度重叠；默认拆包又不能形成稳定可校验的功能 entry。feature entry 必须与真实 import 边界和预算一一对应，共享 foundation 单独计量，不能靠改 chunk 名掩盖依赖。
- Decision: 将 bootstrap 所需的 analytics release API 从现有轻量 `runtime` 子入口导出，bootstrap 不再静态引用根 barrel；根 barrel 导出继续保留兼容。
  - Alternatives considered: 只调整 manual chunk，把根 barrel 依赖强制塞入另一个名字。
  - Why not chosen: 改名不改变静态可达关系，也不能阻止 UI 图谱进入 bootstrap。
- Decision: Chat 使用轻量 context/controller 记录打开意图，只有首次打开或需要投递消息时才挂载完整 Drawer；挂载前的命令必须排队或由 state 驱动，不能静默丢失。
  - Alternatives considered: 保持 ChatDrawer 初始挂载，仅依赖浏览器缓存。
  - Why not chosen: 冷启动仍需下载、解析和执行完整 Chat 依赖，不符合未触发边界。
- Decision: AI 输入首屏直接挂载真实可交互的 `ComposerCore`。Core 只拥有 Prompt/IME/草稿、基础 generation type、当前选择摘要、发送意图和稳定几何；model/parameter picker、attachment/library、history/optimizer、Agent/Workflow/MCP/external skills 和 generation submit 分别由动作级 runtime 承载。idle 只允许预取满足预算且无副作用的 core，不再自动求值或挂载完整 AI 业务运行时。
  - Intent contract: focus、输入和 IME 不等待重运行时；需要重运行时的 click/Enter 进入一次 `preparing` 意图，loader 就绪后恰好继续一次。失败保留草稿和意图并提供显式重试，取消/卸载使迟到结果不能提交。
  - Initialization boundary: `initializeMCP()`、`initializeLongVideoChainService()` 和 `externalSkillService.initialize()` 从 `AIInputBar` 模块顶层移出，由对应 Agent/长视频/Skill action runtime 的幂等显式入口拥有。
  - Alternatives considered: 保留占位轻壳并在 idle 自动加载当前完整 AIInputBar，或把当前完整 AIInputBar 直接纳入首屏。
  - Why not chosen: 前者已在生产造成 142 JS 的自动瀑布和“先残缺后完整”体验；后者把 Workflow、MCP、TaskQueue 和多媒体执行链重新放回首屏。真实 ComposerCore 同时消除布局替换和无关依赖。
- Decision: 可选画布浮层采用“首次真实激活后挂载并保留实例”的边界；PopupToolbar、LinkPopup、Pencil/Pen/Eraser settings 与 CleanConfirm 未激活时不进入 React 渲染图，激活后保持既有关闭动画、焦点和组件状态。
  - Alternatives considered: 首屏挂载所有浮层但用 CSS 隐藏。
  - Why not chosen: CSS 隐藏仍会执行模块、hooks 与订阅，不能形成可验证的启动边界。
- Decision: `with-tool` 只静态保留工具消息和画布契约；设置读取、图片生成 TaskQueue/模型选择、图片插入与 `ToolGenerator` 在真实工具消息或工具元素出现时动态加载。PPT 图片占位点击和图片覆盖也通过轻量 controller 加载现有运行时，controller 不复制生成、布局或插入业务逻辑。
  - Alternatives considered: 把整套工具/PPT 运行时预装进画布插件，或在 controller 中重写业务逻辑。
  - Why not chosen: 前者恢复启动重链，后者产生第二套执行语义。迟到的 ToolGenerator 加载必须检查组件是否已销毁，加载失败必须允许同一用户操作重试。
- Decision: `safeReload` 保持相同的活动任务确认语义，但仅在用户真实请求刷新时动态加载活动任务/TaskQueue 图。
  - Alternatives considered: 由轻量 runtime 静态导入任务队列。
  - Why not chosen: 页面启动不需要执行刷新确认，静态导入会让生成链回流首屏。
- Decision: 应用工具栏首屏只保留菜单 trigger、Undo 和 Redo；完整菜单在首次真实打开时通过可重试单飞 loader 加载。MoreTools 同样只保留轻量 trigger，完整面板按首次打开加载。
  - Alternatives considered: 保持菜单/MoreTools 全量静态挂载，或在轻壳复制菜单动作。
  - Why not chosen: 前者继续带入导入、导出、设置、备份和工具运行时；后者会产生第二套动作语义。动态运行时继续复用原菜单顺序、popover container/z-index 和 Backup/Cloud 回调。
- Decision: AssetContext 保持同步 context/API 外壳和唯一初始化 Promise，但不再依赖全局 `isStartupOperable` 才能推进。它先读取版本化、可丢弃的轻量 `AssetProjectionIndex` 供素材库立即显示，再在 `boardInteractive` 后的后台预算或首次显式素材动作中对账本地素材、任务和统一缓存。CacheQuota、RetryImage、音频缓存和 Minimap 各消费其真实前置里程碑，不能因 AI Composer 状态被串行阻塞。
  - Alternatives considered: 移除 AssetProvider，或让每个消费者自行加载/初始化存储。
  - Why not chosen: 移除 provider 会改变现有消费者合同；分散初始化会产生重复读取、重复订阅和竞态。轻壳保留唯一状态所有权，运行时只承载延后实现。
  - Projection boundary: 索引只保存素材卡片所需的轻量派生元数据、schema version、生成时间和源 revision；本地素材库、任务库与 Cache API 仍是唯一权威。索引损坏、版本不匹配或写入失败时可删除并重建，不删除任何用户媒体，也不让旧字段进入正常业务链。
  - Refresh boundary: 先返回最近索引，再分批对账；本地素材读取与任务读取可安全并行，统一缓存补充在任务身份可用后执行。大集合合并/size 补齐不得阻塞窗口壳或首屏。
  - Declaration boundary: 延迟缓存 runtime 只导出显式、稳定的 `UnifiedCacheService` 公共接口，不通过 `typeof import` 推导带 private IndexedDB 状态的实现 singleton 类型；该接口只约束声明边界，不创建第二个缓存服务。
  - Declaration failure boundary: `useDialog`、`useDialogContext`、`usePopover` 和 `usePopoverContext` 必须以直接依赖 `@floating-ui/react` 的公开类型显式描述返回合同。`vite-plugin-dts` 的 diagnostics 不再只打印后继续成功，生成后也拒绝 pnpm 物理路径和未声明的 `@floating-ui/react-dom` 类型引用；CI 另以临时目录 declaration-only 编译确认关键入口和组件声明真实存在，避免被省略文件造成的假阳性扫描。
- Decision: 工作区 Board 元数据建立在独立 IndexedDB `aitu-workspace-index/board_metadata` 中的可丢弃投影；现有 `aitu-workspace/boards` 仍是唯一权威且不升级 schema。manifest 记录投影 schema、权威记录数和索引记录数，entry 只包含侧栏需要的 `BoardMetadata`，不得包含 elements 或媒体字节。
  - Consistency boundary: `saveBoard`、`updateBoardMetadata`、`deleteBoard` 与 `clearAll` 继续是唯一写入口；每次操作先写带唯一 operationId 的 pending journal，再写权威 Board 和投影，最后清除 journal。跨标签页使用命名 exclusive Web Lock，无 Web Locks 时使用进程内串行队列。
  - Recovery boundary: 缺失、损坏、计数不符、pending journal 或显式 invalidation 都使投影无效，并在锁内从 `boards` 幂等重建。派生库不可用时只降级扫描权威 Board，绝不进入主数据库版本恢复或删除路径。
  - Migration boundary: 旧用户首次运行新版本必须扫描一次完整 Board 来建立可信投影；后续刷新不得再次遍历完整 Board。投影不进入备份、导入或云同步格式，因此没有用户数据迁移和双写权威。
- Decision: Card 的只读 Markdown renderer 从 Drawnix 首屏静态图移入 Card 实际渲染触发的动态边界。该边界在存在 Card 时自动开始，不依赖点击；加载完成通过原 `CardGenerator` 回调重新测量内容高度，ResizeObserver 继续处理后续尺寸变化。
  - Why: 生产 stats 将 `MarkdownReadonly` 的 24,948 rendered bytes 定位为 `drawnix-app` 超预算的可延后来源；拆分后主块减少 11,243B，并保留卡片内容、选择、滚动和自动高度语义。
- Decision: CI 将测试/声明/lint 质量合同、production build/release identity/startup 静态合同和 production artifact 浏览器 smoke 拆成 `quality`、`main`、`smoke` 三个职责独立的 job；`quality` 与 `main` 无依赖并行执行，`smoke` 只依赖并下载 `main` 的精确 `dist/apps/web` artifact。production artifact 以 workflow `run_id` 形成同一 run 内的稳定名称，完整重跑时由 `main` 覆盖，仅重跑失败的 `smoke` 时仍能读取此前成功产物。Playwright 安装、smoke 或 visual 失败不能再让编译显示为 skipped，也不能把开发服务器结果冒充生产产物结果；artifact smoke 禁用 Nx result cache，确保真实启动 preview 并执行浏览器断言。
  - Lint migration boundary: 当前六个 Nx lint 项目的既有诊断与 Drawnix Hover findings 记录为 schema-versioned baseline。fingerprint 包含项目、workspace-relative 文件、severity、稳定 rule/message identity 和精确诊断节点，不包含易漂移的绝对路径、行号或参数化全局消息；使用 multiset count 防止同一诊断重复扩散。baseline 同时锁定 Nx lint target、有效 ESLint/Nx 配置、实际工具版本和已扫描文件，scope/config 漂移、仍存在却退出扫描的文件、fatal parser error、baseline 损坏及 Hover 检查器异常一律 fail closed。Hover 检查器以完整 versioned JSON 区分 findings 与内部崩溃。
  - Baseline ownership: 普通 verify 全程只读；新增 fingerprint 或数量增加立即失败，历史 fingerprint 减少也失败并要求显式运行单调 ratchet。ratchet 仅在 scope contract 不变、零 additions 且每个 count 只减不增时原子收紧 baseline，不由 CI 自动执行；contract migration 的 snapshot 只向 stdout 输出候选 JSON。任何 baseline 变化都必须作为代码 diff 审查。该边界不降低 ESLint severity、不排除 Web/Drawnix、不把完整 lint 降级成 changed-files lint。既有债务清零后删除 baseline 数据并恢复零诊断合同，不保留双 lint 权威。
  - Nx machine-output boundary: lint gate 读取 `nx show ... --json` 时只接受一个完整 JSON 文档，前缀日志、截断、双文档或尾部垃圾全部 fail closed。Vite 配置加载不得向 stdout 写发布信息；这项合同必须在隔离 Nx workspace-data/cache 的冷启动环境复现，不能用本机热缓存结果替代。
  - Alternatives considered: `continue-on-error`、按 errors/warnings 总数设置上限、只 lint 改动文件、或在本次紧急修复中修改 2,899 条跨产品/测试诊断及模块循环。
  - Why not chosen: 前三者都可能静默放过替换型或重复型新增问题；仓促清理全部历史债务会把 CI 修复扩大为未经专项验证的 Web/SW/备份模块边界重构。逐诊断基线保持完整 lint 的回归约束，同时让构建状态恢复真实含义。
- Decision: `precise-erase` 只在已完成的有效多点擦除手势中动态加载；Freehand 整体删除保持同步执行，精细擦除使用本笔路径、设置和支持元素快照。模块加载单飞但每笔手势独立执行，加载失败允许下一笔重试。
  - Alternatives considered: 启动时静态加载布尔运算，或合并并发手势为一次执行。
  - Why not chosen: 静态加载为所有用户支付精细擦除成本；合并手势会改变编辑语义。unsupported 元素仍按原有 precise execute 后的 live board 规则处理。
- Decision: 用户手册菜单始终打开 `./user-manual/index.html`；Service Worker 将显式 `.html` 识别为独立静态文档并拒绝把应用壳缓存响应当作手册，release static contract 校验文档标记、版本和字节身份。
  - Alternatives considered: 继续打开 `/user-manual/` 并依赖各部署平台的目录索引/重写。
  - Why not chosen: 本机真实响应已经证明该目录 URL 会落入 SPA fallback，而显式文件 URL 可稳定返回手册；依赖平台重写无法形成一致的静态发布合同。
- Decision: validator 同时校验入口、ComposerCore 和每个高频 feature core 的完整传递图，报告 raw/gzip 字节、JS/CSS/静态文件数、最长依赖发现深度和共享 foundation；禁止组清单只作为额外防线，不再是功能边界权威。
  - Initial budgets: ComposerCore 增量不超过 12 个 JS、150KB gzip、依赖深度 4；素材库和图片生成各自 core 不超过 25 个 JS/CSS、300KB gzip、依赖深度 4；任一 ordinary/default idle union 不超过 30 个文件、500KB gzip。旧入口 raw 2,000,000B/单文件 512,000B 门禁继续保留但不能代替这些预算。
  - Alternatives considered: 只补 chunk 前缀、继续只看单文件/入口 raw，或把小文件合成一个巨型 chunk。
  - Why not chosen: 当前 305/323 项分组已经证明名称和单文件预算会放行重命名、多小块及动态闭包回流；合成巨型文件减少请求数却不减少传输、解析或求值成本。
- Decision: Excel 继续使用 SheetJS API，但将版本来源固定为上游官方 `https://cdn.sheetjs.com/xlsx-0.20.3/xlsx-0.20.3.tgz`；升级必须通过批量生图中文字段和模型基准多工作表/结构化值往返合同。
  - Alternatives considered: 继续使用 npm registry 的 `xlsx@0.18.5`，或在没有真实格式矩阵时改用另一解析器。
  - Why not chosen: 前者保留生产审计风险，后者会无依据改变 Excel 兼容面和业务 API。
- Decision: Mermaid 直接依赖和 `@plait-board/mermaid-to-drawnix` 的传递依赖统一为 `10.9.6`，传递 `uuid@9.0.1` 统一为 `14.0.1`；聊天中的不可信图表始终以 `securityLevel: 'strict'` 初始化。
  - Alternatives considered: 只升级直接 Mermaid，或仅依赖渲染器默认安全级别。
  - Why not chosen: 会留下重复的旧传递版本或让安全策略随上游默认值漂移。
- Decision: 仅将 `@swc-node/core` 固定为当前 Nx 19 / `@swc-node/register` / SWC 图已验证的 `1.13.3`，不把启动与安全修复扩大成 Nx、Vite、Vitest、React 的大版本迁移。
  - Alternatives considered: 同时升级整套构建工具。
  - Why not chosen: 当前 Vite/Vitest 与 Nx peer 迁移需要独立兼容矩阵，不能用无关大版本变化污染启动优化和依赖安全证据。
- Decision: 项目 engines 限制为 Node 22.x，CI 与 Docker builder 使用精确 Node `22.23.2`；Dockerfile 使用 linux/amd64 `bookworm-slim` manifest digest，而不是浮动 major tag。依赖清单与 workspace manifests 先形成 frozen-install 层，源码和 release identity 只使后续生产构建层失效；最终静态站仍复制到既有、已锁定的 Nginx 运行时。
  - Alternatives considered: 继续使用浮动 `node:20`、升级到尚未完成项目兼容矩阵的 Node 24，或改用 Alpine/musl builder。
  - Why not chosen: Node 20 已 EOL；Node 24 与当前 Nx 19 没有本 change 的完整兼容证据；Alpine 会额外改变 libc。Node 22 已由当前完整工具链验证，bookworm-slim 保持 glibc 并将 builder 基础镜像字节减少约 79.9%、Debian 包数减少约 78.7%。
- Decision: 用多个单调启动里程碑替代一个 `isStartupOperable` 总门槛。
  - Milestones: `shellCommitted`、`boardInteractive`、`workspaceRestored`、`composerInteractive`、`assetIndexReady`、`taskRecoveryReady`、`generationRuntimeReady`。每个状态只能向前推进并带可观测时间戳；它们不是新的业务数据权威。
  - Dependency examples: ComposerCore 只依赖自身 commit；Asset 后台对账依赖 board/shell 可交互而不依赖 Composer；安全任务恢复依赖 task storage readiness，不依赖任何可见 AI/工具 UI；生成 submit runtime 只在提交意图或已有活动任务恢复时加载。
  - Scheduling boundary: 可见页面使用 RAF 后 task 确认 paint；RAF 被隐藏页节流时以 visibility-aware deadline 推进非视觉安全工作。隐藏页不会假报 first paint，但也不会无限阻塞任务恢复。
  - Alternatives considered: 继续让 `board !== null && AI shell mounted` 控制 AI、Asset、Minimap、监控和恢复。
  - Why not chosen: 生产调用链已证明无关功能被一个 UI 壳串行化；一个门槛无法表达安全恢复与前台交互的不同优先级。
- Decision: 新增无业务依赖的 `StartupResourceScheduler` 作为动态资源调度边界，复用现有可重试单飞 loader，而不是创建第二套 feature 实现。
  - Priorities: `critical`、`interaction`、`likely-next`、`background`。interaction 永远先启动；likely-next/background 受 visibility、`saveData`、effective network type、并发和压缩字节预算约束。
  - Intent preload: `pointerenter`、`focusin`、`touchstart` 可启动对应无副作用 feature core；click 立即提交 open state/可见 shell并复用同一个 Promise。预热不得挂载组件、初始化 MCP/TaskQueue、写设置或发送供应商请求。
  - Cancellation: 尚未启动的后台工作可取消；已开始的 native dynamic import 不能伪装成可取消，但其结果可被缓存且卸载后不得提交 UI/业务副作用。Service Worker 后台队列在前台 client fetch/输入发生时于资源边界暂停。
  - Lifetime: 每个 loader 成功后页内复用，失败清除 in-flight 以允许显式重试；timer、listener 和 subscription 在完成/取消/卸载后释放。
- Decision: 高频工具拥有独立 shell/core/extended 边界，禁止从入口调用 `enableToolWindows(TOOL_WINDOW_GROUPS)` 或其他 catch-all 作为前置条件。
  - Media library: `media-library-shell` 立即显示 WinBox/header/filter skeleton；`media-library-core` 负责 grid 与轻量索引；preview/editor/upload/archive 等进入 extended runtime。
  - Image generation: `image-generation-shell` 立即显示窗口和 Prompt 状态；`image-generation-core` 只包含图片表单/模型摘要/参数加载状态。图片与视频不再由共享 `TTDDialog` 静态互相导入，batch、reference editor 和 generation executor 按 tab/action/submit 加载。
  - Deferred runtime: 当前 `DrawnixDeferredRuntime` 中 task recovery、workflow sync、font/video recovery、auto insertion 与 provider pricing 按真实前置条件拆成独立 coordinator；只迁移加载所有权，不改变任务状态机、并发、attempt 或恢复语义。
  - Feedback: 用户触发的 lazy boundary 在 100ms 内显示有可访问名称、`aria-busy`/status 的等几何 fallback；加载失败显示结构化阶段和重试。后台无 UI runtime 可以继续 render `null`，但不能吞掉影响用户动作的失败。
- Decision: 静态 CDN 候选由发布事实而不是 display version 或运行时猜测决定。
  - Current release mode: publish workflow 只发布 GHCR/DockerHub 容器，没有发布 `aitu-app` npm 包，因此默认 `origin` mode，远程候选集为空；HTML 主入口直接同源启动且不等待可选 `cdn-config.js`。
  - Future CDN mode: 只有同一 releaseId 的静态树已发布，且 `version.json`、入口及抽查/清单中的关键 hash 经 CORS、MIME、字节身份验证后，构建/发布流程才可注入固定 CDN base。就绪失败必须阻止启用 CDN，而不是阻止 origin 容器发布或让客户端反复探测不存在的包。
  - Service Worker: 明确 `local`/origin 偏好使 `getAvailableCDNs()` 返回空；已验证 CDN 才能参与版本化静态资源 fallback。同一个资源失败不会为每个 lazy chunk 重复支付完整超时。
  - Control file: manifest defaults 为空且没有显式 group/full-prewarm 请求时，不获取 `idle-prefetch-manifest.json`。显式请求按 releaseId + group 单飞；upgrade full-prewarm 保持最低优先级、可暂停且不得与旧/新页面的 foreground fetch 竞争。
- Decision: 最终镜像自身提供 gzip 基线，不依赖外部反向代理补救。
  - Build/runtime: 对可压缩的 hashed JS/CSS 和大静态 JSON 生成可验证 `.gz`，Nginx 使用已确认可用的 `gzip_static`；HTML/控制 JSON 等非静态压缩文件使用有界动态 gzip fallback。基线类型包括 HTML、JavaScript、CSS、JSON/manifest 和 SVG，不强制重复压缩已经压缩的图片/字体。
  - Contract: 容器直连和配置的公网 origin 在 `Accept-Encoding: gzip` 下，对大于 1KiB 的可压缩响应返回正确 `Content-Encoding` 与 `Vary`；解码字节必须等于 release contract，hashed immutable 与 HTML/control no-cache/no-store 语义保持不变。Brotli 仅在部署环境明确提供并验证时作为额外优化，不引入未锁定 Nginx 模块。
- Decision: 用 Performance API 记录可复现阶段与调用计数，不记录业务内容。
  - Startup marks: navigation、shell committed/painted、board committed/interactive、workspace restored、Composer requested/fetched/evaluated/committed/interactive。
  - Feature marks: 每个 feature 的 intent、shell visible、requested/fetched/evaluated/committed/interactive、error/retry；Asset 另记录 snapshot read 与 reconcile，SW 记录 cache/CDN/origin source 和 foreground/background queue counts。
  - Privacy: 只记录阶段、毫秒、资源/调用数量和压缩字节；不记录 Prompt、凭据、ModelRef、用户媒体 URL/字节、任务内容或完整错误响应。
- Decision: 规范所有权保持单一。
  - `startup-performance` 拥有用户感知阶段、feature 激活、调度和 cold/warm/upgrade SLO。
  - `release-safe-static-loading` 拥有构建图、压缩、文件数和依赖深度预算。
  - `smart-cdn-loading` 拥有 CDN 候选、origin fallback 和控制文件加载策略。
  - `ai-input-generation` 拥有拆分后 generation type、selector、selectionKey、草稿、IME 和恰好一次提交语义。
  - `harden-version-upgrade-convergence` 继续拥有 releaseId、A/B cache retention 和升级提交；本 change 只验证其性能交互，不建立第二套 cache authority。
  - `refactor-sw-duplex-comm` 只拥有 task/chat data plane；它不得让 channel 建立成为 shell/Composer gate，也不得接管现有 release/CDN/prefetch control plane。

## Invariants

- 首屏仍显示同位置、同几何的 AI 输入区域、工具栏、画布和启动/错误反馈；输入区域必须是可聚焦、可编辑、可保留草稿与 IME 状态的真实 `ComposerCore`，不是等待整个 AI 运行时替换的占位壳。
- 未触发对应动作时，ComposerCore 不初始化模型健康、Workflow、MCP、external skills、素材库或生成执行副作用；idle 不得自动挂载这些完整业务闭包。
- 用户首次打开 Chat、素材库、图片生成或触发 Composer 扩展动作的命令不得丢失；加载中 100ms 内出现可访问状态，成功后恰好继续一次原操作，失败时保留意图并可重试。
- 任务恢复、自动插入和 WorkZone/工作流同步仍在现有延后运行时执行；不得因 UI 拆分永久跳过。
- 画板、任务、工作流、偏好、素材与 Cache API 的 key/schema/迁移保持不变。
- SW 仍只预取版本化静态资源，不缓存用户媒体或任务结果；warm offline 行为不得回归。
- 普通 SW idle run 只消费明确请求的非空分组；没有明确请求时只消费 manifest defaults。遍历全部分组只属于已就绪新 release 的显式 full-prewarm 阶段。
- 当前 manifest defaults 为空：未发生真实交互的普通启动不下载延后分组；Chat/AI/工具入口按需请求，高版本 release 的 full-prewarm 仍负责升级离线完整性。
- 当前容器发行的主入口必须直接同源启动，不请求或等待未发布的 CDN 配置；未来只有发布门禁已授权的同 release CDN 才可参与后续静态资源 fallback，且选择单飞、失效快速回源。
- 公开根 barrel 继续兼容；只改变 bootstrap 的内部导入路径。
- 未激活的可选浮层、ToolGenerator、工具图片执行、PPT 图片生成/覆盖和刷新任务检查不得进入首屏静态依赖图；首次真实操作必须继续调用原有业务实现，不能丢命令、重复提交或改变错误传播。
- 未打开的应用菜单/MoreTools、未展开的 Minimap、未触发存储能力和未发生有效多点擦除时，对应重运行时不得静态进入首屏；失败重试、卸载防迟到和每次手势独立执行语义不得回归。
- CacheQuota、Asset 对账、任务恢复与生成执行各自依赖明确的单调里程碑，不得重新受一个 `isStartupOperable` 或可见 AI 组件串行阻塞；空闲加载与首次显式访问仍共享单一初始化所有权。
- 素材投影索引只是带 schema/revision 的可丢弃派生数据；本地素材、任务与 Cache API 继续是唯一权威，索引失效只能后台重建，不得删除用户数据或建立第二套写入语义。
- 对每个 feature，意图预热、真实 click 和业务 submit 必须复用同一可重试单飞 loader；预热不得挂载 UI、发起生成、写设置或改变任务状态。
- 用户手册入口必须指向显式 `user-manual/index.html`；显式手册 HTML 响应不能被 SPA shell、旧缓存或发布路径重写替代，手册版本必须与发布版本一致。
- 依赖升级不改变 `.xlsx` 工作表名、中文列名、值类型、导入/导出 API，不改变 Mermaid-to-Drawnix 业务入口，也不修改持久化 schema；生产依赖树必须由锁文件唯一确定。

## Risks / Trade-offs

- 非核心功能改为延后挂载后，首次点击聊天/工具/同步可能出现短暂局部 loading。
  - Mitigation: 同步提交有稳定几何和可访问状态的 feature shell；用 pointer/focus/touch 意图预热无副作用 core，前台 click 抢占所有 likely-next/background 预取。
- 任务恢复、自动插入画布等副作用延后后，恢复状态展示会稍晚。
  - Mitigation: 统一放入 idle 启动器，确保不会阻塞进入画布，但尽早补齐状态。
- 过度拆包可能带来过多小请求。
  - Mitigation: 使用稳定的手动 chunk 分组，限制为少量高价值分组。
- Chat ref 当前在 Drawer 未挂载时为空，直接条件渲染会让 toolbar/消息命令静默失效。
  - Mitigation: 先把打开意图和待投递命令收敛到轻量 context/controller，并为首次打开、发送消息和 workflow 更新补测试。
- ComposerCore 与动作级扩展运行时之间的状态所有权分配错误，可能丢失 focus、草稿、IME 组合状态或重复提交。
  - Mitigation: Core 唯一持有 Prompt/草稿/IME/发送意图；扩展运行时只消费不可变意图并以 intent id 恰好完成一次。覆盖加载失败、重试、卸载迟到和 IME Enter 合同。
- 持久素材投影可能短暂显示旧快照。
  - Mitigation: 快照携带 source revision 和生成时间，UI 明确进入后台对账阶段；每次素材/任务/缓存权威写入同步推进 revision，损坏或版本不匹配的快照只能丢弃后重建。
- 动态 import 不能真正取消，前台抢占时已开始的背景传输可能仍占用带宽。
  - Mitigation: scheduler 仅在资源边界开始工作，限制背景并发/压缩字节，前台意图后不再启动新背景工作；已完成模块可缓存但不提交迟到副作用。
- 总预算可能因合法核心能力变化而失真。
  - Mitigation: 预算以实际入口图报告输出；任何调整必须带新测量和独立 OpenSpec 审批，不能只提高阈值。
- Mermaid strict 模式可能改变带原始 HTML 的图表标签显示。
  - Mitigation: 使用上游 10.9.x 补丁版本并显式测试聊天初始化配置；该安全收紧不通过放宽 strict 回滚。
- SheetJS 官方 tarball 来源不同于 npm registry，升级可能暴露 Excel 边缘格式差异。
  - Mitigation: package 与 lockfile 原子锁定完整 HTTPS URL，冻结锁安装；以批量模板中文字段、模型基准工作表顺序和结构化值往返合同保护真实消费者。
- `uuid@14` 与 `@swc-node/core@1.13.3` 是传递/工具链兼容锁，未来上游升级可能使 override 过时。
  - Mitigation: 每次依赖升级重新执行 `pnpm why`、冻结锁安装、类型检查、生产构建和生产审计；不能只删除 override 后接受漂移解析。
- 精简且精确锁定的 Node builder 不包含完整镜像中的 Git、Python 或编译工具，未来新增原生源码依赖可能使冻结锁安装失败；digest 若没有维护也会停留在旧安全补丁。
  - Mitigation: 当前锁文件无 Git 依赖且 amd64 glibc 原生依赖均有锁定的预编译包，最终 Docker build 必须复验；未来依赖若确需编译工具，应显式增加最小、版本化的 build package 并同层清理，不回退到浮动完整镜像。Node 安全发布时须同步更新 engines/CI patch、Docker tag/digest 和本节构建证据。
- 动态菜单、存储或精细擦除加载失败可能让首次操作没有结果，迟到模块也可能在组件卸载或下一笔手势后执行。
  - Mitigation: 统一使用可重试单飞 loader；轻壳保留当前意图，组件卸载后忽略迟到模块，擦除运行时只消费完成手势的不可变快照。对应并发、失败重试和卸载合同必须通过。
- 手册显式路径若在部署或 Service Worker 中再次被应用壳替代，会重现“Resource unavailable”而 HTTP 状态仍可能是 200。
  - Mitigation: 不能只断言状态码；静态合同和浏览器验证必须同时检查 `opentu-document=user-manual`、页面结构和版本标记，并能从首页跳转到其他手册页面。

## Migration Plan

1. 保留已完成的 bootstrap/runtime 导出、Chat controller、可选画布运行时、用户手册、依赖安全与 CI 修正；先增加新的产物图和浏览器失败合同，固定生产 v1.0.4 的冷启动、慢网和首次工具数据。
2. 引入不包含业务数据的单调启动里程碑和 `StartupResourceScheduler`，先迁移现有单飞 loader/预取调用，再删除素材库与图片生成入口对 `enableToolWindows(TOOL_WINDOW_GROUPS)` 的前置依赖。
3. 将当前 AI 输入迁移为唯一真实 `ComposerCore`，再按 model/parameter、attachment/library、history/optimizer、Agent/Workflow/MCP/external skills 和 generation submit 切开动作运行时；删除 idle 自动挂载当前完整 `AIInputBar` 的路径和模块顶层初始化。
4. 将素材库拆为 shell/core/extended，将 GitHub sync、preview/editor、audio player、ZIP/download 和 canvas insertion 下沉到真实动作边界；增加带 revision 的 `AssetProjectionIndex`，完成线性增量对账和损坏重建合同后，删除刷新首开时的全量 Cache.keys/多轮 O(n²) 投影路径。
5. 将 TTD 共享根拆为图片与视频独立 shell/core；参考图素材库、batch/editor 和 generation execution 分别按按钮/tab/submit 加载。提交继续复用现有唯一生图路由和 TaskQueue，不创建第二套 planner/executor。
6. 以明确 feature entry 重建 manifest 和产物校验，将当前 300+ 项宽分组退出 ordinary/default idle；完成原点发行默认零 CDN 候选、defaults 空时零 manifest 请求、容器 gzip 和公网响应合同。
7. 按模块合同 → 定向行为 → 产物图 → 生产 artifact 浏览器 → 本机容器直连 → `https://img.foropencode.com/` 的顺序验证。每个阶段都记录 cold/warm SW、A→B 升级、慢网、资源/调用计数和回复不变量。
8. 只有新方案通过全部门禁才发布；回滚以前一个 release 的整体静态树为单位，保留素材索引为可忽略派生数据。不删除 IndexedDB、Cache API、任务或用户偏好。

## Acceptance Thresholds

- 生产站冷缓存/SW 关闭的 20 次样本中，`shellCommitted`、`boardInteractive`、`composerInteractive` 必须分别记录，不得用一个总时间代替。在与 2026-08-03 基线同网络/设备口径下，三者 P75 分别不高于 2.5s/3.0s/3.5s，且不得高于当前 5.48s/6.19s/6.85s 基线。
- Slow 4G（1.6Mbps、150ms RTT、4× CPU）下 `composerInteractive` P95 不高于 8s；400kbps、300ms RTT、4× CPU 下 P95 不高于 20s（当前约 36.76s）。这两项必须在 cold/SW-off 和 A→B 升级各验证一组，不以热缓存代替。
- ComposerCore 的入口增量不超过 12 个 JavaScript、150KiB gzip、依赖深度 4；素材库和图片生成的各自 core 闭包不超过 25 个 JS/CSS、300KiB gzip、深度 4；ordinary/default idle union 不超过 30 个文件、500KiB gzip。共享 foundation 必须显式计入首个消费者，禁止通过改名、重复分组或巨型 chunk 规避。
- 用户 intent 到素材库/图片生成/Chat 可见 shell 的 P75 不高于 100ms；正常公网上 shell 到 core interactive P75 不高于 750ms，Slow 4G P95 不高于 2.5s。首次与重复打开必须分别记录，重复打开 P75 不高于 150ms 且新增资源请求为 0。
- 首次点素材库不得加载 TaskExecutor、generation runtime、ToolWinBoxManager 全量闭包、视频根或 GitHub/audio/editor/ZIP action chunk；首次点图片生成不得加载视频根、素材库 extended 或 generation executor（submit 之前）。两者首开新增请求各不超过 25。
- 拥有同 revision 素材快照时，窗口首帧不执行全量 Cache.keys/任务全表扫描；背景 reconcile 不阻塞 shell/core，N 条投影合并为 O(n)，同 revision 不重复扫描。
- 前台 intent 发生后不再启动新的 likely-next/background 工作；每个 feature loader 同时最多一个 in-flight import，失败可重试，完成/取消/卸载后没有残留 timer、listener 或 subscription。
- 当前容器发行的公网候选数为 0，冷启动不请求 jsDelivr `aitu-app` 资源；manifest defaults 为空时不请求 `idle-prefetch-manifest.json`。本机容器直连和公网 origin 均必须以 gzip 服务大于 1KiB 的可压缩 HTML/JS/CSS/JSON/manifest/SVG，解码字节与 release contract 一致。
- `ai-chat-*`、`diagram-engines-*`、`tool-windows-*`、`external-skills-*` 和完整 generation runtime 始终不得进入入口/ComposerCore 静态图；不得在 idle 无条件求值或挂载。
- warm SW 源站离线仍能进入可操作画布；初始化失败仍显示错误、日志、安全模式和调试入口。
- 同视口/同主题前后截图中，未交互首屏 AI 输入容器位置和尺寸不变；浏览器报告 CLS 不高于 0.1，移动/平板无新溢出。
- 每个首屏 JS/CSS 资源的未压缩体积不高于 512,000B，入口静态图未压缩总量不高于 2,000,000B；不得通过提高预算完成验收。
- `pnpm install --frozen-lockfile` 必须保持 package/lock 一致；`pnpm audit --prod --json` 在当前审计源下不得报告已知生产漏洞。
- Excel 合同必须保持批量模板中文字段、模型基准工作表顺序和结构化值往返；聊天 Mermaid 合同必须证明 `securityLevel: 'strict'`，依赖树必须只解析到已锁定的 Mermaid/uuid/SheetJS/SWC 版本。
- 应用菜单打开的 URL 必须为 `/user-manual/index.html`，响应必须包含手册文档标记且不包含应用 `#root`；手册首页必须能跳转到 `advanced-settings.html` 等独立页面。
- `NX_DAEMON=false pnpm exec nx build drawnix` 必须完成 JavaScript 与 `vite-plugin-dts` 声明输出，且不得包含 declaration diagnostics 或遗漏公开入口声明。
- 项目 engines 必须限制为受验证的 Node 22.x，CI 与 Docker builder 必须使用同一精确 Node `22.23.2`；Docker builder 必须解析到已记录的 linux/amd64 manifest，冻结锁安装与根生产构建必须在精简镜像内通过，最终运行镜像仍只包含既有 Nginx 静态服务边界。

## Verification Evidence (2026-08-03)

- `pnpm --dir packages/drawnix exec vitest run src/utils/__tests__/spreadsheet-dependency-contract.test.ts src/components/chat-drawer/__tests__/MermaidRenderer.test.tsx --no-file-parallelism --maxWorkers=1`：2 files / 3 tests，exit 0。
- `pnpm audit --prod --json`：生产审计由修复前 2 high + 1 moderate 收敛为 464 production dependencies、0 vulnerabilities，exit 0。
- `pnpm install --frozen-lockfile --lockfile-only`：5 workspace projects 的 package/lock 收敛检查通过，exit 0；完整冻结锁安装也已在本 change 验证通过。
- SheetJS `0.20.3` tarball 的 lockfile integrity 为 `sha512-oLDq3jw7AcLqKWH2AhCpVTZl8mf6X2YReP+Neh0SJUzV/BdZYjth94tG5toiMB1PPrYtxOCfaoUCkvtuH+3AJA==`。
- 已通过的启动边界定向合同包括 Chat controller 6/6、with-tool 7 files 18/18、overlay/PPT 7 files 15/15、相邻 tool/PPT 3 files 39/39；最终生产构建和产物预算见下方证据，浏览器复测仍以 `tasks.md` 未勾选项为准。
- AppToolbar/AppMenu 定向回归为 5 files / 21 tests，精细擦除/hand-mode 边界为 3 files / 10 tests，均 exit 0；两批修改后的 `drawnix:typecheck` 与目标 ESLint 均通过。
- CacheQuota 启动门槛合同为 3 files / 14 tests，目标 ESLint 0 errors，`drawnix:typecheck` exit 0；`isStartupOperable` 成立前零 idle 调度、零缓存 runtime 加载。
- 最终全量 `pnpm test` 为 292 files / 2,218 tests（2,217 passed、1 skipped、0 failed），exit 0；`drawnix:typecheck`、`web:typecheck` 均 exit 0，`check:cycles` 为 0 cycles，`git diff --check` exit 0。
- 最终 `NX_DAEMON=false pnpm exec nx build web` exit 0；`drawnix-app` 为 481,924B，入口静态图为 1,941,175B，所有单文件均不超过 512,000B。startup analyzer 9/9、release static 44/44、manual contract 14/14 均通过。
- 最终 `NX_DAEMON=false pnpm exec nx build drawnix --skip-nx-cache` exit 0；发布收尾的未过滤构建曾揭示插件会打印 4 个 `TS2742` 后仍返回 0，并省略 `dialog.d.ts`、`popover.d.ts`。四个导出 Hook 改用 `@floating-ui/react` 的公开返回类型后，Vite 声明输出包含两个文件且无 diagnostics 或物理依赖路径；`pnpm run verify:drawnix-declarations` 另以 TypeScript declaration-only 编译扫描 1,071 个文件，合同测试 3/3、真实编译均 exit 0。`unified-cache-runtime.d.ts` 继续只暴露显式缓存合同，`task-queue/index.d.ts` 继续引用现有 singleton，不改变运行时实现。
- 用户手册 21 个生成页面完整性与版本合同已通过；实际静态首页为 18,467B，包含 `opentu-document=user-manual` 与 `opentu-manual-version=1.0.2`。最终菜单浏览器验收也已完成：显式 URL、marker/version、sidebar/main、无 `#root` 与 `advanced-settings.html` 导航均正确。
- SheetJS `0.20.3` 官方 tarball 的 SHA-512 integrity 已按锁文件值验证；生产审计覆盖 464 dependencies、0 vulnerabilities，exit 0。完整工具链审计覆盖 1,592 dependencies，剩余 3 moderate（2 个 `@swc/cli → downloader → file-type`、1 个 Nx 19 `nx graph` CORS），0 high/critical，exit 1。
- Node 官方计划证据为 v20 end `2026-04-30`、v22 end `2027-04-30`；本机 Node `22.22.2` 已通过上述完整测试/类型/构建。Node `22.23.2-bookworm-slim` 候选经 registry manifest 与本机 inspect 确认为 linux/amd64、79,895,607B、88 个 Debian 包、Corepack `0.34.6`，对比现有 Node `20.20.2` 完整 builder 的 398,366,825B、413 个包，分别减少 79.9% 与 78.7%；该收益属于构建拉取/缓存/攻击面，不冒充浏览器启动或最终 Nginx 镜像体积收益。
- 全仓 lint 仍为 exit 1：当前 433 errors / 2,441 warnings；HEAD 基线为 439 errors / 2,471 warnings，差值为 -6 errors / -30 warnings，本 change 新增 diagnostics 为 0。该结果不得误报为全仓 lint 通过。
- GitHub run `30788461795` 与上一 run `30786487360` 的唯一失败均为 Web 历史 lint `53 errors / 161 warnings`；E2E lint 当时均为 `0 errors / 513 warnings`，两次 build step 都是 skipped 而非编译失败，`release-e2e` 均成功。schema v2 可执行 lint regression baseline 以 `7bf00434a069d52cd207eb5de6f727f09db59681` 为来源，实际覆盖 Drawnix `367/1,659`、React Board `0/34`、React Text `0/26`、Utils `12/47`、Web `53/161`、Web E2E `0/511` 和 4 条 Hover findings；smoke 合同修正移除了 2 条既有 E2E warning，并已通过只减不增的 ratchet 收紧，文档旧总数不再作为门禁权威。
- 修复提交 `5184f16989dff8bf138def7f5ead7ecf2aee45b6` 的 GitHub run `30796609345` 已实际完成且 conclusion 为 success：`quality`、`main`、`smoke`、`release-e2e` 四个 job 均为 success；其中 `main` 真实执行 production build/release identity/startup/artifact，`smoke` 下载该 artifact 并运行 production preview，不再出现 lint 失败导致编译 skipped 的错误表象。
- 最终 10 次 cold/SW-off 语义门槛原始 operable 为 `[375,302,288,297,317,325,313,294,317,312]ms`，中位 313ms、最大 375ms；请求为 `[16,18,18,18,18,18,18,18,18,18]`，正文为 1 次 1,986,782B、9 次 1,989,484B。10/10 样本的 `unified-cache-service`、Asset runtime、Minimap、Chat/AI/工具/编辑器等禁止启动资源均为 0，页面错误、HTTP 和 request failure 均为 0。
- 最终四组各 5 次 operable 原始值：cold/SW-off `[463,327,312,298,340]ms`（中位/最大 327/463），cold/SW-on `[316,337,323,313,326]ms`（323/337），warm/SW-off `[306,89,66,83,69]ms`（83/306），warm/SW-on `[329,736,736,116,69]ms`（329/736）。冷样本均为 18 请求、1,989,484B；warm 样本源站网络请求和正文均为 0。warm/SW-on 第 2 次记录到一次 `startup-app` `net::ERR_ABORTED`，但页面可操作；原探针未记录足以证明其阶段或原因的数据，因此不作归因。等待稳定 2 秒后追加 5 次 warm/SW-on 为 `[136,108,113,94,120]ms`，5/5 controller 正确且无 request/HTTP/page error，原异常未复现。
- 最终非付费浏览器 smoke 已确认 AI 输入草稿、Chat、App Menu、MoreTools、Minimap 均可操作，模型/付费请求计数为 0；从 App Menu 打开的手册显式 URL、marker、版本、sidebar/main、无 `#root` 和 `advanced-settings.html` 导航均正确。Chat 完整运行时加载时外部 `https://foropencode.com/api/history/aggregated` 返回一次 HTTP 404，但没有页面异常且不影响本地功能，本 change 不把该外部状态接口响应隐写为通过。
- warm SW 在源站离线时由 `http://127.0.0.1:7210/sw.js` 持续控制，83ms 重新进入可操作画布，页面错误、request failure 和 HTTP failure 均为 0。
- 仓库 Playwright 要求的 Chromium 1200 已安装到隔离可写缓存；使用 `web:preview` 在独立端口服务刚构建的 `dist/apps/web` 后，3 个 smoke 全部通过。首次真实执行揭示旧测试会在延迟 AI 输入轻壳上过早测量高度；修正后先触发轻壳、验证草稿回放到完整 `AIInputBar`，再保持原 2px 阈值验证 4/6 行高度。feature/visual/responsive 全矩阵仍未因此被误标为完成。
- 最新 AI 轻壳回归使用同一 production preview 证明无需交互即可升级：组件合同 9/9，smoke 3/3；独立 Chromium 探针未发送鼠标或键盘事件，观测到 `shellSeen=true`、`runtimeSeen=true`、342ms 自动挂载、残留轻壳 0、active test id 为 null、空草稿、应用 request/page failure 为 0。实际 `localhost:7200` 同口径为 831ms、残留轻壳 0、应用 failure 0；额外 fetch/xhr 审计的供应商提交请求为 0，仅观测到既有 performance history GET。外部 `cdn.jsdelivr.net/.../cdn-config.js` 因 CSP 失败被单独记录，既有有界本地 fallback 后页面和完整输入栏仍成功挂载，不把该外部失败隐写为通过。
- `openspec validate refactor-startup-shell-loading --strict` 因 `openspec: command not found` 以 exit 127 结束；`pnpm exec openspec validate refactor-startup-shell-loading --strict` 也因仓库未安装 CLI 以 exit 254 结束。strict validation 明确未完成。仓库 Playwright 全矩阵以及任务/工作流真实恢复、升级、多标签页浏览器路径仍由 `tasks.md` 的未勾选项跟踪，不由构建、合同测试或已完成的浏览器 smoke 替代。

## Rollback

- 独立回退 runtime analytics 导出/导入、Chat controller、AI 轻壳和 validator/Vite 改动及对应测试。
- 可选浮层、工具、PPT 和刷新边界按 controller/runtime 成对回退；不得只恢复静态重依赖而保留失效的首次激活状态，也不得回退成第二套生成或插入实现。
- AppMenu、MoreTools、Asset/缓存、Minimap 和 precise erase 必须按各自轻壳/运行时边界成对回退；不能保留指向已删除运行时的 loader，也不能把擦除并发手势合并。
- 用户手册修复可独立回退菜单链接与静态路由合同，但不得发布已知会返回 SPA shell 的目录入口；回退前必须提供等价的显式静态文档路由证据。
- 依赖回退必须同时修改 manifest、override 与 lockfile，并重跑相同 Excel/Mermaid/审计/类型/构建合同。不得只回退 SheetJS tarball、Mermaid 或 uuid 的一侧造成重复版本；已知存在安全风险的旧版本不得在没有明确风险处置和受影响入口隔离时重新发布。
- 不删除或迁移 IndexedDB、Cache API、localStorage/sessionStorage 数据。
- 任一首次命令丢失、任务恢复缺失、离线回归或预算/测试失败时整体回滚加载语义；不得只提高预算或放宽断言。
