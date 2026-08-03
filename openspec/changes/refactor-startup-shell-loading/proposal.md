# Change: Refactor Startup Shell Loading

## Why

原 change 已完成一轮壳层拆分，但 2026-07-29 对当前源码和重新构建产物的复审确认启动边界再次发生漂移：

- `Drawnix` 初始渲染仍无条件挂载 `DeferredAIInputBar` 和 `ChatDrawer`。
- Web bootstrap 从根 `@drawnix/drawnix` barrel 导入 analytics release API，使生产 `bootstrap` 静态依赖 `ai-chat` 与 `tool-windows`。
- 当前 startup validator 的禁止组没有 `ai-chat`，且只限制单个入口资产 500KiB，不限制入口静态图总量，因此 `pnpm verify:startup` 错误放行。
- 当前生产构建在 1280×720、本机回环网络、冷 origin、SW 关闭的 5 次样本中，画布可操作前每次收到 39 个服务器请求和 5,859,060B 无压缩正文；5/5 样本都包含 `ai-chat-*`、`tool-windows-*` 与 `DeferredAIInputBar-*`，可操作中位数 1174ms（1152–1276ms）。
- 2026-08-03 复审确认启动页会无上限等待优先 CDN 的 `cdn-config.js`，且冷缓存下页面内三条调用链会重复探测同一 `version.json`；Service Worker 的普通 idle run 会把 manifest 所有分组追加到明确请求/default，当前产物可扩张到约 18.8MB，而不是只预取所请求的组。
- 后续入口图追踪确认应用菜单、MoreTools、Minimap、Asset/缓存运行时和精细擦除布尔运算会在用户尚未使用这些能力时进入启动资源；按真实激活边界完成拆分并让 CacheQuota idle/runtime 消费统一 `isStartupOperable` 门槛后，最终生产构建的 `drawnix-app` 为 481,924B、入口静态图为 1,941,175B，所有单文件均不超过 512,000B，未通过提高预算完成验收。
- 2026-08-03 早期复验曾为解决占位轻壳无限保留，在统一 `isStartupOperable` 后 idle 自动挂载完整输入栏。后续对已部署 v1.0.4 的生产复审证明这个历史修正导致大量无关动态依赖在刷新后自动求值；本次方案以首屏真实 `ComposerCore` 取代占位壳，并取消 idle 无条件挂载完整 AI 业务闭包。
- 用户手册故障的实际响应已定位：目录 URL `/user-manual/` 被 SPA fallback 返回主应用，而显式静态文档 `/user-manual/index.html` 返回带 `opentu-document=user-manual` 标记的真实手册。菜单入口和发布静态合同必须使用显式文档地址，不能依赖目录重写。
- 生产依赖审计确认 Mermaid 10.9.3 位于实际聊天渲染链且存在已发布补丁；`xlsx@0.18.5` 也位于批量生图与模型基准的真实 Excel 导入/导出链。SheetJS 的 npm registry 版本不是修复来源，但上游官方 CDN 提供同一库的 `0.20.3` tarball，因此本 change 以真实中文字段、多工作表往返合同验证后升级，而不是更换解析器或继续保留已知风险版本。

上述修复前数据说明了重新打开该 change 的依据；最终产物数据只记录本次实现已经满足静态预算，不替代仍待完成的浏览器、离线和首次交互验收。

2026-08-03 对已部署的 `https://img.foropencode.com/`（`v1.0.4`，release `7e6617f04c83c9653a196be2bde785e551b763cd`）重新执行冷缓存、Service Worker、慢网、CPU 限速和首次工具交互审计后，确认上一轮“入口静态图”预算没有覆盖启动后的动态依赖瀑布，当前生产体验仍不合格：

- 冷缓存且禁用 Service Worker 时，画布约 6.19 秒出现、完整 AI 输入约 6.85 秒出现；页面共加载约 166 个资源，其中 142 个 JavaScript 和 21 个 CSS，压缩传输约 1.65MB、解码后约 4.44MB。
- 在 400kbps、300ms RTT、4× CPU 限速下，画布约 20.46 秒、完整 AI 输入约 36.76 秒；更弱网络、反向代理 TTFB 与客户端 CPU 叠加后可复现用户报告的接近一分钟，而不是某个一分钟定时器。
- 完整 AI 输入的 idle “升级”会加载 `AIInputBar` 的 Workflow、MCP、TaskQueue、素材库、知识库、模型目录、图片/视频/音频生成和 external skills 静态闭包；模块顶层还直接初始化 MCP、长视频链与外部 Skill，因此轻壳升级不是一个轻量组件加载边界。
- 首次打开素材库和 AI 图片生成分别还会新增约 66 和 73 个资源，已受 Service Worker 控制时仍约 1.9 秒才可见。点击素材库会同时挂载工具窗口、后台任务运行时并请求 `tool-windows + runtime-static-assets`，交互资源与后台资源竞争。
- 当前生产 `idle-prefetch-manifest.json` 的 `ai-chat`、`tool-windows`、`editor-engines` 分组分别包含 305、323、304 项，三个大组约 300 项重叠；`tool-windows` 本地同构建为约 7.06MB raw，分组已退化成命名入口的完整依赖闭包，而不是功能级预取。
- 生产 HTML 无条件优先请求 `https://cdn.jsdelivr.net/npm/aitu-app@1.0.4/cdn-config.js`，但该 npm 包版本及抽查的 `version.json`、启动和功能 chunk 均真实返回 404。当前 `local` 偏好也不会让 Service Worker 的远程候选集为空，未缓存功能资源仍可能先承担 CDN 失败再回源。
- `idle-prefetch-manifest.json` 在线上为 104,034B、`no-store` 且未压缩；即使 defaults 为空，Service Worker 激活后仍下载该清单再发现无默认工作。
- 当前容器 `docker/nginx.conf` 未启用 gzip/Brotli；容器直连会发送约 1.94MB raw 的启动图。线上 OpenResty 目前为 HTML/JS 补了 gzip，但镜像本身没有可移植的压缩合同，JSON 清单在线上也仍未压缩。
- `AssetContext.loadAssets()` 在刷新后的首次内存加载中依次读取本地素材、已完成/归档任务和全部统一缓存元数据，再合并、去重、排序并补齐缺失 size；8 秒 TTL 仅存在于当前页面内存，不能改善新页面的首次素材库打开。
- `WorkspaceStorageService.loadAllBoardMetadata()` 的注释声称只读取元数据，但实际通过 `boardsStore.iterate<Board>` 反序列化每个完整 Board 及其 elements/Base64。大工作区每次刷新都会重复支付完整画板反序列化成本，因此仅拆分 JavaScript chunk 不能消除该启动长尾。

这些事实把根因限定为错误的模块/功能边界、错误的 CDN 可用性事实、过宽预取和缺少公网性能合同；哈希缓存仍然有效，但缓存不能消除新 release、新功能 chunk、JavaScript 重新求值或 IndexedDB 重建成本。整个修正继续保持现有生成、恢复和权威存储语义，并让校验覆盖真实依赖图与公网用户路径。

## What Changes

- 拆分首屏画布壳层与延后功能层；非核心能力按真实动作懒挂载，idle 只允许预热受预算约束且无副作用的 core
- 为 Web 入口新增运行时轻量导出边界，避免启动服务通过 UI barrel 进入首包
- 为动态画布新增仅导出 `Drawnix` 的 app 子入口，并按依赖层稳定拆分首屏框架 vendor
- 为构建产物新增 `idle-prefetch-manifest.json` 与手动 chunk 分组
- 为 Service Worker 增加空闲预取消息与高频懒加载资源缓存能力
- 增加构建后校验脚本，守护首屏资源边界和入口体积
- 复审修正：bootstrap 的 analytics release API 也必须从轻量 runtime 边界导入
- 生产复审修正：Chat 抽屉未打开时不挂载；AI 输入首屏直接挂载可编辑、可保留草稿/IME 的真实 `ComposerCore`，模型、工作流、MCP、附件和生成提交按对应动作加载，不再 idle 挂载完整 AI 闭包
- 复审修正：Popup/Link/画笔设置/清空确认等可选画布浮层只在首次真实激活后挂载；工具元素渲染、工具设置、工具生图、PPT 图片覆盖与占位图生成只在对应元素或操作发生时加载
- 复审修正：刷新检查只在用户真实请求刷新时加载活动任务图，未刷新启动不静态引入 TaskQueue/生成依赖
- 复审修正：完整应用菜单、MoreTools、Minimap、Asset/统一缓存重运行时和精细擦除分别延迟到真实打开、展开、对应单调里程碑/首次显式存储操作、有效多点擦除手势；动态加载必须单飞、失败可重试并忽略卸载后的迟到结果
- 复审修正：构建校验必须禁止 `ai-chat`、`diagram-engines`、`tool-windows`、`external-skills` 回流，并限制入口静态图总量，而不只检查单文件
- 补齐初始化失败、首次打开 Chat/AI、任务恢复与产物依赖图回归测试
- 当前容器发行的主入口直接同源启动且零 CDN 候选；未来已授权同 release CDN 的静态 fallback 选择在单页面内单飞且失效快速回源
- 普通 idle prefetch 只执行明确请求的分组或 manifest defaults；只有发布升级全量预热显式遍历所有分组
- 用户手册菜单固定打开 `./user-manual/index.html`，并由 Service Worker/static release 合同阻止显式手册 HTML 被应用壳替代；保持 21 个已生成页面、版本标记与站内链接完整性
- 将直接与传递 Mermaid 统一锁定到带安全修复的 `10.9.6`，将其 `uuid@9.0.1` 传递链收敛到 `14.0.1`，并将不可信聊天图表渲染切换为 strict security level
- 将 Excel 依赖升级到 SheetJS 官方 `https://cdn.sheetjs.com/xlsx-0.20.3/xlsx-0.20.3.tgz`，以批量模板中文字段和模型基准多工作表往返合同保护现有业务格式
- 将 Nx 19 / `@swc-node/register` 工具链使用的 `@swc-node/core` 精确锁定为与当前 SWC 依赖图兼容的 `1.13.3`，不在启动优化中进行 Nx、Vite 或 React 大版本迁移
- 将项目 Node engines 收敛到受支持的 22.x，并将 CI 和 Docker builder 从已经结束维护的 Node 20 升级到精确的 Node `22.23.2`；Docker builder 固定到 linux/amd64 `bookworm-slim` manifest digest，保持 glibc 构建兼容并减少浮动镜像与无关构建包暴露面；依赖清单/frozen install 与源码/release identity 分层，避免普通源码提交重复下载依赖
- 修复 Floating UI 对话框和浮层 Hook 的声明推断泄漏，以 `@floating-ui/react` 公开类型定义可移植返回合同；声明生成遇到 TypeScript diagnostics、缺失关键公开声明、pnpm 物理路径、绝对工作区路径或未声明的传递类型依赖时必须失败，并由独立 CI declaration-only 合同守护
- 修复 GitHub Actions 将既有 lint 债务误呈现为编译失败的问题：质量、生产构建与 production artifact 浏览器 smoke 使用职责独立的 job；完整 lint 改由版本化逐诊断 fingerprint 回归门禁执行，并锁定 Nx target、配置、工具版本和已扫描文件。任何新增 error、warning、重复次数、fatal parser error、scope 收窄或新增 Hover 违规都必须阻断 CI；历史诊断减少也必须显式收紧 baseline 后才能通过，禁止用 `continue-on-error`、总数阈值或关闭规则制造绿色状态
- 生产复审修正：取消由 `board + AI 轻壳` 组成的单一全局启动门槛，分别记录 shell、board、composer、workspace、asset index、generation runtime 和 task recovery 的单调就绪状态；安全恢复不得等待可见 AI 组件，后台工作也不得与前台交互共用一个布尔开关
- 生产复审修正：将当前 5,000+ 行完整 `AIInputBar` 拆成首屏真实可输入的 `ComposerCore` 与按动作加载的 model/parameter、attachment/library、Agent/Workflow/MCP、history/optimization 和 generation submit 运行时；移除模块顶层业务初始化副作用
- 生产复审修正：将素材库和图片生成拆为可立即显示的 feature shell、受预算约束的 feature core 与 extended runtime；点击时先提交可见状态，后台 runtime 和扩展资源不得与用户所需 core 并发抢占
- 生产复审修正：以单飞、优先级和前后台预算统一调度 dynamic import、意图预热与 Service Worker 预取；`pointerenter`、`focusin`、`touchstart` 只预热无副作用 core，真实 click 复用同一 Promise，任一前台加载会暂停后续后台预取
- 生产复审修正：将 idle manifest 改为从明确 feature entry 生成的精确 `*-core`/`*-extended` 资源图，增加每组唯一文件数与 gzip 字节预算；defaults 为空时 Service Worker 不获取 manifest，发布 full-prewarm 仍是可暂停的最低优先级后台工作
- 生产复审修正：CDN 候选改为构建/发布事实。当前仅发布容器的发行版默认同源且零远程候选；只有精确 release 资源已发布并逐关键 hash 验证后才能注入 CDN，`local` 偏好必须使候选集为空，主入口不得等待可选 CDN 配置
- 生产复审修正：镜像自身生成/服务可验证的 gzip 静态资源并压缩 HTML、JS、CSS、JSON、manifest 和 SVG；发布合同同时验证容器直连与部署站点的 `Content-Encoding`、解码字节身份和原有缓存头
- 生产复审修正：素材库使用版本化、可丢弃的轻量索引快照先显示最近投影，再在后台增量/分批对账本地素材、任务与统一缓存；权威数据源、删除/写入语义和 Cache API key 保持不变
- 生产复审修正：工作区画板列表使用独立、版本化、可丢弃的 metadata index；`boards` 继续作为唯一权威，旧用户首次重建一次，后续启动只读取不含 elements 的投影。保存、元数据更新、删除和清空在集中存储边界维护 pending journal，索引损坏或中断时从权威 Board 幂等重建
- 生产复审修正：卡片 Markdown 只在画布真实存在 Card 时自动加载；加载完成后复用 Card generator 的高度测量，不要求用户点击、不改变卡片内容和布局权威
- 增加真实公网、受控 Slow 4G/受限网络、冷/暖 SW、更新前后、首次/重复打开的 performance marks、资源数量、压缩字节和初始化调用次数合同，禁止继续只用 localhost 入口 raw budget 证明用户体验

## Impact

- Affected specs: `startup-performance`, `release-safe-static-loading`, `smart-cdn-loading`, `ai-input-generation`
- Affected code: `apps/web`, `packages/drawnix`, `apps/web/src/sw`, `scripts`, user-manual static document contracts, root/package manifests and `pnpm-lock.yaml`
- Preserved data/API semantics: 不修改画板、任务、工作流、素材缓存或偏好数据格式；不改变模型/供应商路由；保持 `@drawnix/drawnix` 公开根导出兼容
- User-visible trade-off: Chat/AI/素材库/图片生成首次激活可以短暂显示局部骨架或阶段提示，但 Prompt 输入和窗口壳必须立即可见；任何用户触发的 lazy 边界不得以 `fallback={null}` 表现为点击无响应
- Network/deployment scope: 当前容器发行方式默认同源静态资源；不发布 npm/CDN 资产时不再进行远程探测。未来启用 CDN 必须由同一 release 发布与 hash 就绪门禁授权，不能由域名或 display version 猜测
- Cache/data scope: 哈希静态缓存、release-scoped SW cache、画板、素材、任务和媒体权威存储格式保持不变；新增素材投影与独立画板 metadata index 都是版本化、可重建的派生数据。旧工作区首次读取会建立小型索引，但没有权威数据迁移、凭据迁移或第二套权威
- Dependency scope: 继续使用 SheetJS API，但依赖来源改为上游官方 `0.20.3` tarball；Mermaid/uuid 与 SWC 工具链采用精确、可审计的兼容锁定。锁文件、Excel 往返、Mermaid strict 渲染、类型检查与生产构建是同一升级合同，不引入新的 Excel 格式或业务字段迁移
- Build runtime scope: 仅升级 CI 和 Docker 的构建 Node；最终 Nginx 运行时、浏览器 JavaScript 目标、应用数据与网络协议不变
