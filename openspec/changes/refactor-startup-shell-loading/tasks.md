## 1. Startup Shell

- [x] 1.1 为 OpenSpec 新增 `refactor-startup-shell-loading` 变更文档
- [x] 1.2 拆分 Drawnix 首屏壳层与延后功能层
- [x] 1.3 将任务恢复、自动插入、字体/视频恢复等副作用迁移到 idle 启动器
- [x] 1.4 调整 Web 入口运行时导入边界

## 2. Build & Prefetch

- [x] 2.1 配置 manual chunk 分组与 `idle-prefetch-manifest.json`
- [x] 2.2 新增 `SW_PREFETCH_GROUPS` 处理与空闲预取逻辑
- [x] 2.3 增加构建后首屏资源校验脚本

## 3. Verification

- [ ] 3.1 运行 OpenSpec CLI 校验（2026-08-03 执行 `openspec validate refactor-startup-shell-loading --strict`，exit 127：`openspec: command not found`；`pnpm exec openspec validate refactor-startup-shell-loading --strict` exit 254：`Command "openspec" not found`；保持未完成，不伪造通过）
- [x] 3.2 完成原 change 的类型检查与构建基线；重新打开后的最终产物复验由 6.3 跟踪

## 4. 2026-07-29 Evidence Refresh

- [x] 4.1 重新确认 HTML → main → bootstrap → App → Drawnix 正反向启动链
- [x] 4.2 重新构建并记录当前 chunk raw/gzip 体积与 bootstrap 静态 imports
- [x] 4.3 在同机 1280×720 下完成冷/热、SW 关/开各 5 次启动基线
- [x] 4.4 验证 warm SW 在源站停止时仍可离线进入画布，并记录 SW 关闭对照
- [x] 4.5 修复 Vitest 使用 production React 和 App 占位测试，不改变产品行为
- [x] 4.6 用户批准本次重新打开的加载语义、预算与验收阈值

## 5. Boundary Correction (approval required)

- [x] 5.1 先增加会因当前 `ai-chat`/`tool-windows` 回流与总预算而失败的产物级测试
- [x] 5.2 从轻量 runtime 导出 analytics release API，并移除 bootstrap 对根 barrel 的静态依赖
- [x] 5.3 增加轻量 Chat controller/命令队列，未打开时不挂载完整 ChatDrawer
- [x] 5.4 增加等尺寸 AI 输入轻壳；完整 provider/model/workflow 依赖在首次交互立即加载，或在 `isStartupOperable` 后由可取消 idle 回调自动挂载；两条路径复用单飞 loader，自动挂载不聚焦、不提交
- [x] 5.5 统一 Vite、idle manifest 与 validator 禁止组，入口静态图总 raw budget 设为 2,000,000B
- [x] 5.6 补 Chat/AI 首次打开、命令排队/失败重试、AI 草稿/预填回放和初始化失败自动化回归测试
- [x] 5.7 修复 CDN 配置无界等待/重复探测与 SW 普通 idle run 全量扩张
- [x] 5.8 统一 Mermaid `10.9.6` 与传递 uuid `14.0.1`，并启用聊天图表 strict 模式
- [x] 5.9 增加 Drawnix app 专用入口并按依赖层拆分首屏 React、Plait、Slate 与 TDesign vendor，禁止循环 chunk
- [x] 5.10 将 SheetJS 锁定到官方 `0.20.3` tarball，并增加中文字段/多工作表往返合同；将 `@swc-node/core` 兼容锁定为 `1.13.3`
- [x] 5.11 将可选画布浮层、ToolGenerator/工具设置与生图、PPT 图片操作、刷新活动任务检查移入首次真实操作的延迟边界
- [x] 5.12 将 AppMenu、MoreTools、Asset/统一缓存、RetryImage/音频缓存、Minimap 和精细擦除移入各自真实激活或空闲边界；CacheQuota idle/runtime 消费统一 `isStartupOperable` 门槛，并增加单飞、失败重试、卸载防迟到与手势快照合同；延迟缓存边界以显式 `UnifiedCacheService` 公共接口约束声明输出，不泄露实现类的私有 IndexedDB 状态，运行时 singleton 与缓存语义不变（最终边界回归 5 files / 16 tests、目标 lint/typecheck 通过）
- [ ] 5.13 在最终生产产物上复验任务/工作流恢复、初始化失败与 warm offline，不以旧构建或仅单元测试替代浏览器证据
- [x] 5.14 历史实现：修复 AI 输入轻壳只在交互后升级的问题，以 `isStartupOperable` + idle 自动挂载完整运行时；组件合同 9/9、生产 smoke 3/3、零交互探针均通过。生产 v1.0.4 复审证明该语义导致刷新后加载过重，将由 10.3–10.4 的真实 ComposerCore 与动作级 runtime 取代；本项保持已完成只记录历史事实

## 6. Reverification

- [x] 6.1 运行最终相关 Vitest、App/SW 集成测试和 startup validator：`pnpm test` 292 files / 2,218 tests（2,217 passed、1 skipped、0 failed），startup analyzer 9/9、release static 44/44、manual contract 14/14，均 exit 0
- [ ] 6.2 运行相关 Playwright smoke/feature/visual/responsive；Chromium 1200 已安装到隔离可写缓存，最新 production artifact 经 `web:preview` 运行 smoke 3/3 通过，主画布合同在不点击/填写轻壳的情况下等待完整 AI 输入栏自动出现后继续验证；零交互独立探针记录 342ms 自动挂载、轻壳归零、无焦点抢占、应用请求失败 0。feature/visual/responsive 全矩阵尚未全部执行，因此保持未完成
- [x] 6.3 运行 `drawnix:typecheck`、`web:typecheck`、相关回归、cycles、`git diff --check`、`NX_DAEMON=false pnpm exec nx build web`、`NX_DAEMON=false pnpm exec nx build drawnix --skip-nx-cache`、startup contract 与 `verify:startup`：类型检查/build/diff 均 exit 0，Drawnix JS 与 `vite-plugin-dts` 声明生成无 TypeScript diagnostics，0 cycles；独立 declaration-only 合同扫描 1,071 个声明且关键入口/浮层声明完整。最终 `drawnix-app` 481,924B、入口静态图 1,941,175B、所有单文件不超过 512,000B。全仓 lint 仍 exit 1，但当前 433 errors / 2,441 warnings 相对 HEAD 439 / 2,471 减少 6 / 30，本 change 新增 diagnostics 为 0
- [x] 6.4 用同口径重跑四组各 5 次并报告原始值、中位数、范围、请求/正文和代价；另以 10 次 cold/SW-off 强制门槛确认中位 313ms、最大 375ms、18 请求、1,989,484B，禁止资源和页面/HTTP 失败均为 0。原四组 warm/SW-on 第 2 次有一次 `startup-app` `ERR_ABORTED`，页面仍可操作；稳定 2 秒后追加 5 次均未复现，保留原异常且不推测原因
- [ ] 6.5 复审 Chat/AI 首次交互、任务/工作流恢复、升级、离线与多标签页路径（最终产物已验证 Chat/AI、菜单/工具/Minimap 和 warm offline；任务/工作流真实恢复、升级与多标签页浏览器路径仍未在本轮重新执行）

## 7. Dependency Security & Compatibility

- [x] 7.1 运行冻结锁安装/收敛检查，确认 SheetJS 官方 tarball、Mermaid、uuid 与 `@swc-node/core` 解析结果写入唯一 lockfile
- [x] 7.2 运行 SheetJS 中文字段/多工作表往返和 Mermaid strict 合同：2 files / 3 tests，exit 0
- [x] 7.3 运行 `pnpm audit --prod --json`：464 production dependencies，0 vulnerabilities，exit 0
- [x] 7.4 使用 lock importer/resolution 与 `pnpm why` 复核实际消费者和精确版本；不执行 Nx、Vite、Vitest 或 React 大版本迁移
- [x] 7.5 记录完整工具链审计剩余风险：1,592 dependencies、3 moderate、0 high/critical，exit 1；其中 2 个来自 `@swc/cli → downloader → file-type`、1 个来自 Nx 19 `nx graph` CORS，不把生产审计通过误写为全依赖无风险
- [x] 7.6 根据 Node 官方发布计划将项目 engines 收敛到 22.x，并将 CI 与 Docker builder 从 2026-04-30 已 EOL 的 Node 20 迁移到精确版本 `22.23.2`；builder 固定 linux/amd64 `bookworm-slim@sha256:0f654709…c7e00`，frozen install 独立于源码和 release identity 形成可复用层；本机 Node 22 全量测试/类型/构建已通过，最终 slim builder 兼容性由本次 amd64 发布镜像构建复验
- [x] 7.7 修复 Floating UI 四个导出 Hook 的 `TS2742` 非可移植声明，令 Vite 声明 diagnostics fail-closed，并增加独立 CI declaration-only 生成与关键文件/路径泄漏合同（3/3 测试、1,071 个真实声明扫描通过）
- [x] 7.8 将 GitHub quality、production build、production artifact smoke 拆成职责独立的 job；以六个 Nx 项目和 Drawnix Hover 的 schema v2 逐诊断 fingerprint/scope baseline 替换必然失败的裸 lint，补充新诊断、重复、动态消息、target/config/tool scope、文件退出扫描、Hover 崩溃、Nx 冷启动 JSON stdout、artifact 部分/完整重跑和单调 ratchet 合同；提交 `5184f16989dff8bf138def7f5ead7ecf2aee45b6` 的 GitHub run `30796609345` 已确认 quality、main、smoke、release-e2e 四个 job 全部 success

## 8. User Manual Static Document

- [x] 8.1 用实际响应确认 `/user-manual/` 返回 SPA shell，而 `/user-manual/index.html` 返回带手册标记的 18,467B 静态文档
- [x] 8.2 将应用菜单固定到 `./user-manual/index.html`，并增加禁止退回目录 URL 的合同
- [x] 8.3 验证 21 个生成 HTML 页面、`opentu-document=user-manual`、手册版本 1.0.2、SW 显式 HTML 路由和 release static 字节/标记合同（manual contract 14/14、release static 44/44）
- [x] 8.4 使用最终生产产物从应用菜单打开手册：新窗口为 `/user-manual/index.html`，marker/version 为 `user-manual`/`1.0.2`，sidebar/main 各 1、应用 `#root` 为 0，并成功跳转 `advanced-settings.html`

## 9. Production Startup Regression Contracts (approval required)

- [ ] 9.1 将 `https://img.foropencode.com/` v1.0.4 的 cold/SW-off、Slow 4G、400kbps + CPU×4、warm SW、首次/重复工具打开基线固化为可重复探针，保留每组原始样本、资源数、encoded/decoded 字节和版本身份
- [ ] 9.2 先增加失败的产物图合同，证明当前 Composer idle 闭包、`tool-windows` catch-all、素材库/视频交叉导入、无效 CDN 和容器缺失 gzip 不符合新预算
- [ ] 9.3 增加用户意图到可见 shell 的 100ms 可访问 fallback 合同，覆盖素材库、图片生成、Chat 和 Composer 动作加载失败/重试

## 10. Startup Milestones, Composer and Resource Scheduling

- [ ] 10.1 建立 `shellCommitted`、`boardInteractive`、`workspaceRestored`、`composerInteractive`、`assetIndexReady`、`taskRecoveryReady`、`generationRuntimeReady` 单调里程碑，迁移真实消费者并删除单一 `isStartupOperable` 的串行所有权
- [ ] 10.2 实现无业务依赖的 `StartupResourceScheduler`，支持 critical/interaction/likely-next/background、前台抢占、并发/压缩字节预算、可重试单飞和生命周期清理
- [ ] 10.3 将 AI 输入迁移为首屏真实 `ComposerCore`，保留 Prompt、草稿、IME、generation type、selectionKey、焦点和恰好一次提交语义
- [ ] 10.4 将 model/parameter、attachment/library、history/optimizer、Agent/Workflow/MCP/external skills 和 generation submit 切为动作级 runtime，移除 `AIInputBar` 模块顶层 MCP/长视频/external skill 初始化与 idle 自动挂载完整业务闭包的路径
- [ ] 10.5 增加快速连续意图、IME Enter、加载失败/重试、卸载迟到、在途 settings/catalog 变化和零隐式生成请求回归

## 11. Media Library and Image Generation Feature Boundaries

- [ ] 11.1 将素材库迁移为 shell/core/extended；首开 core 不得静态导入 GitHub sync、preview/editor、audio player、ZIP/download、canvas insertion、TaskExecutor 或 generation runtime
- [ ] 11.2 建立版本化、可丢弃的 `AssetProjectionIndex` 与 source revision；先返回快照，后台分批增量对账，将 URL/cache/task 投影合并收敛为 O(n)
- [ ] 11.3 增加索引首帧零全库扫描、同 revision 零重复扫描、损坏/版本不匹配重建、写入/删除对账和权威数据不变回归
- [ ] 11.4 将 TTD 共享根迁移为独立 `image-generation-shell/core` 与 `video-generation-shell/core`，图片首开不得加载视频根；参考图素材库、batch/editor 按真实动作加载
- [ ] 11.5 生成 submit 前通过单飞 loader 加载现有唯一 planner/TaskQueue/executor，验证一个用户意图恰好一次进入现有生图路由，不复制 ModelRef、binding、重试、取消或恢复语义
- [ ] 11.6 从素材库/图片生成入口删除 `enableToolWindows(TOOL_WINDOW_GROUPS)` catch-all，补充禁止 chunk、import/fetch 计数、首次/重复打开与 PPT/Comic/workflow/plugin/canvas 行为回归

## 12. Release Graph, CDN and Compression

- [ ] 12.1 从明确 Composer、素材库、图片生成等 feature entry 生成精确传递闭包，用 gzip 字节、唯一文件数、依赖深度和禁止跨功能资源替换目录/chunk 名称分组
- [ ] 12.2 收敛 ordinary/default idle union；manifest defaults 为空时 Service Worker 零 manifest 请求，明确 group 仅加载该组，upgrade full-prewarm 保持最低优先级且可被前台暂停
- [ ] 12.3 将当前容器发行模式设为 origin-only/零 CDN 候选，删除主入口对未发布 jsDelivr `aitu-app` 的等待；仅当同 releaseId 资源发布且 hash/CORS/MIME/字节身份通过时才允许注入 CDN
- [ ] 12.4 为可压缩的 HTML/JS/CSS/JSON/manifest/SVG 生成/服务 gzip，验证本机容器直连与生产 origin 的 `Content-Encoding`、`Vary`、解码字节身份、MIME 和既有缓存头
- [ ] 12.5 更新 startup/release/CDN 产物合同与 CI，强制 Composer ≤12 JS/150KiB gzip/depth 4，素材库与图片 core 各 ≤25 files/300KiB gzip/depth 4，idle union ≤30 files/500KiB gzip

## 13. Instrumentation, Regression and Production Verification

- [ ] 13.1 新增不包含 Prompt、凭据、ModelRef、媒体 URL/字节的 performance marks，记录启动里程碑、feature intent/shell/core、索引快照/对账、资源来源与前后台调度计数
- [ ] 13.2 运行组件、scheduler、索引、SW/CDN、release static、恢复/离线、AI 输入、素材库、图片/视频、PPT/Comic/workflow/plugin/canvas 定向测试与全量相关回归
- [ ] 13.3 运行 `drawnix:typecheck`、`web:typecheck`、`check:cycles`、修改文件 lint baseline/delta、`git diff --check`、`NX_DAEMON=false pnpm exec nx build web` 和 production artifact smoke
- [ ] 13.4 使用同一 production artifact 运行 cold/warm SW、A→B 升级、Slow 4G、400kbps + CPU×4、首次/重复打开各至少 20 次原始样本，检查 P75/P95、资源预算、禁止 chunk、调用计数和 timer/listener 清理
- [ ] 13.5 使用本机容器直连验证 gzip、release identity、warm offline 和恢复语义，再部署到 `https://img.foropencode.com/` 复测同一指标；不发起付费生成请求
- [ ] 13.6 运行 `openspec validate refactor-startup-shell-loading --strict`；CLI 不可用时保持未完成并记录精确错误，不伪造 strict validation 通过

## 14. 2026-08-03 Release Slice

- [x] 14.1 主入口改为 origin-only，移除未发布 jsDelivr 配置等待；空 defaults 启动不再请求 idle manifest，明确分组只收集其静态依赖
- [x] 14.2 首屏保留真实可编辑 textarea；完整 AI runtime 只在真实扩展动作或提交时加载，草稿、IME、焦点与恰好一次提交合同由组件测试覆盖
- [x] 14.3 图片、视频、Mermaid、Markdown 对话框拆为独立可重试边界；素材库 GitHub 同步、任务恢复、项目 Frame/Layer 和工具窗口按真实动作加载
- [x] 14.4 素材首次读取并行化并消除音频封面 O(n²) 合并；异步 size、同步、playlist 与恢复逻辑增加 single-flight、取消和卸载防迟到保护
- [x] 14.5 新增独立 Board metadata index、manifest、pending journal、跨标签排他锁和损坏重建；`boards` 保持唯一权威，首次历史扫描后后续启动不遍历完整 Board
- [x] 14.6 Card Markdown 从首屏静态图移至 Card 存在时自动加载，内容就绪后重新测高；`drawnix-app` 从 516,122B 降至 504,879B，未提高 512,000B 预算
- [x] 14.7 Web/static 合同 105/105、Drawnix 本轮合同 77/77、React Board 9/9、Card 边界 9/9 通过；`drawnix`/`web`/`react-board` typecheck、cycles、逐诊断 lint regression、diff check、Web 生产构建、SW 构建与 startup validator 均 exit 0
- [ ] 14.8 OpenSpec strict validation（CLI 和 pnpm 命令均不可用，保持未完成；不阻断已经通过代码合同验证的实现）
